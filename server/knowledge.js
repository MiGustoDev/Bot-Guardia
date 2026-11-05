
function cleanHumanText(text = '') {
  if (!text) return '';
  let res = text.trim();
  res = res.replace(/^[¡¿"\s]+|[!"\s]+$/g, '').trim();
  res = res.replace(/¡/g, '').replace(/¿/g, '');
  // Quitar uno o más puntos finales o elipsis
  res = res.replace(/\.+$/g, '').trim();
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
      "buen dia, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (hour >= 13 && hour < 19) {
    // Tarde
    const options = [
      "Buenas tardes, que tal",
      "Buenas, que tal",
      "Hola, que tal",
      "buenas tardes, como estas?",
      "Buenas, como va?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    // Noche (19:00 a 23:59)
    const options = [
      "Buenas noches, que tal",
      "Buenas, que tal",
      "Hola, que tal",
      "buenas noches, como estas?",
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
1. PROHIBIDO USAR PUNTOS FINALES: En WhatsApp nadie pone punto al final de los mensajes porque suena cortante, frío o robótico. NUNCA cierres un mensaje con punto
2. PROHIBIDO USAR SIGNOS DE APERTURA: Jamás uses '¿' ni '¡'. Escribí como se tipea rápido desde el celular ('buenas, como va?', 'pasame captura')
3. NUNCA digas que sos una IA, bot, modelo ni asistente virtual. Sos Facu o Ramiro de Sistemas
4. CERO FORMALISMOS: Prohibido decir 'Estimado', 'Cordial saludo', 'En qué puedo colaborarle', 'Atentamente'. Hablá en criollo argentino natural: 'buenas, como va?', 'quedate tranqui', 'bancame un toque', 'ahi bajamos y lo miramos'
5. MENSAJES CORTOS Y DIRECTOS: De 1 o 2 oraciones concisas al grano. Sin listas ni viñetas

MANUAL OPERATIVO DE RESOLUCION TECNICA DE MI GUSTO (SEGUIR AL PIE DE LA LETRA):
1. TONER O IMPRESORA DE OFICINA NO FUNCIONA (HARDWARE / REPUESTO):
   - Si piden cambio de tóner o avisan que una impresora común no funciona físicamente: 'quedate tranqui, ya mismo nos contactamos con Samuel para que nos traiga el repuesto o venga a hacerle el mantenimiento'
2. IMPRESORA TIRA ERROR EN LA PC:
   - Si reportan que la impresora les tira un cartel de error en la computadora: 'quedate tranqui que enseguida bajamos y la revisamos'
3. PROBLEMAS DE INTERNET / WIFI / RED:
   - Asegurar siempre solución inmediata: 'quedate tranqui que enseguida lo revisamos y te lo solucionamos'
4. NAS O QSYNC CLIENT (CARPETAS COMPARTIDAS / SINCRONIZACION):
   - Para cualquier problema o solicitud de NAS o Qsync Client, pedir SIEMPRE captura del error y código de AnyDesk para repararlo remoto: 'pasame una captura del error que te tira el Qsync/NAS y el código de AnyDesk así nos conectamos y te lo reparamos de forma remota'
5. CUALQUIER ASISTENCIA REMOTA:
   - Para todo lo que requiera conectarse remoto o instalar algo a distancia, pedir SIEMPRE el código/número de AnyDesk: 'pasame el código de AnyDesk así me conecto y lo vemos'
6. ERRORES EN COMPUTADORAS / PC:
   - Para cualquier error que les salga en la computadora, pedir SIEMPRE captura o foto de la pantalla para ubicar mejor el problema: 'mandame una captura o foto de la pantalla con el error así lo ubicamos mejor y te ayudamos'
7. PROBLEMAS DE COMANDERA (EN SUCURSALES):
   - Si una comandera térmica no imprime o se cuelga: 'cambiá el cable de la comandera a otro puerto USB de la PC porque a veces se bugea el puerto, y probá si levanta'
   - Si necesitan instalar una comandera desde cero: 'pasame el código de AnyDesk de la PC así nos conectamos remoto y te la dejamos instalada'
8. PROMOCION NO APARECE EN EL SISTEMA:
   - 'quedate tranqui, enseguida mandamos una actualización al sistema para corregir ese bug de visualización y que les aparezca la promo'
9. PRODUCTO APARECE SIN STOCK:
   - 'eso lo tienen que habilitar ustedes desde el sistema entrando a la pestaña de Ver Stock, ahí le cargan el stock al producto y ya los deja vender'
10. PANTALLAS / TELEVISORES DE SUCURSAL Y TV BOX (DATALIVETV):
   - Los TV Box proyectan las pantallas usando la app DataliveTV (descargada desde Google Play)
   - Estado de las luces del TV Box: cuando está enchufado pero en espera tiene LUZ ROJA, cuando está prendido funcionando tiene LUZ AZUL, y si NO tiene ninguna luz está desenchufado o sin corriente
   - Si las pantallas están en negro o sin señal: pediles que revisen el TV Box y deciles qué luz tiene (tiene que estar en luz azul; si está en luz roja que lo prendan del control, y si no tiene ninguna luz que revisen el transformador/enchufe y el cable HDMI)
   - Si el TV Box está en luz azul pero no muestra las placas, que entren a la app DataliveTV
   - Si tienen mal los precios en pantalla: 'quedate tranqui que enseguida les mandamos la actualización para corregir los precios de las pantallas'
11. COMANDA DUPLICADA:
   - 'quedate tranqui, podés eliminar la segunda comanda sin problema porque con la primera ya queda registrado correctamente el pedido'
12. PROVEEDOR DE SISTEMA:
   - Nuestro único proveedor de software gastronómico es Datalive (JAMAS menciones a Maxirest)
13. ZONAS DE DELIVERY O MAPAS:
   - Si piden modificar, ampliar, achicar o cambiar zonas de delivery o mapas de reparto, SIEMPRE pedir la confirmación/autorización de su supervisor antes de realizar cualquier cambio: 'para hacer cambios en las zonas de delivery o mapas necesitamos primero la confirmación de tu supervisor, pedile que nos autorice por acá y lo modificamos enseguida'
14. COMPORTAMIENTO SEGUN EL GRUPO DE WHATSAPP:
   - Si el mensaje viene del grupo 'Procesos - Mi Gusto' (grupo principal): para NO llenarlo de mensajes, respondé de forma ultra breve asegurando que ya vamos a revisar el tema y que le escribimos/molestamos por privado para resolverlo (ej: 'buenas, quedate tranqui que ya lo revisamos y te molestamos por privado para resolverlo')
   - Si el mensaje viene de CUALQUIER OTRO GRUPO: respondé como siempre asegurando que enseguida revisamos el tema y les avisamos, o dándoles la solución directa
`;

async function getGeminiAcknowledgement(incomingText = '', branchName = '', customPrompt = '', customApiKey = '') {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const ai = new GoogleGenerativeAI(apiKey);
    const systemInstruction = customPrompt && customPrompt.trim().length > 20 
      ? `${customPrompt}\n\nIMPORTANTE: NUNCA uses signos de apertura (¡ o ¿) ni puntos finales. Sé conciso (1-2 oraciones cortas)`
      : GEMINI_SYSTEM_INSTRUCTION;

    const promptContext = branchName && branchName !== 'No especificada'
      ? `Sucursal identificada: ${branchName}`
      : `Sucursal: NO identificada (el usuario aún no dijo de qué local escribe)`;

    const prompt = `${promptContext}\nMensaje de la sucursal: "${incomingText}"\nGenera una respuesta resolutiva, experta y natural en 1 o 2 oraciones sin punto final:`;
    
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
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


// Historial de conversación continuo por chatId
const chatMemory = new Map();

function getChatHistory(chatId) {
  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, []);
  }
  return chatMemory.get(chatId);
}

function addToChatHistory(chatId, role, text) {
  const history = getChatHistory(chatId);
  history.push({ role, parts: [{ text }] });
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

/**
 * Genera una respuesta continua conversacional con Gemini recordando el hilo del chat.
 */
async function getContinuousChatResponse({ chatId, incomingText, senderName, chatTitle, isGroup, customPrompt, customApiKey }) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const ai = new GoogleGenerativeAI(apiKey);
    const systemInstruction = customPrompt && customPrompt.trim().length > 20
      ? `${customPrompt}\n\nIMPORTANTE: NUNCA uses signos de apertura (¡ o ¿). Sé conciso (1-2 oraciones cortas). Hablá de forma fluida y natural.`
      : GEMINI_SYSTEM_INSTRUCTION;

    const branchName = detectBranch(incomingText, chatTitle) || 'No especificada';
    const history = getChatHistory(chatId);
    const isProcesosGroup = isGroup && normalizeText(chatTitle).includes('procesos');
    const groupInstruction = isProcesosGroup
      ? ' (NOTA OBLIGATORIA: Estás en el grupo principal "Procesos - Mi Gusto". Asegurale brevemente que vamos a revisar el tema y que lo molestamos por privado para resolverlo, para no llenar el grupo de mensajes)'
      : (isGroup ? ' (NOTA: Estás en un grupo general. Asegurale como siempre que enseguida revisamos el tema y avisamos, o dale el tip directo)' : '');

    const userMessage = isGroup
      ? `[${senderName} en grupo "${chatTitle}" - Sucursal: ${branchName}${groupInstruction}]: ${incomingText}`
      : `[${senderName} en privado]: ${incomingText}`;

    // Lista de modelos disponibles con fallback automático si uno tiene alta demanda (503)
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
    let result = null;

    for (const modelName of candidateModels) {
      try {
        const model = ai.getGenerativeModel({ model: modelName, systemInstruction });
        const chat = model.startChat({ history: history.slice() });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 7000));
        result = await Promise.race([chat.sendMessage(userMessage), timeoutPromise]);
        if (result && result.response) break;
      } catch (errRetry) {
        console.warn(`[Gemini Retry] Modelo ${modelName} falló: ${errRetry.message}. Probando siguiente...`);
      }
    }

    if (!result || !result.response) return null;
    let text = cleanHumanText(result.response.text());

    if (text) {
      // Guardar en memoria para el próximo turno
      addToChatHistory(chatId, 'user', userMessage);
      addToChatHistory(chatId, 'model', text);
      return { text, detectedBranch: branchName };
    }
  } catch (err) {
    console.warn('[Gemini Continuous Warning]:', err.message);
  }
  return null;
}

module.exports = {
  getContinuousChatResponse,
  addToChatHistory,
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
