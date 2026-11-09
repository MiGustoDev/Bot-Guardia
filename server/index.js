require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const knowledge = require('./knowledge');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const withTimeout = (promise, ms = 1200, fallback = null) =>
  Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);

// Servir frontend compilado si se accede directo al puerto 5000
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// Paths
const RULES_PATH = path.join(__dirname, 'rules.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');

// State
let botStatus = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, QR_READY, CONNECTED
let currentQr = null;
let activityLog = [];
const botStartTime = Date.now();

// Cola de mensajes entrantes con debounce por chat para agrupar mensajes enviados en ráfaga (ej: "Holis" + "Buen dia")
const incomingMessageQueues = new Map(); // chatId -> { messages: [], timer: null, inProgress: boolean }
const BATCH_DEBOUNCE_MS = 2500; // Esperar 2.5s por si el usuario está enviando varios mensajitos seguidos

// Caché en memoria RAM para Configuración y Reglas (0ms de lectura en cada mensaje)
let cachedRules = null;
let cachedConfig = null;
let rotationIntervalId = null;
let gcIntervalId = null;

function readRules() {
  if (cachedRules) return cachedRules;
  try {
    cachedRules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    return cachedRules;
  } catch (err) {
    cachedRules = [];
    return cachedRules;
  }
}

function writeRules(rules) {
  cachedRules = rules;
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));
}

function readConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    cachedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return cachedConfig;
  } catch (err) {
    cachedConfig = {
      botEnabled: true,
      onlyOnMention: true,
      ignoreTechInGroups: false,
      mentionReplyMessage: 'No te preocupes, ya enseguida lo solucionamos',
      geminiEnabled: true,
      geminiApiKey: '',
      geminiPrompt: '',
      delayMin: 1,
      delayMax: 2
    };
    return cachedConfig;
  }
}

function writeConfig(config) {
  const toSave = { ...config };
  if (toSave.geminiApiKey && toSave.geminiApiKey.trim()) {
    process.env.GEMINI_API_KEY = toSave.geminiApiKey.trim();
    const envFile = path.join(__dirname, '.env');
    fs.writeFileSync(envFile, `GEMINI_API_KEY=${process.env.GEMINI_API_KEY}\n`, 'utf8');
  }
  toSave.geminiApiKey = ''; // Nunca guardar el secreto en config.json
  cachedConfig = toSave;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2));
}

// Log helper
function logActivity(type, from, text, response, success = true, extra = {}) {
  const logItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toLocaleTimeString(),
    createdAtMs: Date.now(),
    type, // 'incoming' | 'outgoing' | 'system'
    from,
    text,
    response,
    success,
    ...extra
  };
  activityLog.unshift(logItem);
  if (activityLog.length > 300) activityLog.pop();
  io.emit('activity', logItem);
  return logItem;
}

