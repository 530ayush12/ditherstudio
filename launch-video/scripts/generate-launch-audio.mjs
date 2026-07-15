import fs from 'node:fs';
import path from 'node:path';

const sampleRate = 44100;
const seconds = 14;
const channels = 2;
const total = sampleRate * seconds;
const out = new Float32Array(total);
const clamp = (v) => Math.max(-1, Math.min(1, v));
const env = (t, a, d) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d));

let seed = 24681357;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 4294967295) * 2 - 1;
};

const add = (start, len, fn, gain = 1) => {
  const a = Math.max(0, Math.floor(start * sampleRate));
  const b = Math.min(total, Math.floor((start + len) * sampleRate));
  for (let i = a; i < b; i += 1) out[i] += fn(i / sampleRate - start) * gain;
};

const tone = (start, len, freq, gain, decay = 1.2) =>
  add(start, len, (t) => {
    const drift = 1 + Math.sin(t * 0.8) * 0.006;
    return (
      Math.sin(2 * Math.PI * freq * drift * t) * 0.72 +
      Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.2
    ) * env(t, 0.08, decay);
  }, gain);

const impact = (time, weight = 1) => {
  add(time, 0.9, (t) => {
    const thud = Math.sin(2 * Math.PI * (38 + 90 * Math.exp(-t / 0.04)) * t) * env(t, 0.004, 0.23);
    const air = noise() * env(t, 0.002, 0.11) * 0.25;
    return thud + air;
  }, weight);
};

const tick = (time, gain = 0.12) =>
  add(time, 0.05, (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 2400 * t) * 0.3) * env(t, 0.001, 0.02), gain);

for (let i = 0; i < 20; i += 1) {
  tick(i * 0.5 + 0.02, i % 4 === 0 ? 0.16 : 0.08);
  if (i % 4 === 0) impact(i * 0.5, 0.34);
}
tone(0, 4.8, 55, 0.18, 1.4);
tone(2.8, 4.6, 82.41, 0.18, 1.2);
tone(6.2, 4.2, 110, 0.16, 1.0);
tone(10.0, 4.0, 164.81, 0.2, 1.1);
tone(10.35, 3.4, 220, 0.12, 0.8);
impact(10.0, 0.76);

for (let i = 0; i < total; i += 1) {
  const t = i / sampleRate;
  const fadeIn = Math.min(1, t / 0.25);
  const fadeOut = Math.min(1, (seconds - t) / 0.9);
  const air = noise() * 0.008;
  out[i] = Math.tanh((out[i] + air) * 0.9) * fadeIn * fadeOut;
}

const dataSize = total * channels * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * 2, 28);
buffer.writeUInt16LE(channels * 2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < total; i += 1) {
  const pan = Math.sin((i / sampleRate) * 0.5) * 0.12;
  buffer.writeInt16LE(Math.round(clamp(out[i] * (0.9 - pan)) * 32767), offset);
  buffer.writeInt16LE(Math.round(clamp(out[i] * (0.9 + pan)) * 32767), offset + 2);
  offset += 4;
}

const target = path.join(process.cwd(), 'public', 'media', 'dither-launch.wav');
fs.mkdirSync(path.dirname(target), {recursive: true});
fs.writeFileSync(target, buffer);
console.log(`wrote ${target}`);
