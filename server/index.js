import 'dotenv/config';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import Groq from 'groq-sdk';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const clientDist = path.join(rootDir, 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');

const promptsDir = path.join(__dirname, 'prompts');
const [jorgePrompt, temarioPrompt] = await Promise.all([
  readFile(path.join(promptsDir, 'jorge.md'), 'utf8'),
  readFile(path.join(promptsDir, 'temario.md'), 'utf8'),
]);

let perfilPrompt = '';
try {
  perfilPrompt = await readFile(path.join(promptsDir, 'perfil.md'), 'utf8');
} catch (err) {
  if (err?.code === 'ENOENT') console.warn('[prompts] falta server/prompts/perfil.md; se continúa sin él');
  else console.warn('[prompts] no se pudo leer perfil.md; se continúa sin él');
}

const SYSTEM_PROMPT = [jorgePrompt.trim(), perfilPrompt.trim(), temarioPrompt.trim()]
  .filter(Boolean)
  .join('\n\n');

const ttsModule = await import('msedge-tts');
const MsEdgeTTS = ttsModule.MsEdgeTTS ?? ttsModule.default?.MsEdgeTTS;
const OUTPUT_FORMAT = ttsModule.OUTPUT_FORMAT ?? ttsModule.default?.OUTPUT_FORMAT;

const ALLOWED_LANGUAGES = new Set(['es', 'en', 'fr']);
const TTS_VOICES = {
  es: 'es-ES-AlvaroNeural',
  en: 'en-GB-RyanNeural',
  fr: 'fr-FR-HenriNeural',
};
const LANGUAGE_INSTRUCTIONS = {
  es: 'Responde siempre en español de España.',
  en: 'Always reply in English. Use simple A2-B1 sentences and gently correct the student language mistakes. Do not switch to Spanish unless the user explicitly asks.',
  fr: "Réponds toujours en français. Utilise des phrases simples de niveau A2-B1 et corrige gentiment les erreurs de l'élève. Ne passe pas à l'espagnol sauf demande explicite.",
};
const FALLBACK_REPLIES = {
  es: 'No he entendido eso.',
  en: 'I did not understand that.',
  fr: "Je n'ai pas compris.",
};

async function resolveVoice(locale, preferred) {
  const tts = new MsEdgeTTS();
  try {
    const voices = await tts.getVoices();
    return voices.find((voice) => voice.Locale === locale && voice.Gender === 'Male' && voice.ShortName === preferred)?.ShortName
      || voices.find((voice) => voice.Locale === locale && voice.Gender === 'Male' && voice.ShortName.endsWith('Neural'))?.ShortName
      || preferred;
  } catch {
    return preferred;
  } finally {
    tts.close();
  }
}

const [esVoice, enVoice, frVoice] = await Promise.all([
  resolveVoice('es-ES', TTS_VOICES.es),
  resolveVoice('en-GB', TTS_VOICES.en),
  resolveVoice('fr-FR', TTS_VOICES.fr),
]);
TTS_VOICES.es = esVoice;
TTS_VOICES.en = enVoice;
TTS_VOICES.fr = frVoice;
console.log(`[voces] es=${esVoice} en=${enVoice} fr=${frVoice}`);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' },
});
app.use('/api/', apiLimiter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_LENGTH = 6;
const ALLOWED_ROLES = new Set(['user', 'assistant']);
const GROQ_TIMEOUT_MS = 25_000;
const GROQ_MAX_COMPLETION_TOKENS = 1500;

function validateChatBody(body) {
  if (!body || typeof body !== 'object') {
    return 'Cuerpo de la solicitud no válido';
  }

  const { message, history = [], lang } = body;

  if (lang !== undefined && !ALLOWED_LANGUAGES.has(lang)) {
    return '"lang" debe ser exactamente "es", "en" o "fr"';
  }
  if (typeof message !== 'string' || !message.trim()) {
    return 'El campo "message" debe ser un texto no vacío';
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `"message" no puede superar ${MAX_MESSAGE_LENGTH} caracteres`;
  }
  if (!Array.isArray(history) || history.length > MAX_HISTORY_LENGTH) {
    return `"history" debe ser una lista de como máximo ${MAX_HISTORY_LENGTH} mensajes`;
  }

  for (const item of history) {
    if (
      !item ||
      typeof item !== 'object' ||
      !ALLOWED_ROLES.has(item.role) ||
      typeof item.content !== 'string' ||
      item.content.length > MAX_MESSAGE_LENGTH
    ) {
      return 'Historial no válido: solo roles user/assistant y mensajes de hasta 500 caracteres';
    }
  }

  return null;
}

function escapeXml(text) {
  return text.replace(/[<>&"']/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);
}

function sanitizeForSpeech(text) {
  return String(text)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`#>]/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u20E3\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function textToSpeechBase64(text, lang) {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 10_000,
    synthesisTimeoutMs: 20_000,
  });
  let timer;

  try {
    await tts.setMetadata(
      TTS_VOICES[lang],
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const { audioStream, metadataStream } = tts.toStream(escapeXml(text));
    metadataStream?.on('error', () => {});

    const collect = (async () => {
      const chunks = [];
      for await (const chunk of audioStream) chunks.push(chunk);
      return Buffer.concat(chunks).toString('base64');
    })();
    collect.catch(() => {});

    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('TTS_TIMEOUT')), 25_000);
    });

    return await Promise.race([collect, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    tts.close();
  }
}

function supportsBrowserSearch(model) {
  return typeof model === 'string' && model.startsWith('openai/gpt-oss-');
}

function extractExecutedToolNames(completion) {
  const names = new Set();
  const executedTools = completion?.choices?.[0]?.message?.executed_tools;
  if (!Array.isArray(executedTools)) return names;
  for (const tool of executedTools) {
    const name = tool?.name || tool?.type || tool?.function?.name;
    if (typeof name === 'string' && name) names.add(name);
  }
  return names;
}

async function createGroqCompletion(groq, { model, messages, useBrowserSearch }) {
  const request = {
    model,
    messages,
    reasoning_effort: 'low',
    max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
    temperature: 0.3,
  };
  if (useBrowserSearch) {
    request.tools = [{ type: 'browser_search' }];
    request.tool_choice = 'auto';
  }
  return groq.chat.completions.create(request, { timeout: GROQ_TIMEOUT_MS });
}

app.post('/api/chat', async (req, res) => {
  const startedAt = performance.now();
  let groqMs = 0;
  let ttsMs = 0;
  let searchUsed = false;

  const validationError = validateChatBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { message, history = [], lang = 'es' } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'Servidor sin configurar: falta GROQ_API_KEY' });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const useBrowserSearch = supportsBrowserSearch(model);

  const baseMessages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${LANGUAGE_INSTRUCTIONS[lang]}` },
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ];

  let replyText;
  try {
    const groqStartedAt = performance.now();
    let completion;
    try {
      completion = await createGroqCompletion(groq, { model, messages: baseMessages, useBrowserSearch });
    } catch (err) {
      if (!useBrowserSearch) throw err;
      console.error('[api/chat] reintento Groq sin búsqueda:', err?.status ?? err?.name ?? 'desconocido');
      completion = await createGroqCompletion(groq, {
        model,
        messages: [
          ...baseMessages,
          { role: 'system', content: 'No has podido consultar internet ahora mismo. Dilo con claridad y naturalidad en 2 o 3 frases, sin inventar datos recientes.' },
        ],
        useBrowserSearch: false,
      });
    }
    groqMs = Math.round(performance.now() - groqStartedAt);
    searchUsed = extractExecutedToolNames(completion).has('browser_search');
    const rawReply = completion.choices[0]?.message?.content?.trim() || FALLBACK_REPLIES[lang];
    replyText = sanitizeForSpeech(rawReply) || FALLBACK_REPLIES[lang];
  } catch (err) {
    console.error('[api/chat] error de Groq:', err?.status ?? err?.name ?? 'desconocido');
    groqMs = groqMs || Math.round(performance.now() - startedAt);
    replyText = sanitizeForSpeech(FALLBACK_REPLIES[lang]) || FALLBACK_REPLIES[lang];
  }

  let audioBase64 = null;
  const ttsStartedAt = performance.now();
  try {
    audioBase64 = await textToSpeechBase64(replyText, lang);
  } catch (err) {
    console.error('[api/chat] error de TTS:', err?.message === 'TTS_TIMEOUT' ? 'timeout' : 'desconocido');
  } finally {
    ttsMs = Math.round(performance.now() - ttsStartedAt);
  }

  console.log(`[api/chat] groq=${groqMs}ms tts=${ttsMs}ms total=${Math.round(performance.now() - startedAt)}ms search=${searchUsed ? 'yes' : 'no'}`);
  res.json({ text: replyText, audioBase64 });
});

app.use(express.static(clientDist));

app.get('/{*splat}', async (_req, res) => {
  try {
    await access(indexHtml);
    res.sendFile(indexHtml);
  } catch {
    res.status(503).send('Cliente no compilado. Ejecuta npm run build.');
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`jorgetwin escuchando en puerto ${port}`);
});
