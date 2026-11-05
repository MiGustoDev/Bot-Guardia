
function capitalizeFirstLetter(str = '') {
  if (!str) return '';
  return str.replace(/^([^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]*)([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])/, (_, prefix, firstChar) => {
    return prefix + firstChar.toUpperCase();
  });
}

function cleanHumanText(text = '') {
  if (!text) return '';
  let res = text.trim();
  res = res.replace(/^[¡¿"\s]+|[!"\s]+$/g, '').trim();
  res = res.replace(/¡/g, '').replace(/¿/g, '');
  // Limpiar cada párrafo: quitar puntos finales y asegurar que la primera letra sea SIEMPRE mayúscula
  res = res
    .split(/\n+/)
    .map(line => {
      let cleanLine = line.trim().replace(/\.+$/g, '').trim();
      return capitalizeFirstLetter(cleanLine);
    })
    .filter(Boolean)
    .join('\n');
  return res;
}

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
 * REGISTRO SEMANAL DE ALERTAS E INCIDENTES
 * Almacena métricas de la semana actual dentro de guardia_state.json:
 * - Total de alertas
 * - Alertas en fin de semana vs día de semana
 * - Sucursales más activas
 */
function recordWeeklyAlert(branchName = 'No especificada', isWeekend = false) {
  try {
    const state = getGuardiaState();
    if (!state.weeklyStats) {
      state.weeklyStats = {
        totalAlerts: 0,
        weekendAlerts: 0,
        weekdayAlerts: 0,
        branches: {}
      };
    }

    state.weeklyStats.totalAlerts = (state.weeklyStats.totalAlerts || 0) + 1;
    if (isWeekend) {
      state.weeklyStats.weekendAlerts = (state.weeklyStats.weekendAlerts || 0) + 1;
    } else {
      state.weeklyStats.weekdayAlerts = (state.weeklyStats.weekdayAlerts || 0) + 1;
    }

    const branchKey = branchName || 'No especificada';
    state.weeklyStats.branches[branchKey] = (state.weeklyStats.branches[branchKey] || 0) + 1;

    setGuardiaState(state.assigned, state);
  } catch (err) {
    console.error('Error registrando alerta semanal:', err);
  }
}

/**
 * ROTACIÓN AUTOMÁTICA SEMANAL Y REPORTE DE CIERRE:
 * Se chequea periódicamente. Si es Lunes y ya pasaron las 09:00 hs,
 * y no se ha rotado en la semana actual (usando 'lastRotationWeek'):
 * 1. Genera el reporte de la semana que termina para el técnico saliente y entrante.
 * 2. Rota la guardia entre 'facu' y 'ramiro'.
 * 3. Reinicia las métricas para la nueva semana.
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
    // Ya se rotó y se reportó automáticamente este lunes
    return null;
  }

  // Identificar técnico anterior (saliente) y siguiente (entrante)
  const previousAssigned = state.assigned || 'facu';
  const nextAssigned = previousAssigned === 'facu' ? 'ramiro' : 'facu';
  const outgoingTech = TECNICOS[previousAssigned] || TECNICOS.facu;
  const incomingTech = TECNICOS[nextAssigned] || TECNICOS.ramiro;

  // Compilar estadísticas de la semana que cerró
  const stats = state.weeklyStats || {
    totalAlerts: 0,
    weekendAlerts: 0,
    weekdayAlerts: 0,
    branches: {}
  };

  // Ranking de top 3 sucursales con más reportes
  const topBranches = Object.entries(stats.branches || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([br, count], idx) => `${idx + 1}. *${br}* (${count} ${count === 1 ? 'alerta' : 'alertas'})`)
    .join('\n');

  const branchesSummary = topBranches ? `\n\n📌 *Sucursales más activas:*\n${topBranches}` : '';

  // Mensaje de Check-in y Reporte de Cierre de Guardia
  const summaryReportMsg = 
    `📊 *Reporte Semanal de Guardia - Sistemas*\n\n` +
    `Hola ${outgoingTech.nombre}, este es el resumen de la guardia que acaba de finalizar:\n\n` +
    `• *Total de alertas registradas:* ${stats.totalAlerts}\n` +
    `• *En días hábiles (17:15 a 00:00):* ${stats.weekdayAlerts}\n` +
    `• *En fin de semana:* ${stats.weekendAlerts}` +
    `${branchesSummary}\n\n` +
    `🔄 A partir de ahora toma la guardia semanal *${incomingTech.nombre}*. ¡Buen descanso!`;

  // Reiniciar métricas para la nueva semana y persistir rotación
  setGuardiaState(nextAssigned, {
    lastRotationWeek: currentWeekKey,
    weeklyStats: {
      totalAlerts: 0,
      weekendAlerts: 0,
      weekdayAlerts: 0,
      branches: {}
    }
  });

  console.log(`[Rotación Automática] Lunes 09:00 hs detectado. Se rota guardia de ${outgoingTech.nombre} a ${incomingTech.nombre}`);

  return {
    rotated: true,
    previousTech: previousAssigned,
    outgoingTechName: outgoingTech.nombre,
    outgoingPhone: outgoingTech.phone,
    newTech: nextAssigned,
    techName: incomingTech.nombre,
    phone: incomingTech.phone,
    reportMsg: summaryReportMsg
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
 * 4.0. LIMPIEZA AUTOMÁTICA DE BASURA DE CHROMIUM (Garbage Collection de Disco)
 * Limpia caches, logs y temporales de Puppeteer dentro de .wwebjs_auth sin tocar
 * cookies, tokens ni archivos esenciales de la sesión.
 */
function cleanChromiumCache() {
  const sessionDir = path.join(__dirname, '.wwebjs_auth', 'session', 'Default');
  const cacheDirs = [
    path.join(sessionDir, 'Cache'),
    path.join(sessionDir, 'Code Cache'),
    path.join(sessionDir, 'GPUCache'),
    path.join(sessionDir, 'Service Worker', 'CacheStorage'),
    path.join(sessionDir, 'Service Worker', 'ScriptCache'),
    path.join(__dirname, '.wwebjs_cache')
  ];

  let freedCount = 0;
  for (const dir of cacheDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        freedCount++;
      }
    } catch (e) {
      // Ignorar archivos en uso por el navegador en este momento
    }
  }
  console.log(`[Disk GC] Limpieza de caché de Chromium completada (${freedCount} directorios procesados).`);
  return freedCount;
}

/**
 * 4.1. CONTROL REMOTO DEL BOT POR WHATSAPP (Comandos de Diagnóstico y Gestión)
 * Permite a los técnicos autorizados consultar estado, uptime, RAM o cambiar la guardia.
 */
