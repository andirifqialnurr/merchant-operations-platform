// Writes the kitchen screen's two notification sounds to public/sounds.
// They are synthesized here, so they carry no third-party license: the
// repository's own. Run again after changing a tone:
//   node apps/web/scripts/generate-kds-sounds.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 22_050;
const output = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

/**
 * Soft bell notes, one after another: a sine with a little of its octave,
 * a 5 ms attack, and an exponential fade.
 */
function render(notes) {
  const total = notes.reduce((end, note) => Math.max(end, note.start + note.length), 0);
  const samples = new Float64Array(Math.ceil(total * SAMPLE_RATE));
  for (const { frequency, length, start } of notes) {
    const offset = Math.floor(start * SAMPLE_RATE);
    const count = Math.floor(length * SAMPLE_RATE);
    for (let index = 0; index < count; index += 1) {
      const time = index / SAMPLE_RATE;
      const attack = Math.min(1, time / 0.005);
      const decay = Math.exp((-5 * time) / length);
      const tone =
        Math.sin(2 * Math.PI * frequency * time) +
        0.25 * Math.sin(2 * Math.PI * frequency * 2 * time);
      samples[offset + index] += 0.5 * attack * decay * tone;
    }
  }
  return samples;
}

/** 16-bit mono PCM WAV. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, index) => {
    const clipped = Math.max(-1, Math.min(1, value));
    data.writeInt16LE(Math.round(clipped * 32_767), index * 2);
  });
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync(output, { recursive: true });
// A new ticket: two rising notes, bright enough to cut through a kitchen.
writeFileSync(
  join(output, "kds-new-ticket.wav"),
  wav(
    render([
      { frequency: 880, length: 0.35, start: 0 },
      { frequency: 1318.5, length: 0.45, start: 0.14 },
    ]),
  ),
);
// The link to the server was lost: two falling, lower notes.
writeFileSync(
  join(output, "kds-connection-lost.wav"),
  wav(
    render([
      { frequency: 659.3, length: 0.3, start: 0 },
      { frequency: 440, length: 0.45, start: 0.2 },
    ]),
  ),
);
