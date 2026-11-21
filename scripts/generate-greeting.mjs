import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ttsModule = await import('msedge-tts');
const MsEdgeTTS = ttsModule.MsEdgeTTS ?? ttsModule.default?.MsEdgeTTS;
const OUTPUT_FORMAT = ttsModule.OUTPUT_FORMAT ?? ttsModule.default?.OUTPUT_FORMAT;

const GREETINGS = [
  {
    lang: 'es',
    voice: 'es-ES-AlvaroNeural',
    text: 'Hola, ¿qué tal? Soy Jorge, ¿en qué te puedo ayudar?',
  },
  {
    lang: 'en',
    voice: 'en-GB-RyanNeural',
    text: "Hi, how are you? I'm Jorge, how can I help you?",
  },
  {
    lang: 'fr',
    voice: 'fr-FR-HenriNeural',
    text: "Salut, ça va ? Je suis Jorge, comment puis-je t'aider ?",
  },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '..', 'client', 'public', 'assets');
await mkdir(assetsDir, { recursive: true });

for (const { lang, voice, text } of GREETINGS) {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 10_000,
    synthesisTimeoutMs: 20_000,
  });
  let timer;

  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream, metadataStream } = tts.toStream(text);
    metadataStream?.on('error', () => {});

    const collect = (async () => {
      const chunks = [];
      for await (const chunk of audioStream) chunks.push(chunk);
      return Buffer.concat(chunks);
    })();
    collect.catch(() => {});

    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('TTS_TIMEOUT')), 25_000);
    });

    const audio = await Promise.race([collect, timeout]);
    const output = path.join(assetsDir, `saludo-${lang}.mp3`);
    await writeFile(output, audio);
    console.log(`${output} (${audio.length} bytes, ${voice})`);
  } finally {
    if (timer) clearTimeout(timer);
    tts.close();
  }
}
