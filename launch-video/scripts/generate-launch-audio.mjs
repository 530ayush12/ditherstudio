import fs from 'node:fs';
import path from 'node:path';

const sampleRate = 44100;
const seconds = 14;
const channels = 2;
const total = sampleRate * seconds;
const left = new Float32Array(total);
const right = new Float32Array(total);

let seed = 184739;
const rand = () => {
  seed ^= seed << 13;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 4294967295) * 2 - 1;
};

const clamp = (v) => Math.max(-1, Math.min(1, v));
const smoothstep = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

let surfL = 0;
let surfR = 0;
let foamL = 0;
let foamR = 0;

for (let i = 0; i < total; i += 1) {
  const t = i / sampleRate;
  const fadeIn = smoothstep(t / 1.4);
  const fadeOut = smoothstep((seconds - t) / 1.8);
  const master = fadeIn * fadeOut;

  const swell =
    0.42 +
    0.32 * Math.sin(2 * Math.PI * 0.155 * t - 0.7) +
    0.18 * Math.sin(2 * Math.PI * 0.071 * t + 1.6);
  const wave = smoothstep((swell + 0.2) / 1.1);

  surfL = surfL * 0.996 + rand() * 0.004;
  surfR = surfR * 0.996 + rand() * 0.004;
  foamL = foamL * 0.82 + rand() * 0.18;
  foamR = foamR * 0.82 + rand() * 0.18;

  const low = (surfL * 0.82 + surfR * 0.18) * (0.68 + wave * 0.88);
  const lowR = (surfR * 0.82 + surfL * 0.18) * (0.68 + wave * 0.88);
  const fizz = foamL * 0.022 * wave;
  const fizzR = foamR * 0.022 * wave;

  const pad =
    Math.sin(2 * Math.PI * 55 * t) * 0.026 +
    Math.sin(2 * Math.PI * 82.41 * t + 0.8) * 0.018 +
    Math.sin(2 * Math.PI * 110 * t + 1.9) * 0.012;

  const pan = Math.sin(2 * Math.PI * 0.045 * t) * 0.18;
  left[i] = (low * (0.92 - pan) + fizz + pad * 0.78) * master;
  right[i] = (lowR * (0.92 + pan) + fizzR + pad * 0.86) * master;
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
  buffer.writeInt16LE(Math.round(clamp(Math.tanh(left[i] * 1.12)) * 32767), offset);
  buffer.writeInt16LE(Math.round(clamp(Math.tanh(right[i] * 1.12)) * 32767), offset + 2);
  offset += 4;
}

const target = path.join(process.cwd(), 'public', 'media', 'dither-launch.wav');
fs.mkdirSync(path.dirname(target), {recursive: true});
fs.writeFileSync(target, buffer);
console.log(`wrote ${target}`);