function processTechCommand(text = '', senderPhone = '', botStartTime = Date.now()) {
  const clean = text.trim().toLowerCase();

  // 1. #ping o #status
  if (clean === '#ping' || clean === '#status' || clean === '#info') {
    const mem = process.memoryUsage();
    const ramMB = (mem.rss / 1024 / 1024).toFixed(1);
    const uptimeSec = Math.floor((Date.now() - botStartTime) / 1000);
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);

    const state = getGuardiaState();
    const techName = state.assigned ? (TECNICOS[state.assigned]?.nombre || state.assigned) : 'Ambos';
    const totalAlerts = state.weeklyStats?.totalAlerts || 0;

    return `🤖 *Estado del Bot de Sistemas*\n\n` +
      `• *Estado:* Online ✅\n` +
      `• *Técnico de Guardia:* ${techName}\n` +
      `• *Alertas de la semana:* ${totalAlerts}\n` +
      `• *Uso de Memoria RAM:* ${ramMB} MB\n` +
      `• *Uptime:* ${days > 0 ? days + 'd ' : ''}${hours}h ${minutes}m\n` +
      `• *Horario de Guardia:* 09:00 a 23:59 hs\n` +
      `• *Alertas activas para técnicos:* Lun-Vie 17:15-23:59 | Sáb-Dom todo el día`;
  }

  // 2. #guardia
  if (clean === '#guardia') {
    const state = getGuardiaState();
    const current = state.assigned ? (TECNICOS[state.assigned]?.nombre || state.assigned) : 'Ambos (Facu y Ramiro)';
    return `🛡️ *Guardia Actual:* ${current}\n\nPodés cambiarla enviando:\n• #guardia facu\n• #guardia ramiro\n• #guardia ambos`;
  }

  // 3. #guardia <nombre>
  if (clean.startsWith('#guardia ')) {
    const arg = clean.replace('#guardia ', '').trim();
    if (arg.includes('facu')) {
      setGuardiaState('facu');
      return '✅ Guardia asignada a *Facu*. Las alertas de las sucursales te llegarán a vos.';
    }
    if (arg.includes('rami')) {
      setGuardiaState('ramiro');
      return '✅ Guardia asignada a *Ramiro*. Las alertas de las sucursales le llegarán a Ramiro.';
    }
    if (arg.includes('ambos') || arg.includes('todos')) {
      setGuardiaState(null);
      return '✅ Guardia asignada a *Ambos* (Facu y Ramiro).';
    }
  }

  // 4. #limpiar (Garbage Collection manual por comando)
  if (clean === '#limpiar' || clean === '#gc') {
    cleanChromiumCache();
    const mem = process.memoryUsage();
    return `🧹 *Caché de Chromium depurada con éxito!*\nRAM actual: ${(mem.rss / 1024 / 1024).toFixed(1)} MB.`;
  }

  // 4.5. #aprendido o #memoria
  if (clean === '#aprendido' || clean === '#memoria') {
    const mem = readLearnedMemory();
    const totalQA = mem.qaPairs?.length || 0;
    const totalPhrases = mem.stylePhrases?.length || 0;
    const lastExamples = (mem.qaPairs || []).slice(0, 3).map(p => `• "${p.question}" ➔ "${p.humanAnswer}"`).join('\n');
    return `🧠 *Memoria de Auto-Entrenamiento*\n\n` +
      `• *Casos reales aprendidos:* ${totalQA}\n` +
      `• *Expresiones propias capturadas:* ${totalPhrases}\n\n` +
      (lastExamples ? `*Últimas respuestas aprendidas de ustedes:*\n${lastExamples}` : `Todavía esperando respuestas manuales para aprender.`);
  }

  // 5. #ayuda o #comandos
  if (clean === '#ayuda' || clean === '#comandos') {
    return `🛠️ *Comandos de Sistemas Disponibles:*\n\n` +
      `• *#ping*: Ver estado general, RAM y uptime del bot.\n` +
      `• *#guardia*: Ver quién tiene la guardia activa.\n` +
      `• *#guardia facu / ramiro / ambos*: Cambiar la guardia.\n` +
      `• *#limpiar*: Limpiar caché de disco de Chromium.\n` +
      `• *la guardia es de [nombre]*: Modificar guardia en lenguaje natural.`;
  }

  // 6. Lenguaje natural habitual ("la guardia es de...")
  return checkGuardiaAssignment(text, senderPhone);
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
 * Variaciones con "Buenas, que tal", "Hola, que tal", "buenas, como estas?"
 */
function getRandomGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 9 && hour < 13) {
    // Mañana
    const options = [
      "Buen dia, que tal",
      "Buenas, que tal",
      "Hola, que tal",
      "Buen dia, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (hour >= 13 && hour < 19) {
    // Tarde
    const options = [
      "Buenas tardes, que tal",
      "Buenas, que tal",
      "Hola, que tal",
      "Buenas tardes, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    // Noche (19:00 a 23:59)
    const options = [
      "Buenas noches, que tal",
      "Buenas, que tal",
      "Hola, que tal",
      "Buenas noches, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
}

// ==========================================
// 7. GENERADOR DE RESPUESTA DE CHARLA (ESTÁTICO / FALLBACK)
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

/**
 * Generador opcional con Gemini AI.
 * Si GEMINI_API_KEY está configurada en .env o en config.json, genera una confirmación
 * humana y adaptada al mensaje. Si no hay key o falla, usa el fallback estático.
 */
const GEMINI_SYSTEM_INSTRUCTION = `
Sos Facu o Ramiro del equipo de soporte técnico de Sistemas de Mi Gusto (Argentina), atendiendo por WhatsApp desde el celular
Atendés tanto a las SUCURSALES/FRANQUICIAS (en grupos o privado) como a compañeros de OFICINA / PLANTA (en privado). Nadie debe sospechar jamás que sos una IA o un bot

REGLAS OBLIGATORIAS DE ESCRITURA HUMANA EN WHATSAPP (MAXIMA PRIORIDAD):
1. PRIMERA LETRA SIEMPRE EN MAYUSCULA: Todo mensaje o párrafo debe empezar SIEMPRE con la primera letra en mayúscula (ej: 'Buenas, como va?', 'No te preocupes, ya enseguida lo solucionamos')
2. PROHIBIDO USAR PUNTOS FINALES: En WhatsApp nadie pone punto al final de los mensajes porque suena cortante, frío o robótico. NUNCA cierres un mensaje con punto
3. PROHIBIDO USAR SIGNOS DE APERTURA: Jamás uses '¿' ni '¡'. Escribí como se tipea rápido desde el celular ('Buenas, como va?', 'Pasame una captura')
4. NUNCA digas que sos una IA, bot, modelo ni asistente virtual. Sos Facu o Ramiro de Sistemas
5. TONO HUMILDE, CALIDO Y BUENA GENTE (FUNDAMENTAL):
   - Nunca des órdenes secas ni imperativas (JAMAS digas 'Cambiá el cable' o 'Chequeá tal cosa' a secas). Hablá siempre con humildad y buena onda usando frases como: 'probá cambiar...', 'intentemos...', 'prueben hacer tal cosa...', 'fijate si podés probar...'
   - Si a la persona se la nota preocupada, apurada o angustiada por un problema, SIEMPRE tranquilizala diciendo: 'No te preocupes, ya enseguida lo solucionamos'
   - Cero formalismos robóticos ('Estimado', 'Cordial saludo'). Hablá en criollo argentino cercano y servicial
6. MENSAJES CORTOS Y DIRECTOS: De 1 o 2 oraciones concisas al grano. Sin listas ni viñetas

MANUAL OPERATIVO DE RESOLUCION TECNICA DE MI GUSTO (SEGUIR AL PIE DE LA LETRA):
1. TONER O IMPRESORA DE OFICINA NO FUNCIONA (HARDWARE / REPUESTO):
   - Si piden cambio de tóner o avisan que una impresora común no funciona físicamente: 'No te preocupes, ya enseguida lo solucionamos, ahí mismo nos contactamos con Samuel para que nos traiga el repuesto o venga a hacerle el mantenimiento'
2. IMPRESORA TIRA ERROR EN LA PC:
   - Si reportan que la impresora les tira un cartel de error en la computadora: 'No te preocupes, ya enseguida lo solucionamos, ahí bajamos y la revisamos'
3. PROBLEMAS DE INTERNET / WIFI / RED:
   - Asegurar siempre solución inmediata: 'No te preocupes, ya enseguida lo solucionamos y lo dejamos andando'
4. NAS O QSYNC CLIENT (CARPETAS COMPARTIDAS / SINCRONIZACION):
   - Para cualquier problema o solicitud de NAS o Qsync Client, pedir captura del error para revisarlo: 'No te preocupes, ya enseguida lo solucionamos, pasanos porfa un screenshot del error que te tira el Qsync/NAS así lo analizamos'
5. REGLA ESTRICTA DE ANYDESK (USO EXCLUSIVO PARA COMANDERAS):
   - AnyDesk SOLAMENTE y UNICAMENTE se usa para instalar comanderas nuevas o solucionarle algún error a una comandera. PROHIBIDO mencionar o pedir AnyDesk para cualquier otra cosa (NUNCA pidas AnyDesk para promos, sistema de ventas, pantallas, TV Box, NAS ni otros temas)
6. PROBLEMAS DE SISTEMA DE VENTAS / ERRORES EN PC:
   - Para cualquier problema en el sistema de ventas o error en la PC, pedir SIEMPRE screenshot/captura del error que les aparece para analizarlo: 'No te preocupes, ya enseguida lo solucionamos, pasanos porfa un screenshot o foto del error que les aparece en el sistema de ventas así lo analizamos bien'
7. PROBLEMAS DE COMANDERA (EN SUCURSALES):
   - Para problemas de comandera, SIEMPRE pedir screenshot/foto del error que les aparece para analizarlo y sugerir con humildad probar otro puerto USB: 'No te preocupes, ya enseguida lo solucionamos. Probá cambiar el cable de la comandera a otro puerto USB de la PC porque a veces se bugea el puerto, y pasanos un screenshot del error que te aparece para analizarlo (o el código de AnyDesk si sigue sin levantar)'
   - Si necesitan instalar una comandera nueva: 'Dale, no hay problema, pasanos el código de AnyDesk de la PC así nos conectamos un toque y te dejamos instalada la comandera'
8. PROMOCION NO APARECE EN EL SISTEMA:
   - Si a alguien no le aparece una promo en el sistema o botonera: asegurarle que enseguida mandamos una actualización para corregir el error de visualización: 'No te preocupes, ya enseguida lo solucionamos, ahí mandamos una actualización al sistema para corregir el error de visualización y que les aparezca la promo'
   - Si vuelven a consultar por la promo: avisar que ya mandamos la actualización y que prueben recargar el sistema con F5: 'Ya mandamos la actualización al sistema, prueben recargar con F5 y fijate que ya les tiene que aparecer'
9. PRODUCTO APARECE SIN STOCK:
   - 'No te preocupes, prueben habilitarlo ustedes desde el sistema entrando a la pestaña de Ver Stock, ahí le cargan el stock al producto y ya los deja vender'
10. PANTALLAS / TELEVISORES DE SUCURSAL Y TV BOX (DATALIVETV):
   - Si son problemas de pantallas donde NO se ven precios, tienen algún error, no encienden o están apagadas:
     * Pedir SIEMPRE foto/screenshot del error o de cómo se ve la pantalla para analizarlo
     * SIEMPRE PRIMERO sugerir con amabilidad que prueben desloguear y volver a loguear la cuenta de DataliveTV
     * Si el TV Box NO da imagen en la pantalla: sugerir que prueben chequear el cable HDMI (y que el TV Box esté encendido con luz azul)
     * Si el TV Box NO da luces (está totalmente apagado): sugerir que prueben chequear el cable de alimentación / transformador
   - Ejemplo: 'No te preocupes, ya enseguida lo solucionamos. Primero prueben desloguear y volver a loguear la cuenta de DataliveTV, si el TV Box no da imagen probá chequear el cable HDMI y si no da luces probá chequear el cable de alimentación. Si les tira algún error pasanos foto o screenshot para analizarlo'
11. COMANDA DUPLICADA:
   - 'No te preocupes, prueben eliminar la segunda comanda sin problema porque con la primera ya queda registrado correctamente el pedido'
12. PROVEEDOR DE SISTEMA:
   - Nuestro único proveedor de software gastronómico es Datalive (JAMAS menciones a Maxirest)
13. ZONAS DE DELIVERY O MAPAS:
   - Si piden modificar, ampliar, achicar o cambiar zonas de delivery o mapas de reparto, SIEMPRE pedir la confirmación/autorización de su supervisor (Damaris, Lidya, Selene, Martín Sastre, Elizabeth Colman o Evelyn Cedrón) antes de realizar cualquier cambio: 'Para hacer cambios en las zonas de delivery o mapas necesitamos primero la confirmación de tu supervisor, pedile porfa que nos autorice por acá y ya enseguida lo modificamos'
14. COMPORTAMIENTO SEGUN EL GRUPO O CHAT PRIVADO (Y LISTA DE SUPERVISORAS DE TIENDA):
   - Las supervisoras/es de tienda son: Damaris, Lidya, Selene, Martín Sastre, Elizabeth Colman y Evelyn Cedrón
   - GRUPO PRINCIPAL DE OPERACIONES / PROCESOS ('Procesos - Mi Gusto' u 'Operaciones'):
     * Si nos arroba directamente una SUCURSAL: respondé dejando asentado que se tomó el pedido/caso y que ya les hablamos por privado para resolverlo (ej: 'Buenas, ahi tomamos el caso, no te preocupes que ya te escribimos por privado para solucionarlo')
     * Si nos arroba una SUPERVISORA DE TIENDA (Damaris, Lidya, Selene, Martín Sastre, Elizabeth Colman o Evelyn Cedrón, avisando por una sucursal o citando el reclamo de una tienda): respondé dejando asentado que tomamos el caso y que ya nos comunicamos por privado DIRECTAMENTE CON LA SUCURSAL para resolverlo (ej: 'Buenas, ahi tomamos el caso y ya le escribimos por privado a la sucursal para solucionarlo')
   - CUALQUIER OTRO GRUPO (que no sea Operaciones/Procesos): respondé SIEMPRE dejando asentado que se toma el caso y que ya lo estamos viendo/revisando con tono humilde y servicial. Ejemplo: 'Buenas, ahi tomamos el caso, no te preocupes que ya enseguida lo solucionamos'
   - CHAT PRIVADO (1 a 1): mantené una conversación continua, acertada, humilde y super servicial. Guiá paso a paso diciendo 'probá...', 'intentemos...', 'prueben...' y pedí screenshot/foto del error cuando sea de comanderas, pantallas o sistema de ventas hasta que el técnico de guardia tome el celular y continúe manualmente
15. TRATO ESPECIAL DE AMIGOS CON MARIA SALAZAR ('MARI') Y ALEXANDRA RAMIREZ ('ALE'):
   - Si quien nos escribe es María Salazar (Maria Salazar) o Alexandra Ramírez (Alexandra Ramirez), ellas son amigas de confianza y NO se les habla como a un usuario común
   - A María Salazar llamala siempre 'Mari' y hablale en tono bien de amigos (ej: 'Dale Mari, no te preocupes, enseguida lo hacemos', 'Buenas Mari, ya lo vemos y te aviso')
   - A Alexandra Ramírez llamala siempre 'Ale' y hablale en tono bien de amigos (ej: 'Dale Ale, ya lo vemos y te aviso', 'Dale Ale, no te preocupes, enseguida lo hacemos')
`;

async function getGeminiAcknowledgement(incomingText = '', branchName = '', customPrompt = '', customApiKey = '') {
  const apiKey = resolveActiveApiKey(customApiKey);
  if (!apiKey) return null;

  try {
    const ai = getGenAIClient(apiKey);
    const learnedBlock = buildLearnedContextPrompt(incomingText);
    const baseSys = customPrompt && customPrompt.trim().length > 20 
      ? `${customPrompt}\n\nIMPORTANTE: NUNCA uses signos de apertura (¡ o ¿) ni puntos finales. Sé conciso (1-2 oraciones cortas)`
      : GEMINI_SYSTEM_INSTRUCTION;
    const systemInstruction = baseSys + learnedBlock;

    const promptContext = branchName && branchName !== 'No especificada'
      ? `Sucursal identificada: ${branchName}`
      : `Sucursal: NO identificada (el usuario aún no dijo de qué local escribe)`;

    const prompt = `${promptContext}\nMensaje de la sucursal: "${incomingText}"\nGenera una respuesta resolutiva, experta y natural en 1 o 2 oraciones sin punto final:`;
    
    const candidateModels = getOrderedCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const model = ai.getGenerativeModel({ model: modelName, systemInstruction });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 7000));
        const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
        if (result && result.response) {
          const text = cleanHumanText(result.response.text());
          if (text) return text;
        }
      } catch (e) {
        console.warn(`[Gemini Ack Retry] ${modelName} falló: ${e.message}`);
      }
    }
  } catch (err) {
    console.warn('[Gemini AI Warning] No se pudo obtener respuesta de Gemini, usando fallback humano:', err.message);
  }
  return null;
}

// ==========================================
// 8. PLAN COMPLETO DE RESPUESTA EN GRUPO
// ==========================================
/**
 * Genera el paquete completo de mensajes a enviar al grupo cuando arroban a sistemas:
 * - Mensaje 1: Saludo contextual
 * - Mensaje 2: Confirmación de revisión (vía Gemini si está disponible en .env, sino fallback humano)
 */
