import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ttsModule = await import('msedge-tts');
const MsEdgeTTS = ttsModule.MsEdgeTTS ?? ttsModule.default?.MsEdgeTTS;
const OUTPUT_FORMAT = ttsModule.OUTPUT_FORMAT ?? ttsModule.default?.OUTPUT_FORMAT;

const GREETING = 'Hola, ¿qué tal? Soy Jorge, ¿en qué te puedo ayudar?';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(__dirname, '..', 'client', 'public', 'assets', 'saludo.mp3');

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

  const { audioStream, metadataStream } = tts.toStream(GREETING);
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
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, audio);
  console.log(`Saludo generado en ${output} (${audio.length} bytes)`);
} finally {
  if (timer) clearTimeout(timer);
  tts.close();
}
