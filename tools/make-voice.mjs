// Records every spoken line of the web page with Kokoro-82M (open weights, Apache 2.0), on this machine.
// Not needed to use the tool; run it only when voice-lines.js changes:
//   npm install --no-save kokoro-js && node tools/make-voice.mjs [voice]
import { mkdir } from 'node:fs/promises';
import { KokoroTTS } from 'kokoro-js';
import { LINES } from '../voice-lines.js';

const voice = process.argv[2] ?? 'af_heart';
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
await mkdir(new URL('../voice/', import.meta.url), { recursive: true });
for (const [key, text] of Object.entries(LINES)) {
  const audio = await tts.generate(text, { voice, speed: 0.92 });
  await audio.save(new URL(`../voice/${key}.wav` /* converted to mp3 with ffmpeg afterwards */, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  console.log(`${key}: ${(audio.audio.length / audio.sampling_rate).toFixed(1)}s`);
}
console.log(`voice: ${voice}`);