async function getGuardiaMentionResponse(context = {}) {
  const { incomingText = '', chatTitle = '', customPrompt = '', customApiKey = '' } = context;

  const detectedBranch = detectBranch(incomingText, chatTitle);

  const msg1Text = getRandomGreeting();
  // Intenta consultar a Gemini con el prompt resolutivo; si no, usa el acuse estándar de fallback
  const geminiText = await getGeminiAcknowledgement(incomingText, detectedBranch, customPrompt, customApiKey);
  const msg2Text = geminiText || getRandomAcknowledgement();

  // El bot responde los 2 mensajes humanos: Saludo + Respuesta resolutiva / confirmación
  const messages = [
    {
      text: msg1Text,
      isReply: true, // Cita el mensaje original
      delayBefore: 2000, // Pausa de lectura inicial
      typingDuration: 2500
    },
    {
      text: msg2Text,
      isReply: false, // Mensaje separado en el chat
      delayBefore: 1800, // Pausa entre mensajes
      typingDuration: 3500
    }
  ];

  return {
    messages,
    detectedBranch: detectedBranch || 'No especificada',
    summaryText: `${msg1Text} | ${msg2Text}`
  };
}


// ==========================================
// 8.5. CLIENTE GEMINI SINGLETON, BALANCEADOR INTELIGENTE Y MEMORIA LRU
// ==========================================
const chatMemory = new Map(); // chatId -> { messages: [], lastUsed: number }
const MAX_CHAT_SESSIONS = 150;
let cachedGenAIInstance = null;
let cachedApiKey = null;

// Salud dinámica de modelos para evitar demoras de 503
const modelHealth = new Map([
  ['gemini-3.1-flash-lite', { cooldownUntil: 0 }],
  ['gemini-3.5-flash-lite', { cooldownUntil: 0 }],
  ['gemini-3.5-flash', { cooldownUntil: 0 }]
]);

function resolveActiveApiKey(customApiKey = '') {
  if (customApiKey && customApiKey.trim()) return customApiKey.trim();
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) return process.env.GEMINI_API_KEY.trim();
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GEMINI_API_KEY\s*=\s*([^\r\n#]+)/);
      if (match && match[1]) {
        process.env.GEMINI_API_KEY = match[1].trim();
        return process.env.GEMINI_API_KEY;
      }
    }
  } catch (_) {}
  return '';
}

function getGenAIClient(apiKey) {
  if (!apiKey) return null;
  if (cachedGenAIInstance && cachedApiKey === apiKey) {
    return cachedGenAIInstance;
  }
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  cachedGenAIInstance = new GoogleGenerativeAI(apiKey);
  cachedApiKey = apiKey;
  return cachedGenAIInstance;
}

function getOrderedCandidateModels() {
  const now = Date.now();
  const all = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];
  // Primero los modelos que no están en penalización por 503/timeout
  const healthy = all.filter(m => (modelHealth.get(m)?.cooldownUntil || 0) <= now);
  const cooling = all.filter(m => (modelHealth.get(m)?.cooldownUntil || 0) > now);
  return [...healthy, ...cooling];
}

function markModelFailure(modelName) {
  // Penalizar por 2 minutos si dio 503 o timeout para que las siguientes consultas vayan directo al modelo rápido
  modelHealth.set(modelName, { cooldownUntil: Date.now() + 2 * 60 * 1000 });
}

function markModelSuccess(modelName) {
  modelHealth.set(modelName, { cooldownUntil: 0 });
}

function getChatHistory(chatId) {
  if (!chatMemory.has(chatId)) {
    // Limpieza LRU si supera el máximo de sesiones en RAM
    if (chatMemory.size >= MAX_CHAT_SESSIONS) {
      let oldestKey = null;
      let oldestTime = Infinity;
      for (const [k, v] of chatMemory.entries()) {
        if (v.lastUsed < oldestTime) {
          oldestTime = v.lastUsed;
          oldestKey = k;
        }
      }
      if (oldestKey) chatMemory.delete(oldestKey);
    }
    chatMemory.set(chatId, { messages: [], lastUsed: Date.now() });
  }
  const session = chatMemory.get(chatId);
  session.lastUsed = Date.now();
  return session.messages;
}

function addToChatHistory(chatId, role, text) {
  if (!chatId || !text) return;
  const history = getChatHistory(chatId);
  // GoogleGenerativeAI exige que los roles alternen ('user' -> 'model') y que el primero sea 'user'
  if (history.length === 0 && role !== 'user') {
    return;
  }
  if (history.length > 0 && history[history.length - 1].role === role) {
    // Si el último turno es del mismo rol, concatenamos de forma limpia para nunca romper el contrato de Gemini
    history[history.length - 1].parts[0].text += '\n' + text;
  } else {
    history.push({ role, parts: [{ text }] });
  }
  // Mantener los últimos 16 turnos (pares completos user/model)
  while (history.length > 16) {
    history.shift();
  }
  // Asegurar que siempre empiece con 'user' tras el recorte
  while (history.length > 0 && history[0].role !== 'user') {
    history.shift();
  }
}

/**
 * Detecta si el grupo es el grupo principal de Operaciones / Procesos ("Procesos - Mi Gusto").
 */
function isMainOperationsGroup(chatTitle = '') {
  const norm = normalizeText(chatTitle);
  return norm.includes('procesos') || norm.includes('operaciones');
}

// ==========================================
// 8.6. CONTROL DE INTERVENCIÓN HUMANA Y SESIONES ACTIVAS DE CONVERSACIÓN CONTINUA
// ==========================================
/**
 * Cuando un técnico responde manualmente desde el celular de guardia (msg.fromMe),
 * el bot le cede el control de esa conversación (en privado o en ese grupo) para no pisarse con el humano,
 * mientras sigue registrando y aprendiendo de todo lo que el técnico responde.
 * Mientras ningún humano intervenga desde el celu de la guardia, el bot mantiene la conversación
 * continua automáticamente (incluso cuando la persona repregunta sin volver a arrobar @Sistemas).
 */
const manualTakeoverChats = new Map(); // chatId -> timestamp of last human manual message
const HUMAN_TAKEOVER_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas de ventana de conversación manual en privado
const GROUP_TAKEOVER_DURATION_MS = 25 * 60 * 1000; // 25 minutos en grupos cuando interviene el humano desde el celu de guardia

// Seguimiento de hilos activos donde el bot ya está conversando con un usuario (para que no tengan que arrobar en cada repregunta)
const activeBotConversations = new Map(); // chatId -> { senderIds: Set<string>, lastActivityMs: number }
const ACTIVE_BOT_THREAD_MS = 30 * 60 * 1000; // 30 minutos de charla continua activa

function startOrRefreshBotConversation(chatId = '', senderId = '') {
  if (!chatId) return;
  const cleanSender = (senderId || '').split('@')[0];
  let entry = activeBotConversations.get(chatId);
  if (!entry) {
    entry = { senderIds: new Set(), lastActivityMs: Date.now() };
    activeBotConversations.set(chatId, entry);
  }
  if (cleanSender) entry.senderIds.add(cleanSender);
  entry.lastActivityMs = Date.now();
}

function isConversationActiveForSender(chatId = '', senderId = '') {
  if (!chatId) return false;
  if (isChatUnderHumanControl(chatId)) return false;
  const entry = activeBotConversations.get(chatId);
  if (!entry) return false;
  if (Date.now() - entry.lastActivityMs > ACTIVE_BOT_THREAD_MS) {
    activeBotConversations.delete(chatId);
    return false;
  }
  // Una vez iniciada la conversación con el bot en ese chat, cualquier repregunta en ese hilo continúa la charla
  // hasta que alguien intervenga manualmente desde el celular de la guardia (msg.fromMe)
  return true;
}

function clearBotConversation(chatId = '') {
  if (!chatId) return;
  activeBotConversations.delete(chatId);
}

function markHumanTakeover(chatId = '') {
  if (!chatId) return;
  manualTakeoverChats.set(chatId, Date.now());
  activeBotConversations.delete(chatId);
}