function updateActivityItem(id, patch = {}) {
  if (!id) return null;
  const item = activityLog.find(entry => entry.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  io.emit('activity-update', item);
  return item;
}

function attachManualReplyToChat(chatId, replyText, fallbackLabel = 'Guardia (Manual)') {
  if (!replyText) return;
  const recentItem = activityLog.find(
    entry =>
      entry.type === 'incoming' &&
      entry.chatId === chatId &&
      Date.now() - (entry.createdAtMs || 0) < 60 * 60 * 1000
  );
  if (recentItem && !recentItem.response) {
    updateActivityItem(recentItem.id, {
      response: replyText,
      responder: 'human'
    });
  } else {
    const label = recentItem ? recentItem.from : fallbackLabel;
    logActivity('incoming', label, recentItem ? recentItem.text : '(Mensaje directo saliente)', replyText, true, {
      chatId,
      responder: 'human'
    });
  }
}

function formatWhatsAppMessageBody(msg) {
  const raw = (msg.body || '').trim();
  const type = msg.type || '';
  if (msg.hasMedia || !raw) {
    if (type === 'image') return raw ? `📷 [Imagen] ${raw}` : '📷 [Imagen]';
    if (type === 'ptt' || type === 'audio') return '🎵 [Audio / Nota de voz]';
    if (type === 'video') return raw ? `🎥 [Video] ${raw}` : '🎥 [Video]';
    if (type === 'document') return raw ? `📄 [Documento] ${raw}` : '📄 [Documento]';
    if (type === 'sticker') return '🏷️ [Sticker]';
    if (type === 'location') return '📍 [Ubicación]';
    if (type === 'vcard' || type === 'multi_vcard') return '👤 [Contacto adjunto]';
    if (!raw && msg.hasMedia) return '📎 [Archivo multimedia]';
  }
  return raw;
}

/**
 * Divide una respuesta larga o con saltos de línea en burbujas naturales de WhatsApp
 * para no mandar un bloque gigante de una sola vez.
 */
function splitIntoHumanBubbles(text = '') {
  const clean = (text || '').trim();
  if (!clean) return [];
  const rawParts = clean
    .split(/\n+/)
    .map(p => knowledge.capitalizeFirstLetter(p.trim().replace(/\.+$/g, '').trim()))
    .filter(Boolean);
  if (rawParts.length > 1) {
    return rawParts;
  }
  return [knowledge.capitalizeFirstLetter(clean.replace(/\.+$/g, '').trim())];
}

/**
 * Simula el tiempo humano de lectura del mensaje recibido y el estado "escribiendo..." en WhatsApp.
 * Por solicitud operativa, se aplica una pausa mínima total de ~40 segundos (40s - 48s) antes de responder,
 * dividida entre:
 * 1. Pausa inicial realista de "notificación / lectura / ver el mensaje" (20s a 26s).
 * 2. Tipeo activo en WhatsApp ("escribiendo..." vía sendStateTyping) de 20s a 24s.
 * Si durante cualquier momento de esta espera un humano contesta desde el celu de guardia, se cancela de inmediato.
 */
/**
 * Simula el tiempo humano de respuesta de exactamente ~50 segundos:
 * 1. Pausa de lectura y espera previa (~28s a 32s).
 * 2. Tipeo activo en WhatsApp ("escribiendo..." vía sendStateTyping) (~18s a 22s),
 * sumando un total exacto de ~50 segundos antes de enviar el mensaje.
 * Si durante cualquier momento un humano contesta desde el celular de guardia, se cancela al instante.
 */
async function simulateHumanReadingAndTyping(targetChat, incomingText = '', outgoingText = '', chatId = '', isFirstBubble = true) {
  // 1. Pausa de espera/lectura previa (~30s para la 1ra burbuja, 3s entre burbujas adicionales)
  const readingMs = isFirstBubble
    ? 29000 + Math.floor(Math.random() * 3000)
    : 2500 + Math.floor(Math.random() * 1000);

  const readingStepMs = 1000;
  let readingElapsed = 0;
  while (readingElapsed < readingMs) {
    if (chatId && knowledge.isChatUnderHumanControl(chatId)) {
      return false;
    }
    const chunk = Math.min(readingStepMs, readingMs - readingElapsed);
    await sleep(chunk);
    readingElapsed += chunk;
  }

  if (chatId && knowledge.isChatUnderHumanControl(chatId)) {
    return false;
  }

  // Marcar como visto tras haberlo "leído"
  if (isFirstBubble && targetChat && typeof targetChat.sendSeen === 'function') {
    await withTimeout(targetChat.sendSeen(), 700, null);
  }

  // 2. Duración de tipeo activo ("escribiendo..." en WhatsApp): ~20 segundos en la 1ra burbuja para completar los 50s totales
  const totalTypingMs = isFirstBubble
    ? 19000 + Math.floor(Math.random() * 3000)
    : 4000 + Math.floor(Math.random() * 2000);
  const stepMs = 2000;
  let elapsed = 0;

  while (elapsed < totalTypingMs) {
    if (chatId && knowledge.isChatUnderHumanControl(chatId)) {
      if (targetChat && typeof targetChat.clearState === 'function') {
        withTimeout(targetChat.clearState(), 500, null);
      }
      return false;
    }

    if (targetChat && typeof targetChat.sendStateTyping === 'function') {
      await withTimeout(targetChat.sendStateTyping(), 700, null);
    }

    const waitChunk = Math.min(stepMs, totalTypingMs - elapsed);
    await sleep(waitChunk);
    elapsed += waitChunk;
  }

  if (chatId && knowledge.isChatUnderHumanControl(chatId)) {
    if (targetChat && typeof targetChat.clearState === 'function') {
      withTimeout(targetChat.clearState(), 500, null);
    }
    return false;
  }

  return true;
}

// Update Status helper
function updateStatus(newStatus) {
  botStatus = newStatus;
  io.emit('status', { status: botStatus, qr: currentQr });
  console.log(`[Waver Status] ${newStatus}`);
}

// WhatsApp Client Init
let client;

function initWhatsApp() {
  updateStatus('CONNECTING');
  
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1053100174-alpha.html'
    },
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    try {
      currentQr = await QRCode.toDataURL(qr);
      updateStatus('QR_READY');
    } catch (err) {
      console.error('Error generating QR code data URL', err);
    }
  });

  client.on('ready', async () => {
    currentQr = null;
    updateStatus('CONNECTED');
    try {
      await client.sendPresenceAvailable();
      console.log('[Presence] Bot marcado como ONLINE.');
    } catch (e) {
      console.error('[Presence] Error setting online:', e);
    }
    logActivity('system', 'System', '¡Bot conectado y listo para recibir mensajes!', '');

    // Chequeo de rotación semanal automática y reporte de cierre los lunes a las 09:00 hs
    const checkAndNotifyRotation = async () => {
      try {
        const rotation = knowledge.checkWeeklyAutoRotation();
        if (rotation && rotation.rotated) {
          // 1. Enviar el Reporte Semanal de Cierre al técnico saliente (y también al entrante si son diferentes)
          if (rotation.reportMsg && rotation.outgoingPhone) {
            const outgoingJid = `${rotation.outgoingPhone}@c.us`;
            await client.sendMessage(outgoingJid, rotation.reportMsg);
            console.log(`[Reporte Semanal Enviado] Reporte enviado al técnico saliente: ${rotation.outgoingTechName} (${rotation.outgoingPhone})`);
          }

          // 2. Notificar al técnico entrante que asume la guardia
          const rotationMsg = `🔔 *Rotación Automática de Guardia*\n\nHola ${rotation.techName}, a partir de hoy lunes te corresponde la guardia de Sistemas de la semana. Las alertas de las sucursales te llegarán a vos.`;
          const targetJid = `${rotation.phone}@c.us`;
          await client.sendMessage(targetJid, rotationMsg);
          console.log(`[Rotación Notificada] Mensaje enviado al nuevo técnico: ${rotation.techName} (${rotation.phone})`);
        }
      } catch (err) {
        console.error('Error en chequeo de rotación automática y reporte semanal:', err);
      }
    };

    // Ejecutar chequeo inicial y programar cada 15 minutos (limpiando timers previos si reconectó)
    if (rotationIntervalId) clearInterval(rotationIntervalId);
    if (gcIntervalId) clearInterval(gcIntervalId);

    checkAndNotifyRotation();
    rotationIntervalId = setInterval(checkAndNotifyRotation, 15 * 60 * 1000);

    // Limpieza automática preventiva de caché de Chromium cada 24 horas
    knowledge.cleanChromiumCache();
    gcIntervalId = setInterval(() => {
      try {
        knowledge.cleanChromiumCache();
      } catch (err) {
        console.error('Error en limpieza periódica de caché:', err);
      }
    }, 24 * 60 * 60 * 1000);
  });

  client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
    currentQr = null;
    updateStatus('DISCONNECTED');
    logActivity('system', 'System', `Error de autenticación: ${msg}`, '', false);
  });

  client.on('disconnected', async (reason) => {
    console.log('Client was logged out or connection lost:', reason);
    currentQr = null;
    updateStatus('DISCONNECTED');
    logActivity('system', 'System', `Desconectado (${reason}). Reintentando conexión automática sin perder sesión...`, '', false);

    // Si fue un cierre temporal o caída de red, reiniciar cliente manteniendo la carpeta LocalAuth intacta
    try {
      await client.destroy().catch(() => {});
    } catch (_) {}
    
    // Esperar 5 segundos antes de reintentar para no saturar
    setTimeout(() => {
      console.log('[Reconexión Automática] Levantando cliente WhatsApp...');
      initWhatsApp();
    }, 5000);
  });

  client.on('message_create', async (msg) => {
    try {
      if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return;
      const displayText = formatWhatsAppMessageBody(msg);
      const rawText = (msg.body || '').trim();
      if (!displayText) return;

      // A) SI EL MENSAJE SALIÓ DE LA PROPIA CUENTA DEL TELÉFONO DE GUARDIA (msg.fromMe)
      if (msg.fromMe) {
        const targetChatId = msg.to || msg.from;
        // Si no fue generado por el código del bot, significa que Facu o Ramiro respondieron manualmente desde el celular de la guardia o WhatsApp Web
        if (!knowledge.isBotGeneratedOutput(rawText, targetChatId) && !knowledge.isBotGeneratedOutput(displayText, targetChatId)) {
          const cleanCmd = rawText.trim().toLowerCase();

          // Permitir reactivar el bot manualmente enviando #bot o #activar
          if (cleanCmd === '#bot' || cleanCmd === '#activar') {
            knowledge.clearHumanTakeover(targetChatId);
            logActivity('system', '🤖 Bot Reactivado', `Chat: ${targetChatId.split('@')[0]}`, 'El bot volvió a modo automático en este chat');
            return;
          }

          // Reflejar la respuesta manual en el monitor de mensajes en vivo de la vista web
          attachManualReplyToChat(targetChatId, displayText, `Guardia Manual (${targetChatId.split('@')[0]})`);

          // Si el técnico manda un mensaje manual desde el celu de la guardia (en privado o grupo),
          // el bot le cede el control de esa conversación y frena la charla automática
          const wasAlreadyManual = knowledge.isChatUnderHumanControl(targetChatId);
          knowledge.markHumanTakeover(targetChatId);
          if (rawText) knowledge.addToChatHistory(targetChatId, 'model', rawText);
          if (!wasAlreadyManual) {
            logActivity('system', '👤 Control Manual Activo', `Conversación tomada (${targetChatId.split('@')[0]})`, `El bot pausa sus respuestas automáticas en este chat para que sigas vos: "${displayText}"`);
          }

          let quotedQuestion = '';
          try {
            if (msg._data && msg._data.quotedMsg && msg._data.quotedMsg.body) {
              quotedQuestion = msg._data.quotedMsg.body;
            } else if (msg.hasQuotedMsg) {
              const quoted = await withTimeout(msg.getQuotedMessage(), 1200, null);
              if (quoted && quoted.body) quotedQuestion = quoted.body;
            }
          } catch (_) {}

          if (rawText) {
            const learned = knowledge.learnFromHumanReply(targetChatId, rawText, quotedQuestion, 'Guardia Manual');
            if (learned) {
              logActivity('system', '🧠 Auto-Entrenamiento', quotedQuestion || 'Respuesta manual detectada', `Aprendido: "${rawText}"`);
            }
          }
        }
        return;
      }

      const fromNumber = msg.from;
      const isGroup = fromNumber.endsWith('@g.us');
      const incomingText = rawText || displayText;

      // Resolver remitente y nombre del grupo/chat con timeout estricto (1s) para jamás colgar por @lid en WhatsApp Web
      let senderName = (msg._data && msg._data.notifyName) ? msg._data.notifyName : fromNumber.split('@')[0];
      let chatTitle = isGroup ? 'Grupo' : 'Privado';
      let chat = null;
      try {
        const [contactRes, chatRes] = await Promise.all([
          withTimeout(msg.getContact(), 1000, null),
          withTimeout(msg.getChat(), 1000, null)
        ]);
        if (contactRes) {
          senderName = contactRes.pushname || contactRes.name || senderName;
        }
        if (chatRes) {
          chat = chatRes;
          if (isGroup && chatRes.name) {
            chatTitle = chatRes.name;
          }
        }
      } catch (e) {
        console.error('Error fetching contact/chat info:', e);
      }

      // REGISTRAR SIEMPRE EN TIEMPO REAL TODOS LOS MENSAJES ENTRANTES EN EL MONITOR DE LA VISTA WEB
      const incomingLogItem = logActivity(
        'incoming',
        `${senderName} (${chatTitle})`,
        displayText,
        '',
        true,
        { chatId: fromNumber, isGroup }
      );

      console.log(`[Message Received] [${chatTitle}] From: ${senderName} (${fromNumber}): ${displayText}`);

      const config = readConfig();
      if (!config.botEnabled) return;

      // REGLA CRITICA: El bot NUNCA debe responder ni escribir en el grupo interno de Sistemas
      if (isGroup && knowledge.isInternalSystemsGroup(fromNumber, chatTitle, config.internalSystemsGroupIds)) {
        console.log(`[Grupo Sistemas Interno] Mensaje en grupo de Sistemas (${chatTitle} - ${fromNumber}). El bot tiene estrictamente prohibido responder aquí.`);
        return;
      }

      // Si es solo un archivo multimedia sin texto ni mención, ya quedó visible en el panel web
      if (!rawText) return;

      // Obtener identificadores del bot para verificar menciones (primero sincrónicamente desde msg._data)
      const myWid = client.info?.wid?._serialized || '';
      const myLid = client.info?.lid?._serialized || '';
      const myNumber = client.info?.wid?.user || '';
      const myLidUser = client.info?.lid?.user || '';

      let isMentioned = false;
      const mentionedList = (msg._data && Array.isArray(msg._data.mentionedJidList)) ? msg._data.mentionedJidList : [];
      if (mentionedList.length > 0) {
        isMentioned = mentionedList.some(jid => {
          const jStr = typeof jid === 'string' ? jid : (jid?._serialized || '');
          return (myWid && jStr === myWid) ||
            (myLid && jStr === myLid) ||
            (myNumber && jStr.includes(myNumber)) ||
            (myLidUser && jStr.includes(myLidUser));
        });
      }

      if (!isMentioned && typeof msg.getMentions === 'function') {
        try {
          const rawMentions = await withTimeout(msg.getMentions(), 1000, []);
          if (Array.isArray(rawMentions)) {
            isMentioned = rawMentions.some(contact => {
              const cWid = contact.id?._serialized || '';
              const cUser = contact.id?.user || '';
              const cNum = contact.number || '';
              return contact.isMe ||
                (myWid && cWid === myWid) ||
                (myLid && cWid === myLid) ||
                (myNumber && (cUser === myNumber || cNum === myNumber));
            });
          }
        } catch (_) {}
      }

      // Chequeo complementario de mención en el texto
      if (!isMentioned && myNumber && incomingText.includes(`@${myNumber}`)) {
        isMentioned = true;
      }
      if (!isMentioned && myLidUser && incomingText.includes(`@${myLidUser}`)) {
        isMentioned = true;
      }
      if (!isMentioned && (incomingText.toLowerCase().includes('@sistemas') || incomingText.toLowerCase().includes('@guardia'))) {
        isMentioned = true;
      }

      // Si en un grupo nos vuelven a arrobar explícitamente para un caso nuevo, liberamos cualquier pausa previa del grupo y reseteamos turnos
      if (isGroup && isMentioned) {
        knowledge.clearHumanTakeover(fromNumber);
        knowledge.resetBotTurns(fromNumber);
      }

      // El bot SOLAMENTE responde la primera interacción. Si ya respondió en este chat o si un técnico tomó el control, no responder
      if (knowledge.isChatUnderHumanControl(fromNumber)) {
        return;
      }

      // Si el bot ya respondió 1 vez en este chat (o el chat ya está en curso), ceder totalmente el turno al equipo humano
      if (knowledge.getBotTurnCount(fromNumber) >= 1) {
        return;
      }

      // Si es un grupo, verificar si el mensaje requiere atención
      const isMainOpsGroupCheck = isGroup && knowledge.isMainOperationsGroup(chatTitle, fromNumber);
      
      // REGLA ESTRICTA PARA EL GRUPO DE PROCESOS: ÚNICAMENTE responder si arroban a Sistemas / teléfono de guardia
      if (isMainOpsGroupCheck && !isMentioned) {
        return;
      }

      if (isGroup && config.onlyOnMention && !isMentioned) {
        return;
      }

      // Si está activo el filtro de números técnicos, ignorar mensajes en grupos sin mención si provienen de los teléfonos personales de Facu o Ramiro
      if (config.ignoreTechInGroups && isGroup && !isMentioned) {
        const cleanAuthorId = (msg.author || msg.from || '').split('@')[0];
        const isAuthorTech =
          cleanAuthorId.includes('1163704522') ||
          cleanAuthorId.includes('3876117799') ||
          /\b(facu|facundo|ramiro|rami)\b/i.test(senderName);

        if (isAuthorTech) {
          return;
        }
      }

      // 0. Si es mensaje privado, chequear comandos técnicos primero (#ping, #guardia, etc.)
      if (!isGroup) {
        const commandReply = knowledge.processTechCommand(incomingText, fromNumber, botStartTime);
        if (commandReply) {
          knowledge.registerBotOutput(commandReply, fromNumber);
          await msg.reply(commandReply);
          console.log(`[Tech Command / Assignment] Respondido: ${commandReply}`);
          updateActivityItem(incomingLogItem.id, { response: commandReply, responder: 'bot' });
          return;
        }

        // 0.5. CONTROL MANUAL (HANDOFF HUMANO EN PRIVADO):
        // Si un técnico ya contestó manualmente en este chat privado, el bot le deja la conversación al humano
        // sin interrumpir, mientras sigue registrando los mensajes para auto-entrenarse.
        if (knowledge.isChatUnderHumanControl(fromNumber)) {
          knowledge.addToChatHistory(fromNumber, 'user', `[${senderName} en privado]: ${incomingText}`);
          console.log(`[Control Manual] Chat con ${senderName} (${fromNumber}) bajo atención manual del técnico. El bot cede el turno.`);
          return;
        }

        // Si ya completó la primera interacción, no responder más en privado para darles tiempo a intervenir manualmente
        if (knowledge.getBotTurnCount(fromNumber) >= 1) {
          knowledge.addToChatHistory(fromNumber, 'user', `[${senderName} en privado]: ${incomingText}`);
          console.log(`[Límite 1 Mensaje] Chat privado con ${senderName} (${fromNumber}) ya tuvo su primera interacción del bot. Se cede el turno al equipo humano.`);
          return;
        }
      }

      // 1. REGLA HORARIA: 09:00 a 23:59 hs
      if (!knowledge.isWithinWorkingHours()) {
        console.log(`[Horario de Guardia] Mensaje fuera de horario (09:00 a 23:59). No se responde.`);
        return;
      }

      // Debounce por chat para agrupar mensajes enviados en ráfaga (ej: "Holis" y 1s después "Buen dia")
      // Evita disparar 2 respuestas de Gemini en paralelo al mismo chat
      if (!incomingMessageQueues.has(fromNumber)) {
        incomingMessageQueues.set(fromNumber, { messages: [], timer: null, inProgress: false });
      }
      const chatQueue = incomingMessageQueues.get(fromNumber);
      chatQueue.messages.push({
        msg,
        rawText,
        displayText,
        incomingText,
        senderName,
        chatTitle,
        isGroup,
        isMentioned,
        incomingLogItem
      });

      if (chatQueue.timer) {
        clearTimeout(chatQueue.timer);
      }

      // Esperar 2.5s antes de procesar para recibir mensajes seguidos
      await new Promise((resolve) => {
        chatQueue.timer = setTimeout(resolve, BATCH_DEBOUNCE_MS);
      });

      // Si ya hay un procesamiento en curso para este chat o no es el último batch, ceder
      if (chatQueue.inProgress || chatQueue.messages.length === 0) {
        return;
      }

      chatQueue.inProgress = true;
      const batchedItems = [...chatQueue.messages];
      chatQueue.messages = [];

      // Combinar los textos de la ráfaga (ej: "Holis\nBuen dia")
      const combinedIncomingText = batchedItems
        .map(b => b.incomingText)
        .filter(Boolean)
        .join('\n');
      const latestItem = batchedItems[batchedItems.length - 1];
      const primaryMsg = latestItem.msg;
      const primarySenderName = latestItem.senderName;
      const primaryChatTitle = latestItem.chatTitle;
      const primaryLogItem = latestItem.incomingLogItem;
      const anyMentioned = batchedItems.some(b => b.isMentioned);

      try {
        const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
        const geminiPrompt = config.geminiPrompt || '';
        const chatId = fromNumber;
        const targetChat = chat || (await withTimeout(primaryMsg.getChat(), 1000, null));

        // Activar de inmediato el hilo de conversación continua en este chat (salvo en el grupo Procesos donde se traslada a privado)
        if (!isMainOpsGroupCheck) {
          knowledge.startOrRefreshBotConversation(chatId, primaryMsg.author || primaryMsg.from);
        }

        // 1.5. Si estamos en un grupo, detectar si quien nos arrobó fue una SUPERVISORA DE TIENDA o la SUCURSAL directamente
        let incidentTarget = {
          isSupervisor: false,
          targetSenderId: primaryMsg.author || primaryMsg.from,
          targetSenderName: primarySenderName,
          detectedBranch: '',
          effectiveProblemText: combinedIncomingText
        };

        if (isGroup && anyMentioned) {
          let quotedMsgData = null;
          try {
            if (primaryMsg.hasQuotedMsg) {
              const quoted = await withTimeout(primaryMsg.getQuotedMessage(), 1200, null);
              if (quoted) {
                let qSenderName = (quoted._data && quoted._data.notifyName) || '';
                try {
                  const qContact = await withTimeout(quoted.getContact(), 800, null);
                  if (qContact) qSenderName = qContact.pushname || qContact.name || qSenderName;
                } catch (_) {}
                quotedMsgData = {
                  senderId: quoted.author || quoted.from,
                  senderName: qSenderName,
                  text: (quoted.body || '').trim()
                };
              }
            }
          } catch (_) {}

          incidentTarget = knowledge.resolveGroupIncidentTarget({
            groupChatId: fromNumber,
            mentionSenderId: primaryMsg.author || primaryMsg.from,
            mentionSenderName: primarySenderName,
            incomingText: combinedIncomingText,
            quotedMsgData
          });

          // Si el mensaje fue de una sucursal (no supervisora), también lo dejamos en el buffer del grupo
          if (!incidentTarget.isSupervisor) {
            knowledge.recordGroupMessageContext(fromNumber, {
              senderId: primaryMsg.author || primaryMsg.from,
              senderName: primarySenderName,
              text: combinedIncomingText
            });
          }
        }

        // 2. FUNCIÓN DE RESPUESTA CONTINUA CON GEMINI
        if (config.geminiEnabled !== false) {
          const continuousRes = await knowledge.getContinuousChatResponse({
            chatId,
            incomingText: (anyMentioned ? incidentTarget.effectiveProblemText : combinedIncomingText) || combinedIncomingText,
            senderName: primarySenderName,
            chatTitle: primaryChatTitle,
            isGroup,
            isSupervisor: anyMentioned ? incidentTarget.isSupervisor : false,
            detectedBranchOverride: incidentTarget.detectedBranch,
            customPrompt: geminiPrompt,
            customApiKey: geminiApiKey
          });

          if (continuousRes && continuousRes.text) {
            const bubbles = splitIntoHumanBubbles(continuousRes.text);
            const sentBubbles = [];

            for (let bIdx = 0; bIdx < bubbles.length; bIdx++) {
              const bubbleText = bubbles[bIdx];
              const canSend = await simulateHumanReadingAndTyping(targetChat, combinedIncomingText, bubbleText, chatId, bIdx === 0);
              if (!canSend) {
                console.log(`[Tipeo Cancelado] Un técnico intervino manualmente en ${primaryChatTitle} mientras el bot simulaba escribir.`);
                return;
              }

              // Registrar salida del bot con chatId antes y después de enviar para nunca confundirla con mensaje manual
              knowledge.registerBotOutput(bubbleText, chatId);
              knowledge.registerBotOutput(continuousRes.text, chatId);

              if (isGroup && bIdx === 0) {
                await primaryMsg.reply(bubbleText);
              } else {
                if (targetChat && typeof targetChat.sendMessage === 'function') {
                  await targetChat.sendMessage(bubbleText);
                } else {
                  await client.sendMessage(chatId, bubbleText);
                }
              }

              knowledge.registerBotOutput(bubbleText, chatId);
              sentBubbles.push(bubbleText);
              updateActivityItem(primaryLogItem.id, { response: sentBubbles.join('\n'), responder: 'bot' });
            }

            console.log(`[Gemini Continuo] Respondido a ${primaryChatTitle} (${primarySenderName}): "${continuousRes.text}"`);

            // Incrementar contador de respuestas del bot en esta conversación
            const currentTurns = knowledge.incrementBotTurn(chatId);
            console.log(`[Primera Interacción Bot] Respondido a ${primaryChatTitle} (${chatId}). Turnos: ${currentTurns}/1. El bot cede el turno al equipo humano.`);

            const isMainOpsGroup = isGroup && knowledge.isMainOperationsGroup(primaryChatTitle, chatId);
            if (!isMainOpsGroup) {
              // El bot solamente responde la primera interacción. No reactiva el hilo para responder subsecuentes.

              // Si el caso reportado es que NO les aparece una promoción en el sistema,
              // a los pocos segundos enviamos automáticamente el segundo aviso indicando que ya mandamos la actualización y que recarguen con F5
              if (knowledge.isPromoVisibilityIssue(combinedIncomingText, continuousRes.text)) {
                const promoFollowUpMsg = 'Listo, ahí ya mandamos la actualización al sistema, prueben recargar con F5 y fijate que ya les tiene que aparecer la promo';
                setTimeout(async () => {
                  try {
                    if (knowledge.isChatUnderHumanControl(chatId)) return;
                    const canFollowUp = await simulateHumanReadingAndTyping(targetChat, '', promoFollowUpMsg, chatId, false);
                    if (!canFollowUp || knowledge.isChatUnderHumanControl(chatId)) return;

                    knowledge.registerBotOutput(promoFollowUpMsg, chatId);
                    if (targetChat && typeof targetChat.sendMessage === 'function') {
                      await targetChat.sendMessage(promoFollowUpMsg);
                    } else {
                      await client.sendMessage(chatId, promoFollowUpMsg);
                    }
                    knowledge.registerBotOutput(promoFollowUpMsg, chatId);
                    knowledge.addToChatHistory(chatId, 'model', promoFollowUpMsg);
                    knowledge.startOrRefreshBotConversation(chatId, primaryMsg.author || primaryMsg.from);
                    sentBubbles.push(promoFollowUpMsg);
                    updateActivityItem(primaryLogItem.id, { response: sentBubbles.join('\n'), responder: 'bot' });
                    console.log(`[Promo Auto-Update F5] Aviso de F5 enviado en ${primaryChatTitle}: "${promoFollowUpMsg}"`);
                  } catch (promoErr) {
                    console.error('[Error en seguimiento automático de Promo F5]:', promoErr.message);
                  }
                }, 9500);
              }
            }

            // Si fue en el grupo principal de Operaciones / Procesos ("Procesos - Mi Gusto"),
            // abrirle conversación por privado a la SUCURSAL (NUNCA a la supervisora si nos arrobó una supervisora)
            try {
              if (isMainOpsGroup) {
                let targetBranchJid = incidentTarget.targetSenderId;
                let targetBranchLabel = incidentTarget.targetSenderName || primarySenderName;

                if (incidentTarget.isSupervisor && !targetBranchJid && incidentTarget.detectedBranch && incidentTarget.detectedBranch !== 'No especificada') {
                  try {
                    const allChats = await client.getChats();
                    const normBr = incidentTarget.detectedBranch.toLowerCase();
                    const foundBranchChat = allChats.find(
                      c => !c.isGroup && c.name && c.name.toLowerCase().includes(normBr)
                    );
                    if (foundBranchChat && foundBranchChat.id && foundBranchChat.id._serialized) {
                      targetBranchJid = foundBranchChat.id._serialized;
                      targetBranchLabel = foundBranchChat.name;
                    }
                  } catch (_) {}
                }

                if (targetBranchJid) {
                  const cleanTargetId = targetBranchJid.split('@')[0];
                  const techPhones = [
                    knowledge.TECNICOS.ramiro.phone,
                    knowledge.TECNICOS.facu.phone,
                    '3876117799',
                    '1163704522'
                  ];
                  const isTargetTech = techPhones.some(t => cleanTargetId.includes(t) || t.includes(cleanTargetId)) ||
                    targetBranchLabel.toLowerCase().includes('facu') || targetBranchLabel.toLowerCase().includes('rami');

                  if (!isTargetTech) {
                    knowledge.clearHumanTakeover(targetBranchJid);
                    knowledge.startOrRefreshBotConversation(targetBranchJid, targetBranchJid);

                    // Generar saludo cálido y variado para el privado derivado de Procesos
                    const hour = new Date().getHours();
                    const timeGreeting = hour >= 20 || hour < 6 ? 'Buenas noches' : (hour >= 13 ? 'Buenas tardes' : 'Buen día');
                    const privateVariations = [
                      `${timeGreeting}, dale ya lo reviso y te confirmo`,
                      `Buenas! Dale, ya lo miro y te aviso`,
                      `${timeGreeting}! Dale, ahí lo revisamos y te confirmo`,
                      `Buenas, dale, ya nos ponemos a verlo y te aviso`,
                      `${timeGreeting}, dale, ya lo chequeamos y te confirmo`
                    ];
                    const privGreeting = privateVariations[Math.floor(Math.random() * privateVariations.length)];

                    const privChat = await client.getChatById(targetBranchJid).catch(() => null);
                    const canSendPriv = await simulateHumanReadingAndTyping(privChat, '', privGreeting, targetBranchJid);
                    if (canSendPriv) {
                      knowledge.registerBotOutput(privGreeting);
                      await client.sendMessage(targetBranchJid, privGreeting);
                      knowledge.addToChatHistory(targetBranchJid, 'user', `[Contexto del grupo ${primaryChatTitle}]: ${incidentTarget.effectiveProblemText}`);
                      knowledge.addToChatHistory(targetBranchJid, 'model', privGreeting);
                      logActivity('outgoing', `Bot ➔ ${targetBranchLabel} (Privado)`, `Derivado desde ${primaryChatTitle}`, privGreeting, true, { chatId: targetBranchJid });
                      console.log(`[Privado desde Grupo Principal] Iniciado chat privado con sucursal ${targetBranchLabel} (${targetBranchJid}) [Arrobó supervisora: ${incidentTarget.isSupervisor}]`);
                    }
                  }
                } else if (incidentTarget.isSupervisor) {
                  console.log(`[Privado desde Grupo Principal] Arrobó supervisora (${primarySenderName}), se evitó hablarle por privado a ella (sucursal aún no escribió en el grupo).`);
                }
              }
            } catch (privErr) {
              console.error('[Error iniciando privado desde Procesos]:', privErr.message);
            }

            // Alerta al técnico de guardia si corresponde por horario
            try {
              if (knowledge.shouldAlertTech()) {
                const activeTechs = knowledge.getActiveTechNumbers();
                const branchName = continuousRes.detectedBranch || 'No especificada';
                const alertMsg = `🚨 *Alerta Guardia Sistemas*\n\n` +
                  `*Chat:* ${primaryChatTitle}\n` +
                  `*De:* ${primarySenderName}\n` +
                  `*Sucursal:* ${branchName}\n` +
                  `*Mensaje:* "${combinedIncomingText}"`;

                const isWeekend = (new Date().getDay() === 0 || new Date().getDay() === 6);
                knowledge.recordWeeklyAlert(branchName, isWeekend);

                for (const techPhone of activeTechs) {
                  const techJid = `${techPhone}@c.us`;
                  knowledge.registerBotOutput(alertMsg);
                  await client.sendMessage(techJid, alertMsg);
                  console.log(`[Alerta Técnico] Enviada a ${techPhone}`);
                }
              }
            } catch (techErr) {
              console.error('[Error enviando alerta al técnico]:', techErr.message);
            }

            return;
          }
        }

        // Fallback si Gemini no estuviera disponible: flujo tradicional de guardia
        if (anyMentioned || (config.onlyOnMention && isGroup)) {
          const responsePlan = await knowledge.getGuardiaMentionResponse({ 
            incomingText: combinedIncomingText, 
            chatTitle: primaryChatTitle,
            customPrompt: geminiPrompt,
            customApiKey: geminiApiKey
          });

          for (let i = 0; i < responsePlan.messages.length; i++) {
            const step = responsePlan.messages[i];
            await sleep(step.delayBefore || 1500);
            knowledge.registerBotOutput(step.text);
            if (step.isReply) {
              await primaryMsg.reply(step.text);
            } else {
              if (targetChat && typeof targetChat.sendMessage === 'function') {
                await targetChat.sendMessage(step.text);
              } else {
                await client.sendMessage(chatId, step.text);
              }
            }
          }
          updateActivityItem(primaryLogItem.id, { response: responsePlan.summaryText, responder: 'bot' });
          return;
        }
      } finally {
        chatQueue.inProgress = false;
      }

    } catch (globalErr) {
      console.error('Global message handler error:', globalErr);
    }
  });

  client.initialize().catch(err => {
    console.error('Client initialization failed:', err);
    updateStatus('DISCONNECTED');
  });
}

