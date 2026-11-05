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
      mentionReplyMessage: 'No te preocupes, ya lo estamos revisando',
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
function logActivity(type, from, text, response, success = true) {
  const logItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toLocaleTimeString(),
    type, // 'incoming' | 'system'
    from,
    text,
    response,
    success
  };
  activityLog.unshift(logItem);
  if (activityLog.length > 100) activityLog.pop();
  io.emit('activity', logItem);
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
      const rawText = (msg.body || '').trim();
      if (!rawText) return;
      if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return;

      // A) SI EL MENSAJE SALIÓ DE LA PROPIA CUENTA DEL TELÉFONO DE GUARDIA (msg.fromMe)
      if (msg.fromMe) {
        // Si no fue generado por el código del bot, significa que Facu o Ramiro respondieron manualmente desde el celular o WhatsApp Web
        if (!knowledge.isBotGeneratedOutput(rawText)) {
          const targetChatId = msg.to || msg.from;
          let quotedQuestion = '';
          try {
            if (msg.hasQuotedMsg) {
              const quoted = await msg.getQuotedMessage();
              if (quoted && quoted.body) quotedQuestion = quoted.body;
            }
          } catch (_) {}

          const learned = knowledge.learnFromHumanReply(targetChatId, rawText, quotedQuestion, 'Guardia Manual');
          if (learned) {
            knowledge.addToChatHistory(targetChatId, 'model', rawText);
            logActivity('system', '🧠 Auto-Entrenamiento', quotedQuestion || 'Respuesta manual detectada', `Aprendido: "${rawText}"`);
          }
        }
        return;
      }

      const config = readConfig();
      if (!config.botEnabled) return;

      // Ignorar estados de WhatsApp
      if (msg.from === 'status@broadcast') return;

      const incomingText = (msg.body || '').trim();
      if (!incomingText) return;

      const fromNumber = msg.from;
      const isGroup = fromNumber.endsWith('@g.us');

      // Obtener identificadores del bot para verificar menciones
      const myWid = client.info?.wid?._serialized || '';
      const myLid = client.info?.lid?._serialized || '';
      const myNumber = client.info?.wid?.user || '';

      let isMentioned = false;
      let rawMentions = [];
      try {
        if (typeof msg.getMentions === 'function') {
          rawMentions = await msg.getMentions();
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
      } catch (err) {
        console.error('Error getting mentions:', err);
      }

      // Chequeo complementario de mención en el texto
      if (!isMentioned && myNumber && incomingText.includes(`@${myNumber}`)) {
        isMentioned = true;
      }
      if (!isMentioned && (incomingText.toLowerCase().includes('@sistemas') || incomingText.toLowerCase().includes('@guardia'))) {
        isMentioned = true;
      }

      // Detectar si quien escribe en el grupo es Facu o Ramiro desde su número personal (sin arrobar al bot) para aprender de sus respuestas a las sucursales
      const authorId = (msg.author || msg.from || '').split('@')[0];
      const techNumbers = [
        knowledge.TECNICOS.ramiro.phone,
        knowledge.TECNICOS.facu.phone,
        '3876117799',
        '1163704522'
      ];
      const isAuthorTech = techNumbers.some(t => authorId.includes(t) || t.includes(authorId));

      if (isGroup && isAuthorTech && !isMentioned) {
        let quotedQuestion = '';
        try {
          if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            if (quoted && quoted.body) quotedQuestion = quoted.body;
          }
        } catch (_) {}
        const learned = knowledge.learnFromHumanReply(fromNumber, incomingText, quotedQuestion, 'Técnico en Grupo');
        if (learned) {
          logActivity('system', '🧠 Auto-Entrenamiento (Grupo)', quotedQuestion || 'Intervención de técnico', `Aprendido: "${incomingText}"`);
        }
        return;
      }

      // Registrar siempre el mensaje entrante del usuario/sucursal para tener el contexto si un técnico le responde manualmente después
      if (!isAuthorTech) {
        knowledge.recordIncomingForLearning(fromNumber, incomingText);
      }

      // Si es un grupo y config.onlyOnMention está activo, solo responder si fue mencionado
      if (isGroup && config.onlyOnMention && !isMentioned) {
        return;
      }

      let senderName = 'Usuario';
      let chatTitle = isGroup ? 'Grupo' : 'Directo';
      let chat = null;
      try {
        const contact = await msg.getContact();
        senderName = contact.pushname || contact.name || fromNumber.split('@')[0];
        chat = await msg.getChat();
        if (isGroup && chat) {
          chatTitle = chat.name || 'Grupo';
        }
      } catch (e) {
        console.error('Error fetching contact/chat info:', e);
      }

      console.log(`[Message Received] [${chatTitle}] From: ${senderName} (${fromNumber}): ${incomingText}`);

      // 0. Si es mensaje privado, chequear comandos técnicos primero (#ping, #guardia, etc.)
      if (!isGroup) {
        const commandReply = knowledge.processTechCommand(incomingText, fromNumber, botStartTime);
        if (commandReply) {
          knowledge.registerBotOutput(commandReply);
          await msg.reply(commandReply);
          console.log(`[Tech Command / Assignment] Respondido: ${commandReply}`);
          logActivity('outgoing', 'Bot (Comando Técnico)', incomingText, commandReply);
          return;
        }
      }

      // 1. REGLA HORARIA: 09:00 a 23:59 hs
      if (!knowledge.isWithinWorkingHours()) {
        console.log(`[Horario de Guardia] Mensaje fuera de horario (09:00 a 23:59). No se responde.`);
        return;
      }

      const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
      const geminiPrompt = config.geminiPrompt || '';
      const chatId = msg.from;
      const targetChat = chat || (await msg.getChat().catch(() => null));

      // 2. FUNCIÓN DE RESPUESTA CONTINUA CON GEMINI
      if (config.geminiEnabled && geminiApiKey) {
        const continuousRes = await knowledge.getContinuousChatResponse({
          chatId,
          incomingText,
          senderName,
          chatTitle,
          isGroup,
          customPrompt: geminiPrompt,
          customApiKey: geminiApiKey
        });

        if (continuousRes && continuousRes.text) {
          // Simular tiempo de lectura y tipeo humano
          const typingTime = Math.min(Math.max(continuousRes.text.length * 40, 1500), 4000);
          await sleep(1200);

          if (targetChat && typeof targetChat.sendStateTyping === 'function') {
            Promise.race([
              targetChat.sendStateTyping(),
              new Promise((_, reject) => setTimeout(() => reject('timeout'), 500))
            ]).catch(() => {});
          }

          await sleep(typingTime);

          // Registrar salida del bot para no auto-aprenderse a sí mismo
          knowledge.registerBotOutput(continuousRes.text);

          // Si es grupo responde citando, si es privado responde directo
          if (isGroup) {
            await msg.reply(continuousRes.text);
          } else {
            if (targetChat && typeof targetChat.sendMessage === 'function') {
              await targetChat.sendMessage(continuousRes.text);
            } else {
              await client.sendMessage(chatId, continuousRes.text);
            }
          }

          console.log(`[Gemini Continuo] Respondido a ${chatTitle} (${senderName}): "${continuousRes.text}"`);
          logActivity('incoming', `${senderName} (${chatTitle})`, incomingText, continuousRes.text);

          // Si fue en el grupo "Procesos - Mi Gusto", abrirle conversación por privado al remitente
          try {
            const isProcesosGroup = isGroup && chatTitle.toLowerCase().includes('procesos');
            const senderId = msg.author || msg.from;
            if (isProcesosGroup && senderId) {
              const cleanSenderId = senderId.split('@')[0];
              const techPhones = [
                knowledge.TECNICOS.ramiro.phone,
                knowledge.TECNICOS.facu.phone,
                '3876117799',
                '1163704522'
              ];
              const isSenderTech = techPhones.some(t => cleanSenderId.includes(t) || t.includes(cleanSenderId)) ||
                senderName.toLowerCase().includes('facu') || senderName.toLowerCase().includes('rami');

              if (!isSenderTech) {
                await sleep(2000);
                const privGreeting = `buenas ${senderName}, te escribo por acá por lo que comentaste en el grupo de Procesos así no llenamos el grupo de mensajes, contame bien qué pasó o pasame foto/AnyDesk y lo vemos`;
                knowledge.registerBotOutput(privGreeting);
                await client.sendMessage(senderId, privGreeting);
                knowledge.addToChatHistory(senderId, 'user', `[Contexto del grupo ${chatTitle}]: ${incomingText}`);
                knowledge.addToChatHistory(senderId, 'model', privGreeting);
                console.log(`[Privado desde Procesos] Iniciado chat privado con ${senderName} (${senderId})`);
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
                `*Chat:* ${chatTitle}\n` +
                `*De:* ${senderName}\n` +
                `*Sucursal:* ${branchName}\n` +
                `*Mensaje:* "${incomingText}"`;

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
      if (isMentioned || (config.onlyOnMention && isGroup)) {
        const responsePlan = await knowledge.getGuardiaMentionResponse({ 
          incomingText, 
          chatTitle,
          customPrompt: geminiPrompt,
          customApiKey: geminiApiKey
        });

        for (let i = 0; i < responsePlan.messages.length; i++) {
          const step = responsePlan.messages[i];
          await sleep(step.delayBefore || 1500);
          if (step.isReply) {
            await msg.reply(step.text);
          } else {
            if (targetChat && typeof targetChat.sendMessage === 'function') {
              await targetChat.sendMessage(step.text);
            } else {
              await client.sendMessage(chatId, step.text);
            }
          }
        }
        logActivity('incoming', `${senderName} en ${chatTitle}`, incomingText, responsePlan.summaryText);
        return;
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
    // Delete session files
    const authDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authDir)) {
      try {
        fs.rmSync(authDir, { recursive: true, force: true });
      } catch (_) {}
    }
    updateStatus('DISCONNECTED');
    res.json({ success: true, message: 'Sesión cerrada correctamente.' });
    // Re-init client to wait for a new QR
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