function clearHumanTakeover(chatId = '') {
  if (!chatId) return;
  manualTakeoverChats.delete(chatId);
}

function isChatUnderHumanControl(chatId = '') {
  if (!chatId) return false;
  if (!manualTakeoverChats.has(chatId)) return false;
  const lastManualTime = manualTakeoverChats.get(chatId);
  const ttl = chatId.endsWith('@g.us') ? GROUP_TAKEOVER_DURATION_MS : HUMAN_TAKEOVER_DURATION_MS;
  if (Date.now() - lastManualTime >= ttl) {
    manualTakeoverChats.delete(chatId);
    return false;
  }
  return true;
}

// ==========================================
// 8.7. DETECCIÓN INTELIGENTE SUPERVISORA DE TIENDA VS SUCURSAL EN GRUPOS
// ==========================================
/**
 * Buffer por grupo de los últimos mensajes recibidos (inclusive los que NO nos arrobaron).
 * Esto permite que cuando una sucursal reporta un problema sin arrobarnos y luego una
 * supervisora nos arroba (citando o sin citar), el bot sepa exactamente cuál fue la sucursal
 * que reportó el problema y le escriba por privado a la sucursal, NUNCA a la supervisora.
 */
const recentGroupMessages = new Map(); // groupChatId -> Array<{ senderId, senderName, text, detectedBranch, timestamp, isSupervisor }>

// Lista oficial de Supervisoras/es de Tienda de Mi Gusto
const SUPERVISORAS_TIENDA = [
  'damaris',
  'lidya',
  'lidia',
  'selene',
  'martin sastre',
  'sastre',
  'elizabeth colman',
  'elizabeth',
  'colman',
  'evelyn cedron',
  'evelyn',
  'cedron'
];

