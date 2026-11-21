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

const [jorgePrompt, temarioPrompt] = await Promise.all([
  readFile(path.join(__dirname, 'prompts', 'jorge.md'), 'utf8'),
  readFile(path.join(__dirname, 'prompts', 'temario.md'), 'utf8'),
]);

const SYSTEM_PROMPT = `${jorgePrompt.trim()}\n\n${temarioPrompt.trim()}`;

const ttsModule = await import('msedge-tts');
const MsEdgeTTS = ttsModule.MsEdgeTTS ?? ttsModule.default?.MsEdgeTTS;
const OUTPUT_FORMAT = ttsModule.OUTPUT_FORMAT ?? ttsModule.default?.OUTPUT_FORMAT;

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

function validateChatBody(body) {
  if (!body || typeof body !== 'object') {
    return 'Cuerpo de la solicitud no válido';
  }

  const { message, history = [] } = body;

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
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`#>]/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u20E3\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function textToSpeechBase64(text) {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 10_000,
    synthesisTimeoutMs: 20_000,
  });
  let timer;

  try {
    await tts.setMetadata(
      'es-ES-AlvaroNeural',
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

app.post('/api/chat', async (req, res) => {
  const startedAt = performance.now();
  let groqMs = 0;
  let ttsMs = 0;

  const validationError = validateChatBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { message, history = [] } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'Servidor sin configurar: falta GROQ_API_KEY' });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ];

  let replyText;
  try {
    const groqStartedAt = performance.now();
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      messages,
      reasoning_effort: 'low',
      max_completion_tokens: 400,
      temperature: 0.3,
    });
    groqMs = Math.round(performance.now() - groqStartedAt);
    const rawReply = completion.choices[0]?.message?.content?.trim() || 'No he entendido eso.';
    replyText = sanitizeForSpeech(rawReply) || 'No he entendido eso.';
  } catch (err) {
    console.error('[api/chat] error de Groq:', err?.status ?? err?.name ?? 'desconocido');
    console.log(`[api/chat] groq=${groqMs}ms tts=0ms total=${Math.round(performance.now() - startedAt)}ms`);
    return res.status(502).json({ error: 'No se pudo generar la respuesta' });
  }

  let audioBase64 = null;
  const ttsStartedAt = performance.now();
  try {
    audioBase64 = await textToSpeechBase64(replyText);
  } catch (err) {
    console.error('[api/chat] error de TTS:', err?.message === 'TTS_TIMEOUT' ? 'timeout' : 'desconocido');
  } finally {
    ttsMs = Math.round(performance.now() - ttsStartedAt);
  }

  console.log(`[api/chat] groq=${groqMs}ms tts=${ttsMs}ms total=${Math.round(performance.now() - startedAt)}ms`);
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