// REST API Endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: botStatus, qr: currentQr });
});

app.get('/api/rules', (req, res) => {
  res.json(readRules());
});

app.post('/api/rules', (req, res) => {
  const rules = req.body;
  if (Array.isArray(rules)) {
    writeRules(rules);
    res.json({ success: true, message: 'Reglas guardadas correctamente.' });
  } else {
    res.status(400).json({ error: 'Formato de reglas inválido.' });
  }
});

app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

app.post('/api/config', (req, res) => {
  const config = req.body;
  writeConfig(config);
  res.json({ success: true, message: 'Configuración guardada correctamente.' });
});

app.get('/api/learned', (req, res) => {
  res.json(knowledge.readLearnedMemory());
});

app.get('/api/activity', (req, res) => {
  res.json(activityLog);
});

app.delete('/api/activity', (req, res) => {
  activityLog.length = 0;
  io.emit('activity-history', []);
  res.json({ success: true, message: 'Historial de mensajes vaciado correctamente.' });
});

app.post('/api/command', (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Comando requerido' });
    const reply = knowledge.processTechCommand(command, 'Dashboard', botStartTime);
    if (reply) {
      logActivity('system', 'Comando Dashboard', command, reply);
    }
    res.json({ success: true, command, reply: reply || 'Comando ejecutado correctamente.' });
  } catch (err) {
    console.error('Error executing tech command:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/simulate', async (req, res) => {
  try {
    const { text = '', chatTitle = 'Grupo Guardia' } = req.body;
    if (!text.trim()) {
      return res.status(400).json({ error: 'Texto requerido' });
    }

    const branch = knowledge.detectBranch(text, chatTitle);
    const rules = readRules();
    let matchedRule = null;
    const normalize = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\̀-\ͯ]/g, '').trim();
    const cleanText = normalize(text);

    for (const rule of rules) {
      if (!rule.active) continue;
      const cleanTrigger = normalize(rule.trigger);
      if (rule.type === 'exact' && cleanText === cleanTrigger) {
        matchedRule = rule;
        break;
      } else if (rule.type === 'contains' && cleanText.includes(cleanTrigger)) {
        matchedRule = rule;
        break;
      } else if (rule.type === 'starts_with' && cleanText.startsWith(cleanTrigger)) {
        matchedRule = rule;
        break;
      }
    }

    const cfgSim = readConfig();
    const mentionPlan = await knowledge.getGuardiaMentionResponse({
      incomingText: text,
      chatTitle,
      customPrompt: cfgSim.geminiPrompt || '',
      customApiKey: cfgSim.geminiApiKey || process.env.GEMINI_API_KEY || ''
    });
    const isWorkingHours = knowledge.isWithinWorkingHours();
    const willAlert = knowledge.shouldAlertTech();
    const guardiaState = knowledge.getGuardiaState();
    const activeTechName = guardiaState.assigned ? (knowledge.TECNICOS[guardiaState.assigned]?.nombre || guardiaState.assigned) : 'Ambos';

    let reply = '';
    let responseType = 'flujo_guardia';
    if (matchedRule) {
      reply = matchedRule.reply;
      responseType = 'regla_contingencia';
    } else {
      reply = mentionPlan.messages.map(m => m.text).join('\n\n');
      responseType = 'flujo_guardia';
    }

    res.json({
      success: true,
      detectedBranch: branch || 'No detectada (Preguntará sucursal)',
      matchedRule: matchedRule ? { trigger: matchedRule.trigger, id: matchedRule.id } : null,
      responseType,
      reply,
      isWorkingHours,
      willAlert,
      activeTech: activeTechName
    });
  } catch (err) {
    console.error('Error in simulate:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (client) {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
    }
    // Delete session & cache folders (.wwebjs_auth and .wwebjs_cache)
    const authDir = path.join(__dirname, '.wwebjs_auth');
    const cacheDir = path.join(__dirname, '.wwebjs_cache');
    for (const dir of [authDir, cacheDir]) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (_) {}
      }
    }
    currentQr = null;
    updateStatus('DISCONNECTED');
    logActivity('system', 'System', 'Conexión borrada (.wwebjs_auth eliminado). Generando nuevo código QR limpio...', '');
    res.json({ success: true, message: 'Conexión borrada correctamente. Generando nuevo QR...' });
    // Re-init client to generate a fresh QR
    initWhatsApp();
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restart', async (req, res) => {
  try {
    if (client) {
      await client.destroy().catch(() => {});
    }
    initWhatsApp();
    res.json({ success: true, message: 'Reiniciando bot...' });
  } catch (err) {
    console.error('Error restarting:', err);
    res.status(500).json({ error: err.message });
  }
});

// Socket Connections
io.on('connection', (socket) => {
  console.log('Client connected to socket');
  socket.emit('status', { status: botStatus, qr: currentQr });
  socket.emit('activity-history', activityLog);
});

// Servir frontend compilado en cualquier otra ruta
if (fs.existsSync(clientDistPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start Node application
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  initWhatsApp();
});