function isKnownSupervisorRole(senderName = '', text = '') {
  const nameNorm = normalizeText(senderName);
  const textNorm = normalizeText(text);

  // 0. Coincidencia directa con la lista oficial de supervisoras de tienda (Damaris, Lidya, Selene, Martín Sastre, Elizabeth Colman, Evelyn Cedrón)
  for (const sup of SUPERVISORAS_TIENDA) {
    const regex = new RegExp(`\\b${sup}\\b`, 'i');
    if (regex.test(nameNorm)) {
      return true;
    }
  }

  // 1. El nombre del contacto indica rol de supervisión / operaciones / coordinación
  if (/\b(supervis\w*|operaciones|auditor\w*|coordinad\w*|gerent\w*|regional|lider|jefe)\b/i.test(nameNorm)) {
    return true;
  }

  // 2. El texto habla en tercera persona pidiendo asistir a una tienda ("ayuden a", "escribanle a", "fijense lo de", "los chicos de", "tienen problema en")
  if (/\b(ayud\w*\s+a|escrib\w*\s+a|comuniqu\w*\s+con|habl\w*\s+con|vean\s+lo\s+de|ven\s+lo\s+de|fijense\s+(lo\s+de|en|esto|arriba)|los\s+chicos\s+de|a\s+la\s+sucursal|al\s+local|tienen\s+problem\w*|no\s+les\s+(anda|funciona|imprime|aparece)|estan\s+sin\s+sistema)\b/i.test(textNorm)) {
    return true;
  }

  // 3. El mensaje es únicamente el arroba o un llamado corto a mirar lo anterior (ej: "@sistemas", "@sistemas chicos ven esto porfa?")
  const stripped = textNorm
    .replace(/@\d{6,18}/g, '')
    .replace(/@(sistemas|guardia)/g, '')
    .replace(/\b(hola|buenas|buen\s+dia|buenas\s+tardes|buenas\s+noches|chicos|che|porfa|por\s+favor|gracias|fijense|vean|ven|miren|esto|arriba|aca|ahi)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (stripped.length <= 6) {
    return true;
  }

  return false;
}

function recordGroupMessageContext(groupChatId, { senderId, senderName, text }) {
  if (!groupChatId || !senderId || !text) return;
  const clean = text.trim();
  if (!clean) return;

  if (!recentGroupMessages.has(groupChatId)) {
    recentGroupMessages.set(groupChatId, []);
  }
  const list = recentGroupMessages.get(groupChatId);
  const branch = detectBranch(clean, senderName);
  const supervisorFlag = isKnownSupervisorRole(senderName, clean);

  list.unshift({
    senderId,
    senderName: senderName || senderId.split('@')[0],
    text: clean,
    detectedBranch: branch,
    isSupervisor: supervisorFlag,
    timestamp: Date.now()
  });

  if (list.length > 30) {
    list.pop();
  }
}

/**
 * Resuelve quién es el destinatario real del soporte cuando arroban a la guardia en un grupo:
 * - Si arrobó directamente la sucursal: devuelve { isSupervisor: false, targetSenderId: mentionSenderId, ... }
 * - Si arrobó una supervisora de tienda (citando el mensaje de la sucursal, o arrobando después de que la sucursal escribió,
 *   o pidiendo que asistamos a una sucursal): devuelve { isSupervisor: true, targetSenderId: <JID de la sucursal>, ... }
 */
function resolveGroupIncidentTarget({
  groupChatId,
  mentionSenderId,
  mentionSenderName,
  incomingText,
  quotedMsgData = null
}) {
  const branchInMention = detectBranch(incomingText, '');
  const branchInSenderName = detectBranch('', mentionSenderName);

  // CASO 1: La supervisora citó (Reply) el mensaje de otra persona (la sucursal) al arrobarnos
  if (quotedMsgData && quotedMsgData.senderId && quotedMsgData.senderId !== mentionSenderId) {
    const quotedBranch =
      detectBranch(quotedMsgData.text || '', quotedMsgData.senderName || '') ||
      branchInMention ||
      'No especificada';
    return {
      isSupervisor: true,
      targetSenderId: quotedMsgData.senderId,
      targetSenderName: quotedMsgData.senderName || (quotedBranch !== 'No especificada' ? `Sucursal ${quotedBranch}` : 'Sucursal'),
      detectedBranch: quotedBranch,
      effectiveProblemText: quotedMsgData.text
        ? `${quotedMsgData.text} (Reportado en grupo y derivado por ${mentionSenderName}: "${incomingText}")`
        : incomingText
    };
  }

  const list = recentGroupMessages.get(groupChatId) || [];
  const now = Date.now();
  // Mensajes recientes (últimos 45 min) de OTROS participantes que no sean supervisores
  const otherRecentMsgs = list.filter(
    m => m.senderId !== mentionSenderId && !m.isSupervisor && now - m.timestamp < 45 * 60 * 1000
  );

  const looksLikeSupervisor = isKnownSupervisorRole(mentionSenderName, incomingText);

  // CASO 2: Quien nos arroba parece ser una supervisora (o solo puso "@sistemas" para que leamos arriba)
  if (looksLikeSupervisor) {
    // 2a. Si la supervisora nombró una sucursal específica (ej: "@sistemas fijense lo de Urquiza")
    if (branchInMention) {
      const normBranch = normalizeText(branchInMention);
      const matchedFromGroup = otherRecentMsgs.find(
        m =>
          (m.detectedBranch && normalizeText(m.detectedBranch) === normBranch) ||
          normalizeText(m.senderName).includes(normBranch) ||
          normalizeText(m.text).includes(normBranch)
      );

      if (matchedFromGroup) {
        return {
          isSupervisor: true,
          targetSenderId: matchedFromGroup.senderId,
          targetSenderName: matchedFromGroup.senderName,
          detectedBranch: branchInMention,
          effectiveProblemText: `${matchedFromGroup.text} (${incomingText})`
        };
      }

      // La supervisora nombró a la sucursal pero la sucursal no había escrito antes en el grupo:
      // targetSenderId queda en null para NO hablarle a la supervisora y buscar el chat privado de la sucursal por nombre
      return {
        isSupervisor: true,
        targetSenderId: null,
        targetSenderName: `Sucursal ${branchInMention}`,
        detectedBranch: branchInMention,
        effectiveProblemText: incomingText
      };
    }

    // 2b. Si la supervisora NO nombró sucursal (ej: puso solo "@sistemas" o "@sistemas chicos ven esto porfa"),
    // tomamos el mensaje inmediato anterior de una sucursal en el grupo
    if (otherRecentMsgs.length > 0) {
      const latestBranchMsg = otherRecentMsgs[0];
      const resolvedBranch = latestBranchMsg.detectedBranch || detectBranch(latestBranchMsg.text, latestBranchMsg.senderName) || 'No especificada';
      return {
        isSupervisor: true,
        targetSenderId: latestBranchMsg.senderId,
        targetSenderName: latestBranchMsg.senderName,
        detectedBranch: resolvedBranch,
        effectiveProblemText: `${latestBranchMsg.text} (${incomingText})`
      };
    }

    // Si es supervisora pero no hay mensaje previo ni sucursal detectada, igual marcamos isSupervisor=true para no abrirle privado a ella por error
    return {
      isSupervisor: true,
      targetSenderId: null,
      targetSenderName: 'Sucursal',
      detectedBranch: 'No especificada',
      effectiveProblemText: incomingText
    };
  }

  // CASO 3: Nos arrobó directamente la sucursal
  return {
    isSupervisor: false,
    targetSenderId: mentionSenderId,
    targetSenderName: mentionSenderName,
    detectedBranch: branchInMention || branchInSenderName || 'No especificada',
    effectiveProblemText: incomingText
  };
}

/**
 * Detecta si el contacto que escribe es María Salazar ("Mari") o Alexandra Ramírez ("Ale")
 * para activar automáticamente el trato cercano de amigos.
 */
function detectCloseFriend(senderName = '') {
  const norm = normalizeText(senderName);
  if (!norm) return null;
  if (norm.includes('maria salazar') || norm.includes('mari salazar') || /\bsalazar\b/.test(norm)) {
    return { isFriend: true, nickname: 'Mari', fullName: 'María Salazar' };
  }
  if (norm.includes('alexandra ramirez') || norm.includes('ale ramirez') || /\balexandra\b/.test(norm)) {
    return { isFriend: true, nickname: 'Ale', fullName: 'Alexandra Ramírez' };
  }
  return null;
}

/**
 * Genera una respuesta continua conversacional con Gemini recordando el hilo del chat y lo aprendido.
 */
async function getContinuousChatResponse({
  chatId,
  incomingText,
  senderName,
  chatTitle,
  isGroup,
  isSupervisor = false,
  detectedBranchOverride = '',
  customPrompt,
  customApiKey
}) {
  const apiKey = resolveActiveApiKey(customApiKey);
  if (!apiKey) return null;

  try {
    const ai = getGenAIClient(apiKey);
    const learnedBlock = buildLearnedContextPrompt(incomingText);
    const baseSys = customPrompt && customPrompt.trim().length > 20
      ? `${customPrompt}\n\nIMPORTANTE: NUNCA uses signos de apertura (¡ o ¿) ni puntos finales. Sé conciso (1-2 oraciones cortas). Hablá de forma fluida y natural.`
      : GEMINI_SYSTEM_INSTRUCTION;
    const systemInstruction = baseSys + learnedBlock;

    const branchName = detectedBranchOverride || detectBranch(incomingText, `${senderName} ${chatTitle}`) || 'No especificada';
    const history = getChatHistory(chatId);
    const isMainOps = isGroup && isMainOperationsGroup(chatTitle);
    const isFollowUpTurn = history.length > 0;
    const friendInfo = detectCloseFriend(senderName);
    const friendNote = friendInfo
      ? ` (NOTA ESPECIAL DE AMIGOS: Quien te escribe es ${friendInfo.fullName}, que es amiga de mucha confianza. Respondé SIEMPRE en tono bien de amigos, llamándola "${friendInfo.nickname}", usando expresiones como "Dale ${friendInfo.nickname}, ya lo vemos y te aviso" o "Dale ${friendInfo.nickname}, no te preocupes, enseguida lo hacemos")`
      : '';

    let groupInstruction = '';
    if (isMainOps) {
      if (isSupervisor) {
        const targetLabel = branchName && branchName !== 'No especificada' ? `la sucursal ${branchName}` : 'la sucursal';
        groupInstruction = ` (NOTA OBLIGATORIA: Estás en el grupo principal "Procesos - Mi Gusto" y quien nos arrobó es una SUPERVISORA DE TIENDA avisándonos por ${targetLabel}. Respondé dejando asentado que tomamos el caso y que ya nos comunicamos por privado DIRECTAMENTE CON LA SUCURSAL para resolverlo, ej: "Buenas, ahi tomamos el caso y ya le escribimos por privado a la sucursal para resolverlo")`;
      } else {
        groupInstruction = ' (NOTA OBLIGATORIA: Estás en el grupo principal de Operaciones "Procesos - Mi Gusto" y nos escribió la sucursal. Respondé dejando asentado que se tomó el pedido/caso y que ya le vamos a hablar por privado para resolverlo, para no llenar el grupo de mensajes)';
      }
    } else if (isGroup) {
      if (isFollowUpTurn) {
        groupInstruction = ' (NOTA: Estás continuando la conversación en el grupo con esta persona. Respondé directamente a su repregunta o duda con total seguridad, inteligencia y naturalidad, sin volver a saludar ni repetir que tomamos el caso. Empezá siempre con la primera letra en mayúscula y recordá que AnyDesk solo se usa para comanderas)';
      } else {
        groupInstruction = ' (NOTA OBLIGATORIA: Estás en un grupo que NO es operaciones. Respondé dejando asentado que se toma el caso y que ya lo estamos viendo/revisando, sumando el paso o solución si aplica. Empezá siempre con la primera letra en mayúscula)';
      }
    } else {
      groupInstruction = isFollowUpTurn
        ? ' (NOTA: Estás continuando la conversación en chat privado 1 a 1. Respondé directamente a lo que te acaba de decir de forma fluida, acertada y servicial sin volver a saludar. Empezá siempre con la primera letra en mayúscula)'
        : ' (NOTA: Estás en chat privado 1 a 1. Respondé con inmediatez de forma acertada, inteligente y super servicial para mantener la conversación fluida y adelantar el diagnóstico o solución hasta que el técnico tome el celular. Empezá siempre con la primera letra en mayúscula)';
    }

    const userMessage = isGroup
      ? `[${senderName} en grupo "${chatTitle}" - Sucursal: ${branchName}${groupInstruction}${friendNote}]: ${incomingText}`
      : `[${senderName} en privado - Sucursal: ${branchName}${groupInstruction}${friendNote}]: ${incomingText}`;

    const candidateModels = getOrderedCandidateModels();
    let result = null;

    for (const modelName of candidateModels) {
      let timerId = null;
      try {
        const model = ai.getGenerativeModel({ model: modelName, systemInstruction });
        const chat = model.startChat({ history: history.map(h => ({ role: h.role, parts: [{ text: h.parts[0].text }] })) });
        const timeoutPromise = new Promise((_, reject) => {
          timerId = setTimeout(() => reject(new Error('Gemini timeout')), 5500);
        });
        result = await Promise.race([chat.sendMessage(userMessage), timeoutPromise]);
        if (timerId) clearTimeout(timerId);
        if (result && result.response) {
          markModelSuccess(modelName);
          break;
        }
      } catch (errRetry) {
        if (timerId) clearTimeout(timerId);
        markModelFailure(modelName);
        console.warn(`[Gemini Balanceador] ${modelName} demoró o dio 503 (${errRetry.message}). Saltando al siguiente...`);
      }
    }

    if (!result || !result.response) return null;
    const text = cleanHumanText(result.response.text());

    if (text) {
      addToChatHistory(chatId, 'user', userMessage);
      addToChatHistory(chatId, 'model', text);
      return { text, detectedBranch: branchName };
    }
  } catch (err) {
    console.warn('[Gemini Continuous Warning]:', err.message);
  }
  return null;
}

// ==========================================
// 9. MOTOR DE AUTO-ENTRENAMIENTO Y APRENDIZAJE CONTINUO (RAM CACHE + DEBOUNCED I/O)
// ==========================================
const LEARNED_MEMORY_PATH = path.join(__dirname, 'learned_memory.json');
const lastIncomingPerChat = new Map();
const recentBotOutputs = new Set();
const recentBotOutputsNormalized = new Set();

// Caché en memoria RAM para evitar lecturas de disco en cada mensaje
let inMemoryLearnedCache = null;
let saveDebounceTimer = null;

const STOPWORDS_ES = new Set([
  'hola', 'buenas', 'buen', 'tardes', 'noches', 'chicos', 'como', 'estan', 'todo', 'bien',
  'para', 'pero', 'porque', 'cuando', 'donde', 'este', 'esta', 'estos', 'estas', 'tiene',
  'tienen', 'hace', 'hacer', 'puede', 'pueden', 'desde', 'hasta', 'entre', 'sobre', 'sistemas',
  'guardia', 'favor', 'gracias', 'dale', 'joya', 'genial', 'local', 'sucursal'
]);

function normalizeAlphaNum(str = '') {
  return normalizeText(str).replace(/[^a-z0-9]/g, '');
}

function extractSignificantTokens(str = '') {
  return normalizeText(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS_ES.has(w));
}

function registerBotOutput(text = '', chatId = '') {
  if (!text) return;
  const clean = text.trim();
  const singleSpace = clean.replace(/\s+/g, ' ').trim();
  const alphaNum = normalizeAlphaNum(clean);
  recentBotOutputs.add(clean);
  recentBotOutputs.add(singleSpace);
  if (alphaNum) recentBotOutputsNormalized.add(alphaNum);

  // También registrar cada línea individual por si se envió en burbujas
  const lines = clean.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const lineAlphaNums = [];
  for (const line of lines) {
    recentBotOutputs.add(line);
    const lAlpha = normalizeAlphaNum(line);
    if (lAlpha) {
      recentBotOutputsNormalized.add(lAlpha);
      lineAlphaNums.push(lAlpha);
    }
  }

  setTimeout(() => {
    recentBotOutputs.delete(clean);
    recentBotOutputs.delete(singleSpace);
    if (alphaNum) recentBotOutputsNormalized.delete(alphaNum);
    for (const line of lines) recentBotOutputs.delete(line);
    for (const lAlpha of lineAlphaNums) recentBotOutputsNormalized.delete(lAlpha);
  }, 60000);
}

function isBotGeneratedOutput(text = '', chatId = '') {
  if (!text) return false;
  const clean = text.trim();
  const singleSpace = clean.replace(/\s+/g, ' ').trim();
  const alphaNum = normalizeAlphaNum(clean);
  if (recentBotOutputs.has(clean) || recentBotOutputs.has(singleSpace)) return true;
  if (alphaNum && recentBotOutputsNormalized.has(alphaNum)) return true;
  if (
    clean.startsWith('🚨 *Alerta Guardia') ||
    clean.startsWith('🤖 *Estado del Bot') ||
    clean.startsWith('🛡️ *Guardia Actual') ||
    clean.startsWith('📊 *Reporte Semanal') ||
    clean.startsWith('✅') ||
    clean.startsWith('🧹') ||
    clean.startsWith('🛠️') ||
    clean.startsWith('🧠') ||
    clean.startsWith('🔔 *Rotación')
  ) {
    return true;
  }
  return false;
}

/**
 * Detecta si un mensaje corto es solo un acuse o saludo ("ok", "gracias", "dale", "buenas, como va?")
 * para no pisar la consulta real del usuario ni guardar un simple saludo como si fuera la solución técnica.
 */
function isTrivialAckOrGreeting(text = '') {
  const stripped = normalizeText(text)
    .replace(/@\d{6,18}/g, '')
    .replace(/@(sistemas|guardia)/g, '')
    .replace(/\b(hola|buenas|buen\s+dia|buenas\s+tardes|buenas\s+noches|como\s+va|como\s+estan|como\s+andas|que\s+tal|todo\s+bien|ok|oka|dale|gracias|muchas\s+gracias|genial|joya|buenisimo|perfecto|listo|si|ahi\s+va|ahi\s+lo\s+veo|ahi\s+lo\s+miro|bancame\s+un\s+toque|chicos|che)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return stripped.length < 4;
}

function recordIncomingForLearning(chatId, text, senderName = 'Usuario') {
  if (!chatId || !text) return;
  const clean = text.replace(/@\d{6,18}/g, '').replace(/@(sistemas|guardia)/gi, '').trim();
  if (clean.startsWith('#') || clean.length < 4) return;

  // Si ya hay una consulta real guardada hace menos de 30 min y el nuevo mensaje es solo "ok gracias" o "dale",
  // no pisamos la consulta original para que cuando Facu o Ramiro respondan se asocie al problema real
  if (lastIncomingPerChat.has(chatId)) {
    const prev = lastIncomingPerChat.get(chatId);
    if (Date.now() - prev.timestamp < 30 * 60 * 1000 && isTrivialAckOrGreeting(clean)) {
      return;
    }
  }

  // Limpiar entradas viejas si el mapa crece
  if (lastIncomingPerChat.size > 200) {
    const firstKey = lastIncomingPerChat.keys().next().value;
    if (firstKey) lastIncomingPerChat.delete(firstKey);
  }

  lastIncomingPerChat.set(chatId, {
    text: clean,
    senderName,
    timestamp: Date.now()
  });
}

function readLearnedMemory() {
  if (inMemoryLearnedCache) {
    return inMemoryLearnedCache;
  }
  try {
    if (fs.existsSync(LEARNED_MEMORY_PATH)) {
      inMemoryLearnedCache = JSON.parse(fs.readFileSync(LEARNED_MEMORY_PATH, 'utf8'));
      if (!Array.isArray(inMemoryLearnedCache.stylePhrases)) inMemoryLearnedCache.stylePhrases = [];
      if (!Array.isArray(inMemoryLearnedCache.qaPairs)) inMemoryLearnedCache.qaPairs = [];
      return inMemoryLearnedCache;
    }
  } catch (e) {
    console.warn('[Auto-Learn] Error leyendo learned_memory.json:', e.message);
  }
  inMemoryLearnedCache = { stylePhrases: [], qaPairs: [] };
  return inMemoryLearnedCache;
}

function writeLearnedMemory(data) {
  inMemoryLearnedCache = data;
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    try {
      fs.writeFileSync(LEARNED_MEMORY_PATH, JSON.stringify(inMemoryLearnedCache, null, 2), 'utf8');
    } catch (e) {
      console.warn('[Auto-Learn] Error guardando learned_memory.json:', e.message);
    }
  }, 250);
}

