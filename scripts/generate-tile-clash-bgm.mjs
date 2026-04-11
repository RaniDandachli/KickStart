/**
 * Generates a short looping chiptune-style WAV (original, CC0-equivalent for bundling).
 * Run: node scripts/generate-tile-clash-bgm.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'assets', 'sounds', 'tile-clash-bgm.wav');

const sampleRate = 22050;
/** ~3.2s loop — upbeat arpeggio + bass (Geometry-Dash-ish energy, not a copy of any track). */
const durationSec = 3.2;
const numSamples = Math.floor(sampleRate * durationSec);

function writeWav16Mono(pcm) {
  const dataSize = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  let o = 0;
  buf.write('RIFF', o);
  o += 4;
  buf.writeUInt32LE(36 + dataSize, o);
  o += 4;
  buf.write('WAVE', o);
  o += 4;
  buf.write('fmt ', o);
  o += 4;
  buf.writeUInt32LE(16, o);
  o += 4;
  buf.writeUInt16LE(1, o);
  o += 2;
  buf.writeUInt16LE(1, o);
  o += 2;
  buf.writeUInt32LE(sampleRate, o);
  o += 4;
  buf.writeUInt32LE(sampleRate * 2, o);
  o += 4;
  buf.writeUInt16LE(2, o);
  o += 2;
  buf.writeUInt16LE(16, o);
  o += 2;
  buf.write('data', o);
  o += 4;
  buf.writeUInt32LE(dataSize, o);
  o += 4;
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(pcm[i], o);
    o += 2;
  }
  return buf;
}

/** Simple pseudo–square + sine mix for a bright arcade tone. */
function tone(t, hz, amp) {
  const ph = t * hz;
  const sq = Math.sign(Math.sin(2 * Math.PI * ph)) * 0.55;
  const si = Math.sin(2 * Math.PI * ph);
  return (sq * 0.4 + si * 0.6) * amp;
}

const pcm = new Int16Array(numSamples);
const bpm = 148;
const beat = (bpm / 60) * 0.5;
// Pentatonic-ish steps (semitones from root ~ C4)
const arp = [0, 7, 12, 19, 24, 19, 12, 7];
const rootHz = 130.81;

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const step = Math.floor(t * beat * 2) % arp.length;
  const hz = rootHz * Math.pow(2, arp[step] / 12);
  const hz2 = rootHz * 0.5 * Math.pow(2, ((step + 3) % 5) / 12);
  const env = 0.55 + 0.45 * Math.sin((t * Math.PI * 2) / durationSec);
  let s =
    tone(t, hz, 0.22) +
    tone(t, hz * 2, 0.08) +
    tone(t, hz2, 0.14) +
    Math.sin(2 * Math.PI * 880 * t) * 0.02 * (Math.sin(t * beat * Math.PI * 2) > 0 ? 1 : 0);
  s *= env;
  s = Math.max(-1, Math.min(1, s));
  pcm[i] = Math.round(s * 28000);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, writeWav16Mono(pcm));
console.log('Wrote', outPath, `(${numSamples} samples)`);
