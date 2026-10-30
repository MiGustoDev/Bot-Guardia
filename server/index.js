const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenAI } = require('@google/generative-ai');
const knowledge = require('./knowledge');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

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

// Helper functions for storage
function readRules() {
  try {
    return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeRules(rules) {
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    return {
      botEnabled: true,
      onlyOnMention: true,
      mentionReplyMessage: 'No te preocupes, ya lo estamos revisando',
      geminiEnabled: false,
      geminiApiKey: '',
      geminiPrompt: 'Eres el asistente técnico de Guardia de Sistemas de Mi Gusto. Atiendes sucursales y locales ante emergencias técnicas. Sé directo, cordial y solicita sucursal y detalle del incidente.',
      delayMin: 1,
      delayMax: 2
    };
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
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
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html'
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

    // Chequeo de rotación semanal automática al conectar y cada 15 minutos
    const checkAndNotifyRotation = async () => {
      try {
        const rotation = knowledge.checkWeeklyAutoRotation();
        if (rotation && rotation.rotated) {
          const rotationMsg = `🔔 *Rotación Automática de Guardia*\n\nHola ${rotation.techName}, a partir de hoy lunes te corresponde la guardia de Sistemas de la semana. Las alertas de las sucursales te llegarán a vos.`;
          const targetJid = `${rotation.phone}@c.us`;
          await client.sendMessage(targetJid, rotationMsg);
          console.log(`[Rotación Notificada] Mensaje enviado a ${rotation.techName} (${rotation.phone})`);
        }
      } catch (err) {
        console.error('Error en chequeo de rotación automática:', err);
      }
    };

    // Ejecutar chequeo inicial y programar cada 15 minutos
    checkAndNotifyRotation();
    setInterval(checkAndNotifyRotation, 15 * 60 * 1000);
  });

  client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
    currentQr = null;
    updateStatus('DISCONNECTED');
    logActivity('system', 'System', `Error de autenticación: ${msg}`, '', false);
  });

  client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
    currentQr = null;
    updateStatus('DISCONNECTED');
    logActivity('system', 'System', `Desconectado: ${reason}`, '', false);
  });

  client.on('message_create', async (msg) => {
    try {
      console.log(`[DEBUG] Evento message_create recibido! From: ${msg.from}, Body: ${msg.body}, FromMe: ${msg.fromMe}`);
      
      // Ignore self-sent messages
      if (msg.fromMe) return;

      const config = readConfig();
      if (!config.botEnabled) return;

      // Ignore status broadcasts immediately
      if (msg.from === 'status@broadcast') return;

      const incomingText = msg.body || '';
      const fromNumber = msg.from;
      const isGroup = fromNumber.endsWith('@g.us');

      // Obtener información del bot para chequear si fue mencionado
      const myWid = client.info?.wid?._serialized || '';
      const myLid = client.info?.lid?._serialized || '';
      const myNumber = client.info?.wid?.user || '';

      // Obtener menciones formales
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

      // Chequeo secundario por texto si contiene @miNumero o @sistemas
      if (!isMentioned && myNumber && incomingText.includes(`@${myNumber}`)) {
        isMentioned = true;
      }
      if (!isMentioned && (incomingText.toLowerCase().includes('@sistemas') || incomingText.toLowerCase().includes('@guardia'))) {
        isMentioned = true;
      }

      console.log(`[Mention Check] isGroup: ${isGroup}, isMentioned: ${isMentioned}, myWid: ${myWid}, myLid: ${myLid}, rawMentions:`, rawMentions.map(m => m.id?._serialized));

      // Si está en modo "solo cuando es arrobado", ignorar mensajes donde no sea mencionado
      if (config.onlyOnMention) {
        if (isGroup && !isMentioned) {
          console.log('[Ignorado] Mensaje en grupo sin mención al bot.');
          return;
        }
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

      // 0. Si es un mensaje privado, verificar si un técnico está asignando la guardia semanal
      if (!isGroup) {
        const assignmentReply = knowledge.checkGuardiaAssignment(incomingText, fromNumber);
        if (assignmentReply) {
          await msg.reply(assignmentReply);
          console.log(`[Guardia Assignment] ${assignmentReply}`);
          return;
        }
      }

      // 1. REGLA HORARIA: No responder de 00:00 a 09:00 hs (se controla en knowledge.js)
      if (!knowledge.isWithinWorkingHours()) {
        console.log(`[Horario de Guardia] Mensaje recibido a las ${new Date().toLocaleTimeString()} (fuera de rango de atención 09:00 a 23:59). No se responde.`);
        return;
      }

      // Si fue mencionado en grupo o modo onlyOnMention activo
      if (isMentioned || (config.onlyOnMention && isGroup)) {
        const responsePlan = knowledge.getGuardiaMentionResponse({ incomingText, chatTitle });
        const chatId = msg.from;
        const senderId = msg.author || msg.from; // ID de quien arrobó en el grupo

        // 2. ANTI-FLOOD / COOLDOWN POR SUCURSAL:
        // Si mandan varios mensajes seguidos en menos de 1 minuto, no spammear ni responder múltiples veces
        const cooldownCheck = knowledge.checkBranchCooldown(chatId, responsePlan.detectedBranch);
        if (!cooldownCheck.allowed) {
          console.log(`[Anti-Flood Activado] Mensaje de ${chatTitle} (${responsePlan.detectedBranch}) bloqueado por cooldown. Quedan ${cooldownCheck.remainingSeconds}s.`);
          return;
        }

        try {
          const targetChat = chat || (await msg.getChat().catch(() => null));

          // A) Responder en el GRUPO con el plan humano (saludo + charla + preguntar sucursal si falta)
          for (let i = 0; i < responsePlan.messages.length; i++) {
            const step = responsePlan.messages[i];
            
            // Pausa previa
            await sleep(step.delayBefore || 2000);

            // Activar typing con timeout seguro
            if (targetChat && typeof targetChat.sendStateTyping === 'function') {
              Promise.race([
                targetChat.sendStateTyping(),
                new Promise((_, reject) => setTimeout(() => reject('timeout'), 500))
              ]).catch(() => {});
            }

            // Duración simulando tipeo
            await sleep(step.typingDuration || 3000);

            if (step.isReply) {
              await msg.reply(step.text);
            } else {
              if (targetChat && typeof targetChat.sendMessage === 'function') {
                await targetChat.sendMessage(step.text);
              } else {
                await client.sendMessage(chatId, step.text);
              }
            }
            console.log(`[Mention-Reply ${i + 1}/${responsePlan.messages.length}] Enviado a ${chatTitle}: "${step.text}"`);
          }

          // B) Responder al usuario por PRIVADO: "Hola que tal!" (SOLO si no es un técnico de guardia)
          try {
            if (senderId && isGroup) {
              let senderPhoneNumber = '';
              try {
                const authorContact = await msg.getContact();
                senderPhoneNumber = authorContact.number || authorContact.id?.user || '';
              } catch (_) {}

              const cleanSenderId = senderId.split('@')[0];
              const techPhones = [
                knowledge.TECNICOS.ramiro.phone,
                knowledge.TECNICOS.facu.phone,
                '5493876117799',
                '543876117799',
                '3876117799',
                '5491163704522',
                '541163704522',
                '1163704522'
              ];

              const isSenderTech = techPhones.some(t => 
                senderPhoneNumber.includes(t) || 
                t.includes(senderPhoneNumber) ||
                cleanSenderId.includes(t) ||
                t.includes(cleanSenderId)
              ) || senderName.toLowerCase().includes('facu') || senderName.toLowerCase().includes('rami');

              if (!isSenderTech) {
                // Pequeña pausa antes de escribirle por privado
                await sleep(1500);
                await client.sendMessage(senderId, "Hola que tal!");
                console.log(`[Privado a Usuario] Enviado "Hola que tal!" a ${senderId}`);
              } else {
                console.log(`[Privado a Usuario] Omitido porque el remitente (${senderName} / ${senderId}) es un técnico del equipo.`);
              }
            }
          } catch (privErr) {
            console.error('[Error enviando privado al usuario]:', privErr.message);
          }

          // C) ALERTA INTERNA AL TÉCNICO DE GUARDIA
          // REGLA: Lunes a Viernes de 17:15 a 23:59 hs. Sábados y Domingos todo el día.
          try {
            if (knowledge.shouldAlertTech()) {
              const activeTechs = knowledge.getActiveTechNumbers();
              const branchName = responsePlan.detectedBranch || 'No especificada';
              const alertMsg = `🚨 *Alerta Guardia Sistemas*\n\n` +
                `*Grupo:* ${chatTitle}\n` +
                `*De:* ${senderName}\n` +
                `*Sucursal:* ${branchName}\n` +
                `*Mensaje:* "${incomingText}"`;

              for (const techPhone of activeTechs) {
                const techJid = `${techPhone}@c.us`;
                await client.sendMessage(techJid, alertMsg);
                console.log(`[Alerta Técnico] Enviada a ${techPhone}`);
              }
            } else {
              console.log(`[Alerta Técnico] Fuera del horario de alerta a técnicos (Lun a Vie 17:15-23:59 o Fines de Semana). Alerta no enviada.`);
            }
          } catch (techErr) {
            console.error('[Error enviando alerta al técnico]:', techErr.message);
          }

          logActivity('incoming', `${senderName} en ${chatTitle}`, incomingText, responsePlan.summaryText);
        } catch (err) {
          console.error('Error detallado en flujo de guardia:', err);
        }
        return;
      }

      // Helper function to normalize text (lowercase, no accents, trimmed)
      const normalizeText = (str) => {
        if (!str) return '';
        return str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      };

      // 1. Check local rules (solo si no es onlyOnMention o si se desea procesar reglas)
      const rules = readRules();
      let matchedRule = null;

      for (const rule of rules) {
        if (!rule.active) continue;
        
        const triggerClean = normalizeText(rule.trigger);
        const msgClean = normalizeText(incomingText);

        if (rule.type === 'exact' && msgClean === triggerClean) {
          matchedRule = rule;
          break;
        } else if (rule.type === 'contains' && msgClean.includes(triggerClean)) {
          matchedRule = rule;
          break;
        } else if (rule.type === 'starts_with' && msgClean.startsWith(triggerClean)) {
          matchedRule = rule;
          break;
        }
      }

      if (matchedRule) {
        try {
          const options = matchedRule.reply
            .split(/[|\n]/)
            .map(r => r.trim())
            .filter(r => r.length > 0);
          
          const selectedReply = options.length > 0 
            ? options[Math.floor(Math.random() * options.length)]
            : matchedRule.reply;

          await humanReply(selectedReply);
          logActivity('incoming', `${senderName} (${chatTitle})`, incomingText, selectedReply);
          console.log(`[Auto-Reply] Sent: ${selectedReply}`);
          return;
        } catch (err) {
          console.error('Error sending reply:', err);
          logActivity('incoming', senderName, incomingText, 'Error al responder', false);
          return;
        }
      }

      // 2. Check Gemini AI if enabled
      if (config.geminiEnabled && config.geminiApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
          const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
          
          const prompt = `${config.geminiPrompt}\n\nUsuario: ${incomingText}\nRespuesta:`;

          const result = await model.generateContent(prompt);
          const aiResponse = result.response.text().trim();

          if (aiResponse) {
            await humanReply(aiResponse);
            logActivity('incoming', senderName, incomingText, aiResponse);
            console.log(`[Gemini-Reply] Sent: ${aiResponse}`);
          }
        } catch (err) {
          console.error('Error calling Gemini AI:', err);
          logActivity('incoming', senderName, incomingText, `Error de AI: ${err.message}`, false);
        }
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

app.get('/api/activity', (req, res) => {
  res.json(activityLog);
});

app.post('/api/logout', async (req, res) => {
  try {
    if (client) {
      await client.logout();
      await client.destroy();
    }
    // Delete session files
    const authDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
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
      await client.destroy();
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
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initWhatsApp();
});