/**
 * Registra una respuesta escrita manualmente por Facu o Ramiro para que el bot aprenda su vocabulario y soluciones.
 * Soporta respuestas enviadas en varias burbujas seguidas (las unifica dentro de una ventana de 2 minutos).
 */
function learnFromHumanReply(chatId, humanReplyText = '', quotedQuestionText = '', techName = 'Técnico') {
  const cleanReply = cleanHumanText(humanReplyText);
  // Ignorar respuestas muy cortas ("ok", "si", "dale") o comandos
  if (cleanReply.length < 6 || cleanReply.startsWith('#')) return false;
  if (isBotGeneratedOutput(humanReplyText, chatId) || isBotGeneratedOutput(cleanReply, chatId)) return false;

  const memory = readLearnedMemory();

  // 1. Guardar siempre en frases de estilo si aporta vocabulario/modismos nuevos de Facu o Ramiro
  const replyNorm = normalizeText(cleanReply);
  const alreadyInStyle = memory.stylePhrases.some(p => normalizeText(p) === replyNorm);
  if (!alreadyInStyle) {
    memory.stylePhrases.unshift(cleanReply);
    if (memory.stylePhrases.length > 85) memory.stylePhrases.pop();
  }

  // Si la burbuja fue únicamente un saludo inicial ("Buenas, como va?", "Ahi lo miro"),
  // aprendemos el modismo pero dejamos lista la pregunta en espera de la siguiente burbuja con la solución técnica
  if (isTrivialAckOrGreeting(cleanReply)) {
    writeLearnedMemory(memory);
    console.log(`[🧠 Auto-Entrenamiento] Saludo/modismo aprendido (${techName}): "${cleanReply}"`);
    return true;
  }

  // 2. Determinar a qué pregunta/incidente respondió Facu o Ramiro
  let questionContext = (quotedQuestionText || '')
    .replace(/@\d{6,18}/g, '')
    .replace(/@(sistemas|guardia)/gi, '')
    .trim();

  if (!questionContext && chatId && lastIncomingPerChat.has(chatId)) {
    const lastInc = lastIncomingPerChat.get(chatId);
    if (Date.now() - lastInc.timestamp < 60 * 60 * 1000) {
      questionContext = lastInc.text;
    }
  }

  if (questionContext && questionContext.length >= 4 && !isTrivialAckOrGreeting(questionContext)) {
    const qTokens = extractSignificantTokens(questionContext);
    // Buscar si ya existe una pregunta muy similar (>= 70% de tokens coincidentes)
    let existingIdx = -1;
    for (let i = 0; i < memory.qaPairs.length; i++) {
      const itemNorm = normalizeText(memory.qaPairs[i].question);
      if (itemNorm === normalizeText(questionContext)) {
        existingIdx = i;
        break;
      }
      if (qTokens.length >= 2) {
        const itemTokens = extractSignificantTokens(memory.qaPairs[i].question);
        const matches = qTokens.filter(t => itemTokens.includes(t)).length;
        const similarity = matches / Math.max(qTokens.length, itemTokens.length);
        if (similarity >= 0.70) {
          existingIdx = i;
          break;
        }
      }
    }

    const nowMs = Date.now();
    if (existingIdx !== -1) {
      const prevEntry = memory.qaPairs[existingIdx];
      const prevTimeMs = prevEntry.timestamp ? new Date(prevEntry.timestamp).getTime() : 0;
      const isMultiBubbleContinuation = (nowMs - prevTimeMs < 2 * 60 * 1000) &&
        !normalizeText(prevEntry.humanAnswer).includes(replyNorm);

      const combinedAnswer = isMultiBubbleContinuation
        ? `${prevEntry.humanAnswer}\n${cleanReply}`
        : cleanReply;

      const updatedEntry = {
        question: questionContext,
        humanAnswer: combinedAnswer,
        learnedBy: techName,
        timestamp: new Date().toISOString()
      };
      memory.qaPairs.splice(existingIdx, 1);
      memory.qaPairs.unshift(updatedEntry);
      console.log(`[🧠 Auto-Entrenamiento] Caso actualizado (${techName}): "${questionContext}" ➔ "${combinedAnswer.replace(/\n/g, ' | ')}"`);
    } else {
      const entry = {
        question: questionContext,
        humanAnswer: cleanReply,
        learnedBy: techName,
        timestamp: new Date().toISOString()
      };
      memory.qaPairs.unshift(entry);
      if (memory.qaPairs.length > 150) memory.qaPairs.pop();
      console.log(`[🧠 Auto-Entrenamiento] Nuevo caso aprendido (${techName}): "${questionContext}" ➔ "${cleanReply}"`);
    }
  } else {
    console.log(`[🧠 Auto-Entrenamiento] Expresión aprendida (${techName}): "${cleanReply}"`);
  }

  writeLearnedMemory(memory);
  return true;
}

