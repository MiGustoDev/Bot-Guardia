/**
 * knowledge.js
 * Cerebro de contexto, detección de sucursales, horarios, técnicos de guardia y respuestas.
 * Diseñado con tono humano, natural y sin signos de apertura (¡ o ¿).
 */

const fs = require('fs');
const path = require('path');

// Archivo local donde se persiste quién tiene la guardia activa
const GUARDIA_STATE_PATH = path.join(__dirname, 'guardia_state.json');

// ==========================================
// 1. NÚMEROS Y DATOS DE LOS TÉCNICOS
// ==========================================
// Nota en WhatsApp Argentina: +54 9 XXXX suele mapearse en JID como 549... o 54...
const TECNICOS = {
  ramiro: {
    nombre: 'Ramiro',
    phone: '5493876117799', // +54 9 3876 11-7799
    variantes: ['ramiro', 'rami']
  },
  facu: {
    nombre: 'Facu',
    phone: '5491163704522', // +54 9 1163704522
    variantes: ['facundo', 'facu']
  }
};

// ==========================================
// 2. LISTA MAESTRA DE SUCURSALES (CABA Y GBA)
// ==========================================
const SUCURSALES = [
  // CABA
  'mataderos',
  'floresta',
  'belgrano',
  'devoto',
  'villa urquiza',
  'urquiza',
  'barrancas de belgrano',
  'barrancas',
  'villa crespo',
  'crespo',
  'palermo',
  'paternal',
  'puerto madero',
  'madero',
  'balvanera',
  'cañitas',
  'caballito',

  // GBA
  'bella vista',
  'martinez',
  'muñiz',
  'san martin',
  'del viso',
  'delviso',
  'escobar',
  'florida',
  'hurlingham',
  'ituzaingo',
  'jose c paz',
  'maschwitz',
  'don torcuato',
  'torcuato',
  'merlo',
  'moreno',
  'munro',
  'pacheco',
  'pilar centro',
  'pilar derqui',
  'derqui',
  'pilar',
  'polvorines',
  'los polvorines',
  'san fernando',
  'san miguel',
  'vicente lopez',
  'villa adelina',
  'adelina',
  'ballester',
  'villa ballester',
  'campana',
  'tigre'
];