/**
 * Construye el bloque de memoria aprendida más relevante para inyectar en el prompt de Gemini (0ms desde RAM).
 */
function buildLearnedContextPrompt(incomingText = '') {
  const memory = readLearnedMemory();
  if ((!memory.qaPairs || memory.qaPairs.length === 0) && (!memory.stylePhrases || memory.stylePhrases.length === 0)) {
    return '';
  }

  const queryTokens = extractSignificantTokens(incomingText);

  // Puntuar los pares Q&A por similitud semántica de palabras clave y frescura
  const scoredPairs = (memory.qaPairs || []).map((pair, idx) => {
    const pairTokens = extractSignificantTokens(pair.question);
    let keywordScore = 0;
    for (const qt of queryTokens) {
      if (pairTokens.some(pt => pt.includes(qt) || qt.includes(pt))) {
        keywordScore += 5;
      }
    }
    const recencyBonus = Math.max(0, (25 - idx) * 0.15);
    return { ...pair, keywordScore, score: keywordScore + recencyBonus };
  });

  scoredPairs.sort((a, b) => b.score - a.score);
  const directMatches = scoredPairs.filter(p => p.keywordScore >= 5).slice(0, 6);
  const recentGeneral = scoredPairs.filter(p => p.keywordScore < 5).slice(0, 5);
  const recentPhrases = (memory.stylePhrases || []).slice(0, 14);

  let block = '\n\nMEMORIA DE AUTO-ENTRENAMIENTO (SOLUCIONES Y EXPRESIONES REALES DE FACU Y RAMIRO):\n';
  block += 'Aprendé y replicá exactamente cómo respondemos nosotros (respetando siempre primera letra en mayúscula y sin punto final):\n';

  if (directMatches.length > 0) {
    block += '\nSOLUCIONES REALES NUESTRAS PARA CASOS SIMILARES A ESTA CONSULTA (PRIORIZAR ESTE CRITERIO):\n';
    for (const p of directMatches) {
      block += `- Cuando preguntaron: "${p.question}" ➔ Nosotros respondimos: "${p.humanAnswer.replace(/\n/g, ' / ')}"\n`;
    }
  }

  if (recentGeneral.length > 0) {
    block += '\nOtros casos resueltos recientemente por nosotros:\n';
    for (const p of recentGeneral) {
      block += `- Consulta: "${p.question}" ➔ Respuesta nuestra: "${p.humanAnswer.replace(/\n/g, ' / ')}"\n`;
    }
  }

  if (recentPhrases.length > 0) {
    block += '\nNuestro vocabulario y frases reales:\n';
    block += recentPhrases.map(f => `"${f}"`).join(' | ') + '\n';
  }

  return block;
}

/**
 * Detecta si el caso reportado es que no les aparece una promoción en el sistema/botonera
 * y el bot acaba de avisar que enseguida manda la actualización para corregir el error de visualización
 * (para que a los pocos segundos el bot envíe automáticamente el aviso de recargar con F5).
 */
function isPromoVisibilityIssue(incomingText = '', botReplyText = '') {
  const incNorm = normalizeText(incomingText);
  const repNorm = normalizeText(botReplyText);

  // Si la primera respuesta ya le dijo que toque F5, no hace falta mandar un segundo aviso duplicado de F5
  if (/\bf5\b/i.test(repNorm)) {
    return false;
  }

  const mentionsPromo = /\b(promo|promocion|promociones|mg\s*break)\b/i.test(incNorm) || /\b(promo|promocion)\b/i.test(repNorm);
  const mentionsMissingOrUpdate =
    /\b(no\s+(aparece|veo|se\s+ve|figura|sale|esta)|falta|botonera|visualizacion|actualizacion)\b/i.test(incNorm) ||
    /\b(actualizacion|visualizacion)\b/i.test(repNorm);

  return mentionsPromo && mentionsMissingOrUpdate;
}

module.exports = {
  capitalizeFirstLetter,
  isPromoVisibilityIssue,
  registerBotOutput,
  isBotGeneratedOutput,
  recordIncomingForLearning,
  learnFromHumanReply,
  readLearnedMemory,
  getContinuousChatResponse,
  addToChatHistory,
  isMainOperationsGroup,
  recordGroupMessageContext,
  resolveGroupIncidentTarget,
  startOrRefreshBotConversation,
  isConversationActiveForSender,
  clearBotConversation,
  markHumanTakeover,
  clearHumanTakeover,
  isChatUnderHumanControl,
  isWithinWorkingHours,
  shouldAlertTech,
  checkWeeklyAutoRotation,
  recordWeeklyAlert,
  checkBranchCooldown,
  detectBranch,
  getRandomGreeting,
  getRandomAcknowledgement,
  getGuardiaMentionResponse,
  checkGuardiaAssignment,
  processTechCommand,
  cleanChromiumCache,
  getActiveTechNumbers,
  getGuardiaState,
  setGuardiaState,
  TECNICOS
};