// Helper para normalizar textos (minúsculas, sin tildes)
function normalizeText(str = '') {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ==========================================
// 3. CONTROL DE HORARIO DE GUARDIA
// ==========================================
/**
 * Valida si el bot debe responder en grupos según el horario configurado.
 * REGLA: No responde desde las 00:00 hasta las 08:59:59 hs.
 * Horario activo de guardia en grupos: 09:00 a 23:59:59 hs.
 */
function isWithinWorkingHours(date = new Date()) {
  const currentHour = date.getHours();
  if (currentHour >= 0 && currentHour < 9) {
    return false;
  }
  return true;
}

/**
 * REGLA DE ALERTAS AL TÉCNICO DE GUARDIA:
 * - Lunes a Viernes: SOLAMENTE de 17:15 a 23:59 hs.
 * - Sábados y Domingos: TODO EL DÍA (00:00 a 23:59 hs).
 */
function shouldAlertTech(date = new Date()) {
  const day = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 5 = Viernes, 6 = Sábado
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Sábado (6) y Domingo (0): todo el día
  if (day === 0 || day === 6) {
    return true;
  }

  // Lunes a Viernes (1 a 5): De 17:15 (17*60 + 15 = 1035) hasta 23:59
  const startMinutes = 17 * 60 + 15; // 17:15 hs
  return timeInMinutes >= startMinutes;
}

// ==========================================
// 4. GESTIÓN DEL TÉCNICO DE GUARDIA ACTIVO Y ROTACIÓN AUTOMÁTICA
// ==========================================
/**
 * Lee el estado actual de la guardia.
 * Si 'assigned' es null, están los dos activos (modo por defecto semanal).
 */
function getGuardiaState() {
  try {
    if (fs.existsSync(GUARDIA_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(GUARDIA_STATE_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo guardia_state.json:', e);
  }
  return { assigned: null, updatedAt: new Date().toISOString() };
}

function setGuardiaState(techKey, extra = {}) {
  try {
    const data = { assigned: techKey, updatedAt: new Date().toISOString(), ...extra };
    fs.writeFileSync(GUARDIA_STATE_PATH, JSON.stringify(data, null, 2));
    console.log(`[Guardia State] Asignado a: ${techKey || 'Ambos'}`);
  } catch (e) {
    console.error('Error guardando guardia_state.json:', e);
  }
}

/**
 * ROTACIÓN AUTOMÁTICA SEMANAL:
 * Se chequea periódicamente. Si es Lunes y ya pasaron las 09:00 hs,
 * y no se ha rotado en la semana actual (usando 'lastRotationWeek'), rota entre 'facu' y 'ramiro'.
 * Retorna un objeto { rotated: true, newTech: 'facu'|'ramiro', techName: string, phone: string } o null.
 */
function checkWeeklyAutoRotation(date = new Date()) {
  const day = date.getDay(); // 1 = Lunes
  const hours = date.getHours();

  // Solo se activa los lunes a partir de las 09:00 hs
  if (day !== 1 || hours < 9) {
    return null;
  }

  // Generar identificador de la semana (ej: "2026-W44")
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
  const currentWeekKey = `${year}-W${weekNum}`;

  const state = getGuardiaState();
  if (state.lastRotationWeek === currentWeekKey) {
    // Ya se rotó automáticamente este lunes
    return null;
  }

  // Decidir quién sigue: si la anterior fue facu -> le toca a ramiro, y viceversa
  const currentAssigned = state.assigned || 'facu';
  const nextAssigned = currentAssigned === 'facu' ? 'ramiro' : 'facu';

  setGuardiaState(nextAssigned, { lastRotationWeek: currentWeekKey });

  const tech = TECNICOS[nextAssigned];
  console.log(`[Rotación Automática] Lunes 09:00 hs detectado. Se rota guardia a: ${tech.nombre}`);

  return {
    rotated: true,
    newTech: nextAssigned,
    techName: tech.nombre,
    phone: tech.phone
  };
}

/**
 * Procesa mensajes privados de los técnicos para definir quién toma la guardia.
 * Ej: "la guardia es de facu" o "la guardia es de rami"
 */
function checkGuardiaAssignment(text = '', senderPhone = '') {
  const clean = normalizeText(text);

  // Chequear si el mensaje indica asignación de guardia
  if (clean.includes('guardia es de') || clean.includes('toma la guardia') || clean.includes('estoy de guardia') || clean.includes('le toca a')) {
    if (clean.includes('facu') || clean.includes('facundo')) {
      setGuardiaState('facu');
      return 'Entendido! Esta semana la guardia queda asignada a Facu. Le avisare a el de las alertas.';
    }
    if (clean.includes('rami') || clean.includes('ramiro')) {
      setGuardiaState('ramiro');
      return 'Entendido! Esta semana la guardia queda asignada a Ramiro. Le avisare a el de las alertas.';
    }
    if (clean.includes('ambos') || clean.includes('los dos')) {
      setGuardiaState(null);
      return 'Entendido! La guardia queda asignada a ambos (Facu y Ramiro).';
    }
  }
  return null;
}

/**
 * Retorna la lista de números telefónicos a alertar según quién tiene la guardia.
 */
function getActiveTechNumbers() {
  const state = getGuardiaState();
  if (state.assigned && TECNICOS[state.assigned]) {
    return [TECNICOS[state.assigned].phone];
  }
  // Si no está definido (o es lunes inicial), le avisa a los dos
  return [TECNICOS.ramiro.phone, TECNICOS.facu.phone];
}

// ==========================================
// 4.1. ANTI-FLOOD / COOLDOWN POR SUCURSAL / GRUPO
// ==========================================
/**
 * Almacena el timestamp de la última respuesta del bot por sucursal / chatId.
 * Regla: Ventana de cooldown (por defecto 1 minuto / 60000 ms).
 * Si escriben más de una vez dentro de esa ventana, se bloquea la respuesta y alerta repetida.
 */
const recentBranchActivity = new Map();
const COOLDOWN_MS = 60 * 1000; // 1 minuto de protección anti-spam

/**
 * Verifica si el chat/sucursal está en cooldown.
 * Si puede responder, registra el timestamp y devuelve { allowed: true }.
 * Si está en cooldown, devuelve { allowed: false, remainingSeconds }.
 */
function checkBranchCooldown(chatId = '', branchName = '') {
  const now = Date.now();
  const key = branchName && branchName !== 'No especificada' 
    ? `branch_${normalizeText(branchName)}` 
    : `chat_${chatId}`;

  const lastTime = recentBranchActivity.get(key) || 0;
  const elapsed = now - lastTime;

  if (elapsed < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return { allowed: false, remainingSeconds, key };
  }

  // Registrar último momento en que se atendió
  recentBranchActivity.set(key, now);

  // Limpieza periódica del mapa para no acumular memoria infinita
  if (recentBranchActivity.size > 200) {
    for (const [k, time] of recentBranchActivity.entries()) {
      if (now - time > COOLDOWN_MS * 5) {
        recentBranchActivity.delete(k);
      }
    }
  }

  return { allowed: true, key };
}

// ==========================================
// 5. DETECCIÓN DE SUCURSAL EN TEXTO O GRUPO
// ==========================================
/**
 * Detecta si en el texto del mensaje o en el título del grupo se menciona una sucursal conocida.
 */
function detectBranch(incomingText = '', chatTitle = '') {
  const fullText = normalizeText(`${incomingText} ${chatTitle}`);

  // 1. Detectar por nombre de sucursal
  for (const branch of SUCURSALES) {
    // Buscar palabra completa o frase
    const regex = new RegExp(`\\b${branch}\\b`, 'i');
    if (regex.test(fullText)) {
      // Devolver nombre capitalizado
      return branch.charAt(0).toUpperCase() + branch.slice(1);
    }
  }

  // 2. Detectar si escribieron número de local (ej: "local 14", "suc 8", "sucursal 22")
  const numMatch = fullText.match(/\b(sucursal|suc|local)\s*#?\s*(\d{1,3})\b/i);
  if (numMatch) {
    return `Sucursal ${numMatch[2]}`;
  }

  return null; // No se detectó ninguna
}

// ==========================================
// 6. GENERADOR DE SALUDOS SEGÚN HORA (HUMANO)
// ==========================================
/**
 * Genera el primer mensaje de saludo con variación natural sin signos de apertura.
 * - 09:00 a 13:00: Buen dia
 * - 13:00 a 19:00: Buenas tardes
 * - 19:00 a 23:59: Buenas noches
 * Variaciones con "Buenas, que tal!", "Hola, que tal!", "buenas, como estas?"
 */
function getRandomGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 9 && hour < 13) {
    // Mañana
    const options = [
      "Buen dia, que tal!",
      "Buenas, que tal!",
      "Hola, que tal!",
      "buen dia, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (hour >= 13 && hour < 19) {
    // Tarde
    const options = [
      "Buenas tardes, que tal!",
      "Buenas, que tal!",
      "Hola, que tal!",
      "buenas tardes, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    // Noche (19:00 a 23:59)
    const options = [
      "Buenas noches, que tal!",
      "Buenas, que tal!",
      "Hola, que tal!",
      "buenas noches, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
}

// ==========================================
// 7. GENERADOR DE RESPUESTA DE CHARLA
// ==========================================
/**
 * Genera el segundo mensaje variando entre las 3 frases requeridas.
 */
function getRandomAcknowledgement() {
  const options = [
    "No te preocupes, ahora lo revisamos",
    "Ahi lo estamos mirando, bancanos unos minutos",
    "Recibido, ya lo chequeamos"
  ];
  return options[Math.floor(Math.random() * options.length)];
}

// ==========================================
// 8. PLAN COMPLETO DE RESPUESTA EN GRUPO
// ==========================================
/**
 * Genera el paquete completo de mensajes a enviar al grupo cuando arroban a sistemas:
 * - Mensaje 1: Saludo contextual
 * - Mensaje 2: Confirmación de revisión
 * - Mensaje 3 (Opcional): Pregunta por la sucursal si no se detectó ninguna en el mensaje ni en el grupo
 */
function getGuardiaMentionResponse(context = {}) {
  const { incomingText = '', chatTitle = '' } = context;

  const detectedBranch = detectBranch(incomingText, chatTitle);

  const msg1Text = getRandomGreeting();
  const msg2Text = getRandomAcknowledgement();

  // El bot solo responde los 2 mensajes humanos: Saludo + Confirmación
  const messages = [
    {
      text: msg1Text,
      isReply: true, // Cita el mensaje original
      delayBefore: 2500, // Pausa de lectura inicial
      typingDuration: 3000
    },
    {
      text: msg2Text,
      isReply: false, // Mensaje separado en el chat
      delayBefore: 2000, // Pausa entre mensajes
      typingDuration: 3500
    }
  ];

  return {
    messages,
    detectedBranch: detectedBranch || 'No especificada',
    summaryText: `${msg1Text} | ${msg2Text}`
  };
}

module.exports = {
  isWithinWorkingHours,
  shouldAlertTech,
  checkWeeklyAutoRotation,
  checkBranchCooldown,
  detectBranch,
  getRandomGreeting,
  getRandomAcknowledgement,
  getGuardiaMentionResponse,
  checkGuardiaAssignment,
  getActiveTechNumbers,
  getGuardiaState,
  setGuardiaState,
  TECNICOS
};
