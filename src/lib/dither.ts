/** Shared dither core. Works in browser and Node (no DOM required). */

export type AlgorithmId =
  | 'threshold'
  | 'random'
  | 'floyd-steinberg'
  | 'atkinson'
  | 'jjn'
  | 'stucki'
  | 'burkes'
  | 'sierra'
  | 'bayer-2'
  | 'bayer-4'
  | 'bayer-8'
  | 'halftone'
  | 'blue-noise'
  | 'riemersma'
  | 'hybrid'

export type Rgb = [number, number, number]

export interface AlgorithmMeta {
  id: AlgorithmId
  name: string
  family: 'point' | 'error' | 'ordered' | 'pattern' | 'modern'
  blurb: string
}

export const ALGORITHMS: AlgorithmMeta[] = [
  { id: 'threshold', name: 'Threshold', family: 'point', blurb: 'Hard cut. No diffusion.' },
  { id: 'random', name: 'Random', family: 'point', blurb: 'Seeded noise threshold.' },
  { id: 'floyd-steinberg', name: 'Floyd-Steinberg', family: 'error', blurb: 'Classic error diffusion.' },
  { id: 'atkinson', name: 'Atkinson', family: 'error', blurb: 'Mac classic. Higher contrast.' },
  { id: 'jjn', name: 'Jarvis-Judice-Ninke', family: 'error', blurb: 'Wide kernel. Soft detail.' },
  { id: 'stucki', name: 'Stucki', family: 'error', blurb: 'Sharp, clean diffusion.' },
  { id: 'burkes', name: 'Burkes', family: 'error', blurb: 'Faster wide kernel.' },
  { id: 'sierra', name: 'Sierra', family: 'error', blurb: 'Balanced mid-tone spread.' },
  { id: 'bayer-2', name: 'Bayer 2x2', family: 'ordered', blurb: 'Tiny ordered matrix.' },
  { id: 'bayer-4', name: 'Bayer 4x4', family: 'ordered', blurb: 'Standard ordered dither.' },
  { id: 'bayer-8', name: 'Bayer 8x8', family: 'ordered', blurb: 'Fine ordered texture.' },
  { id: 'halftone', name: 'Halftone', family: 'pattern', blurb: 'Circular print dots.' },
  { id: 'blue-noise', name: 'Blue noise', family: 'modern', blurb: 'Modern void-and-cluster feel.' },
  { id: 'riemersma', name: 'Riemersma', family: 'modern', blurb: 'Hilbert-path error diffusion.' },
  { id: 'hybrid', name: 'Hybrid', family: 'modern', blurb: 'Bayer + error diffusion mix.' },
]

export const ALGORITHM_IDS = ALGORITHMS.map((a) => a.id) as AlgorithmId[]

export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface DitherOptions {
  algorithm: AlgorithmId
  threshold: number
  invert: boolean
  serpentine: boolean
  darkColor: Rgb
  lightColor: Rgb
  cellSize: number
  /** Multi-color palette. Length 2+ overrides dual-tone. */
  palette?: Rgb[]
  /** PRNG seed for random / blue-noise variation. */
  seed: number
  /** Gamma pre-pass (0.4–2.4). 1 = off. */
  gamma: number
  /** Contrast pre-pass (0.5–2). 1 = off. */
  contrast: number
  /** Boost threshold near edges for detail. */
  edgeAware: boolean
  /** Diffuse error in RGB instead of luminance (multi-color). */
  colorMode: boolean
  /** Brightness offset -100..100 */
  brightness: number
  /** Saturation multiplier 0..2 (1 = unchanged) */
  saturation: number
  /** Pre-dither noise amount 0..1 */
  noise: number
  /** Blend dithered vs preprocessed original 0..1 (1 = full dither) */
  strength: number
  /** Softness: blur radius before dither 0..3 */
  softness: number
}

export const DEFAULT_DITHER_OPTIONS: DitherOptions = {
  algorithm: 'floyd-steinberg',
  threshold: 128,
  invert: false,
  serpentine: true,
  darkColor: [17, 17, 17],
  lightColor: [250, 250, 250],
  cellSize: 6,
  seed: 42,
  gamma: 1,
  contrast: 1,
  edgeAware: false,
  colorMode: false,
  brightness: 0,
  saturation: 1,
  noise: 0,
  strength: 1,
  softness: 0,
}

export const PALETTE_PRESETS: { id: string; name: string; colors: string[] }[] = [
  { id: 'bw', name: 'B&W', colors: ['#111111', '#fafafa'] },
  { id: 'pure', name: 'Pure', colors: ['#000000', '#ffffff'] },
  { id: 'gameboy', name: 'Game Boy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { id: 'cga', name: 'CGA', colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
  { id: 'mac', name: 'Mac', colors: ['#000000', '#ffffff'] },
  { id: 'riso-rb', name: 'Riso RB', colors: ['#000000', '#ff4800', '#0078bf', '#fff6e6'] },
  { id: 'sepia', name: 'Sepia', colors: ['#1a120b', '#c4a574'] },
  { id: 'neon', name: 'Neon', colors: ['#0a0a12', '#00ff9c', '#ff2bd6', '#f5f5ff'] },
  { id: 'paper', name: 'Newsprint', colors: ['#1c1a16', '#e8e2d4'] },
  { id: 'blueink', name: 'Blue ink', colors: ['#0c1a2e', '#d8e6f8'] },
]

export function createPixelBuffer(width: number, height: number, data?: Uint8ClampedArray): PixelBuffer {
  return { width, height, data: data ?? new Uint8ClampedArray(width * height * 4) }
}

export function isAlgorithmId(value: string): value is AlgorithmId {
  return (ALGORITHM_IDS as string[]).includes(value)
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '').trim()
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex color: ${hex}`)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

export function parsePalette(hexList: string[]): Rgb[] {
  return hexList.map(hexToRgb)
}

/** Mulberry32 PRNG */
export function createRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const BAYER_2 = [
  [0, 2],
  [3, 1],
]
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

type Kernel = { dx: number; dy: number; w: number }[]
const KERNELS: Record<string, { div: number; taps: Kernel }> = {
  'floyd-steinberg': {
    div: 16,
    taps: [
      { dx: 1, dy: 0, w: 7 },
      { dx: -1, dy: 1, w: 3 },
      { dx: 0, dy: 1, w: 5 },
      { dx: 1, dy: 1, w: 1 },
    ],
  },
  atkinson: {
    div: 8,
    taps: [
      { dx: 1, dy: 0, w: 1 },
      { dx: 2, dy: 0, w: 1 },
      { dx: -1, dy: 1, w: 1 },
      { dx: 0, dy: 1, w: 1 },
      { dx: 1, dy: 1, w: 1 },
      { dx: 0, dy: 2, w: 1 },
    ],
  },
  jjn: {
    div: 48,
    taps: [
      { dx: 1, dy: 0, w: 7 },
      { dx: 2, dy: 0, w: 5 },
      { dx: -2, dy: 1, w: 3 },
      { dx: -1, dy: 1, w: 5 },
      { dx: 0, dy: 1, w: 7 },
      { dx: 1, dy: 1, w: 5 },
      { dx: 2, dy: 1, w: 3 },
      { dx: -2, dy: 2, w: 1 },
      { dx: -1, dy: 2, w: 3 },
      { dx: 0, dy: 2, w: 5 },
      { dx: 1, dy: 2, w: 3 },
      { dx: 2, dy: 2, w: 1 },
    ],
  },
  stucki: {
    div: 42,
    taps: [
      { dx: 1, dy: 0, w: 8 },
      { dx: 2, dy: 0, w: 4 },
      { dx: -2, dy: 1, w: 2 },
      { dx: -1, dy: 1, w: 4 },
      { dx: 0, dy: 1, w: 8 },
      { dx: 1, dy: 1, w: 4 },
      { dx: 2, dy: 1, w: 2 },
      { dx: -2, dy: 2, w: 1 },
      { dx: -1, dy: 2, w: 2 },
      { dx: 0, dy: 2, w: 4 },
      { dx: 1, dy: 2, w: 2 },
      { dx: 2, dy: 2, w: 1 },
    ],
  },
  burkes: {
    div: 32,
    taps: [
      { dx: 1, dy: 0, w: 8 },
      { dx: 2, dy: 0, w: 4 },
      { dx: -2, dy: 1, w: 2 },
      { dx: -1, dy: 1, w: 4 },
      { dx: 0, dy: 1, w: 8 },
      { dx: 1, dy: 1, w: 4 },
      { dx: 2, dy: 1, w: 2 },
    ],
  },
  sierra: {
    div: 32,
    taps: [
      { dx: 1, dy: 0, w: 5 },
      { dx: 2, dy: 0, w: 3 },
      { dx: -2, dy: 1, w: 2 },
      { dx: -1, dy: 1, w: 4 },
      { dx: 0, dy: 1, w: 5 },
      { dx: 1, dy: 1, w: 4 },
      { dx: 2, dy: 1, w: 2 },
      { dx: -1, dy: 2, w: 2 },
      { dx: 0, dy: 2, w: 3 },
      { dx: 1, dy: 2, w: 2 },
    ],
  },
}

function clamp(v: number, lo = 0, hi = 255): number {
  return v < lo ? lo : v > hi ? hi : v
}

function applyGammaContrast(v: number, gamma: number, contrast: number): number {
  let x = v / 255
  if (gamma !== 1) x = Math.pow(Math.max(0, x), 1 / gamma)
  if (contrast !== 1) x = (x - 0.5) * contrast + 0.5
  return clamp(x * 255)
}

function applySatBright(r: number, g: number, b: number, sat: number, bright: number): Rgb {
  // Rec.601 luma mix for saturation
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  let nr = y + (r - y) * sat
  let ng = y + (g - y) * sat
  let nb = y + (b - y) * sat
  nr += bright
  ng += bright
  nb += bright
  return [clamp(nr), clamp(ng), clamp(nb)]
}

/** Box blur for softness (odd kernel). */
function softBlur(buffer: PixelBuffer, radius: number): PixelBuffer {
  const r = Math.max(0, Math.min(3, Math.round(radius)))
  if (r === 0) return buffer
  const { width, height, data } = buffer
  const out = createPixelBuffer(width, height)
  const tmp = new Float32Array(width * height * 4)
  // horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rs = 0
      let gs = 0
      let bs = 0
      let as = 0
      let n = 0
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k))
        const i = (y * width + xx) * 4
        rs += data[i]
        gs += data[i + 1]
        bs += data[i + 2]
        as += data[i + 3]
        n++
      }
      const di = (y * width + x) * 4
      tmp[di] = rs / n
      tmp[di + 1] = gs / n
      tmp[di + 2] = bs / n
      tmp[di + 3] = as / n
    }
  }
  // vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rs = 0
      let gs = 0
      let bs = 0
      let as = 0
      let n = 0
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k))
        const i = (yy * width + x) * 4
        rs += tmp[i]
        gs += tmp[i + 1]
        bs += tmp[i + 2]
        as += tmp[i + 3]
        n++
      }
      const di = (y * width + x) * 4
      out.data[di] = rs / n
      out.data[di + 1] = gs / n
      out.data[di + 2] = bs / n
      out.data[di + 3] = as / n
    }
  }
  return out
}

function colorDist2(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

function nearestColor(r: number, g: number, b: number, palette: Rgb[]): Rgb {
  let best = palette[0]
  let bestD = Infinity
  for (const c of palette) {
    const d = colorDist2([r, g, b], c)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

function resolvePalette(options: DitherOptions): Rgb[] {
  let palette: Rgb[]
  if (options.palette && options.palette.length >= 2) {
    palette = options.palette.map((c) => [...c] as Rgb)
  } else {
    palette = [options.darkColor, options.lightColor]
  }
  if (options.invert) palette = [...palette].reverse()
  return palette
}

/** Simple blue-noise-ish 64x64 tile from seeded hash (stable, no huge table). */
function blueNoiseValue(x: number, y: number, seed: number): number {
  // Multi-hash to reduce lattice artifacts
  let n = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n = Math.imul(n ^ (n >>> 16), 2246822519)
  n = (n ^ (n >>> 13)) >>> 0
  // Spatially scramble with second sample
  const n2 =
    (Math.imul((x * 7 + 13) ^ (y * 11 + seed), 1597334677) ^
      Math.imul(y * 17 + x * 3, 3812015801)) >>>
    0
  return ((n * 0.6 + n2 * 0.4) % 256) / 255
}

/** Edge magnitude 0–1 via 3x3 sobel-ish on luminance buffer */
function edgeMap(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1]
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1]
      out[i] = Math.min(1, Math.hypot(gx, gy) / 255)
    }
  }
  return out
}

/** Hilbert curve order covering at least n*n */
function hilbertPoints(order: number): Array<[number, number]> {
  const n = 1 << order
  const pts: Array<[number, number]> = []
  const rot = (n: number, x: number, y: number, rx: number, ry: number) => {
    if (ry === 0) {
      if (rx === 1) {
        x = n - 1 - x
        y = n - 1 - y
      }
      return [y, x] as [number, number]
    }
    return [x, y] as [number, number]
  }
  for (let d = 0; d < n * n; d++) {
    let x = 0
    let y = 0
    let t = d
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t / 2)
      const ry = 1 & (t ^ rx)
      ;[x, y] = rot(s, x, y, rx, ry)
      x += s * rx
      y += s * ry
      t = Math.floor(t / 4)
    }
    pts.push([x, y])
  }
  return pts
}

function normalizeOptions(partial?: Partial<DitherOptions>): DitherOptions {
  return {
    ...DEFAULT_DITHER_OPTIONS,
    ...partial,
    threshold: clamp(partial?.threshold ?? DEFAULT_DITHER_OPTIONS.threshold),
    cellSize: Math.max(2, Math.min(32, partial?.cellSize ?? DEFAULT_DITHER_OPTIONS.cellSize)),
    seed: (partial?.seed ?? DEFAULT_DITHER_OPTIONS.seed) >>> 0,
    gamma: Math.max(0.4, Math.min(2.4, partial?.gamma ?? 1)),
    contrast: Math.max(0.5, Math.min(2, partial?.contrast ?? 1)),
    brightness: Math.max(-100, Math.min(100, partial?.brightness ?? 0)),
    saturation: Math.max(0, Math.min(2, partial?.saturation ?? 1)),
    noise: Math.max(0, Math.min(1, partial?.noise ?? 0)),
    strength: Math.max(0, Math.min(1, partial?.strength ?? 1)),
    softness: Math.max(0, Math.min(3, partial?.softness ?? 0)),
  }
}

function writeRgb(
  out: Uint8ClampedArray,
  i: number,
  c: Rgb,
  alpha: number,
) {
  out[i] = c[0]
  out[i + 1] = c[1]
  out[i + 2] = c[2]
  out[i + 3] = alpha
}

function finalizeOut(
  out: PixelBuffer,
  preR: Float32Array,
  preG: Float32Array,
  preB: Float32Array,
  alphaSrc: Uint8ClampedArray,
  strength: number,
): PixelBuffer {
  if (strength >= 0.999) return out
  const { width, height, data } = out
  const s = strength
  const inv = 1 - s
  for (let idx = 0; idx < width * height; idx++) {
    const i = idx * 4
    data[i] = data[i] * s + preR[idx] * inv
    data[i + 1] = data[i + 1] * s + preG[idx] * inv
    data[i + 2] = data[i + 2] * s + preB[idx] * inv
    data[i + 3] = alphaSrc[i + 3]
  }
  return out
}

/**
 * Dither an RGBA buffer. Returns a new buffer (input is not mutated).
 */
export function dither(buffer: PixelBuffer, partial?: Partial<DitherOptions>): PixelBuffer {
  const options = normalizeOptions(partial)
  const { width, height, data } = buffer
  const out = createPixelBuffer(width, height)
  const outData = out.data
  const palette = resolvePalette(options)
  const thr = options.threshold
  const rng = createRng(options.seed)
  const multi = palette.length > 2 || options.colorMode

  // Optional soft blur pre-pass
  const srcBuf =
    options.softness > 0
      ? softBlur({ width, height, data }, options.softness)
      : { width, height, data }
  const src = srcBuf.data
  const rngPre = createRng(options.seed + 17)

  // Preprocess luminance + optional RGB working buffers
  const gray = new Float32Array(width * height)
  const rCh = new Float32Array(width * height)
  const gCh = new Float32Array(width * height)
  const bCh = new Float32Array(width * height)
  const preR = new Float32Array(width * height)
  const preG = new Float32Array(width * height)
  const preB = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const i = idx * 4
      let r = src[i]
      let g = src[i + 1]
      let b = src[i + 2]
      ;[r, g, b] = applySatBright(r, g, b, options.saturation, options.brightness)
      r = applyGammaContrast(r, options.gamma, options.contrast)
      g = applyGammaContrast(g, options.gamma, options.contrast)
      b = applyGammaContrast(b, options.gamma, options.contrast)
      if (options.noise > 0) {
        const n = (rngPre() * 2 - 1) * options.noise * 48
        r = clamp(r + n)
        g = clamp(g + n)
        b = clamp(b + n)
      }
      preR[idx] = r
      preG[idx] = g
      preB[idx] = b
      rCh[idx] = r
      gCh[idx] = g
      bCh[idx] = b
      gray[idx] = luminance(r, g, b)
    }
  }

  const edges = options.edgeAware ? edgeMap(gray, width, height) : null

  const localThr = (idx: number) => {
    if (!edges) return thr
    // Near edges: lower threshold slightly to keep detail darks
    return thr - edges[idx] * 40
  }

  const quantizeGray = (v: number, idx: number): Rgb => {
    if (palette.length === 2) {
      return v >= localThr(idx) ? palette[1] : palette[0]
    }
    // Map gray to nearest by luminance of palette
    let best = palette[0]
    let bestD = Infinity
    for (const c of palette) {
      const d = Math.abs(luminance(c[0], c[1], c[2]) - v)
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best
  }

  const quantizeColor = (r: number, g: number, b: number): Rgb => nearestColor(r, g, b, palette)

  const algo = options.algorithm

  // --- Point ---
  if (algo === 'threshold' || algo === 'random' || algo === 'blue-noise') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const i = idx * 4
        let bias = 0
        if (algo === 'random') bias = (rng() * 2 - 1) * 64
        if (algo === 'blue-noise') bias = (blueNoiseValue(x, y, options.seed) - 0.5) * 255
        if (multi && options.colorMode) {
          writeRgb(
            outData,
            i,
            quantizeColor(rCh[idx] + bias * 0.35, gCh[idx] + bias * 0.35, bCh[idx] + bias * 0.35),
            data[i + 3],
          )
        } else if (palette.length === 2) {
          const t = localThr(idx) + bias
          writeRgb(outData, i, gray[idx] >= t ? palette[1] : palette[0], data[i + 3])
        } else {
          writeRgb(outData, i, quantizeGray(gray[idx] + bias, idx), data[i + 3])
        }
      }
    }
    return finalizeOut(out, preR, preG, preB, data, options.strength)
  }

  // --- Bayer / hybrid ordered stage ---
  if (algo.startsWith('bayer-') || algo === 'hybrid') {
    const matrix = algo === 'bayer-2' ? BAYER_2 : algo === 'bayer-4' ? BAYER_4 : BAYER_8
    const n = matrix.length
    const levels = n * n
    // For pure bayer, write output; hybrid continues with error on residual conceptually - do bayer then light FS
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const i = idx * 4
        const m = (matrix[y % n][x % n] + 0.5) / levels
        const bias = (m - 0.5) * 255
        if (multi && options.colorMode) {
          writeRgb(
            outData,
            i,
            quantizeColor(rCh[idx] + bias * 0.5, gCh[idx] + bias * 0.5, bCh[idx] + bias * 0.5),
            data[i + 3],
          )
        } else if (palette.length === 2) {
          writeRgb(outData, i, gray[idx] >= localThr(idx) + bias ? palette[1] : palette[0], data[i + 3])
        } else {
          writeRgb(outData, i, quantizeGray(gray[idx] + bias, idx), data[i + 3])
        }
      }
    }
    if (algo !== 'hybrid') return finalizeOut(out, preR, preG, preB, data, options.strength)
    // Hybrid: take bayer result as starting quant, re-run FS on error from original gray
    // Rebuild working gray from original, use FS with palette
  }

  // --- Halftone ---
  if (algo === 'halftone') {
    const cell = options.cellSize
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const i = idx * 4
        const cx = Math.floor(x / cell) * cell + cell / 2
        const cy = Math.floor(y / cell) * cell + cell / 2
        const sx = Math.min(width - 1, Math.max(0, Math.floor(cx)))
        const sy = Math.min(height - 1, Math.max(0, Math.floor(cy)))
        const g = gray[sy * width + sx]
        const maxR = cell * 0.5 * Math.SQRT2
        const tNorm = thr / 255
        const radius = maxR * (1 - g / 255) * (0.4 + tNorm * 0.8)
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        const c = dist > radius ? palette[palette.length - 1] : palette[0]
        writeRgb(outData, i, c, data[i + 3])
      }
    }
    return finalizeOut(out, preR, preG, preB, data, options.strength)
  }

  // --- Riemersma (Hilbert) ---
  if (algo === 'riemersma') {
    let order = 1
    while (1 << order < Math.max(width, height)) order++
    const path = hilbertPoints(order)
    const errQ: number[] = []
    const weights = [16, 8, 4, 2, 1]
    const qLen = weights.length
    for (let k = 0; k < qLen; k++) errQ.push(0)
    for (const [hx, hy] of path) {
      if (hx >= width || hy >= height) continue
      const idx = hy * width + hx
      const i = idx * 4
      const errSum = errQ.reduce((s, e, k) => s + e * weights[k], 0) / 31
      const v = gray[idx] + errSum
      const c = quantizeGray(v, idx)
      const q = luminance(c[0], c[1], c[2])
      const err = v - q
      errQ.unshift(err)
      errQ.pop()
      writeRgb(outData, i, c, data[i + 3])
    }
    // Fill any gaps (non-covered if any)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (outData[i + 3] === 0 && data[i + 3] !== 0) {
          writeRgb(outData, i, quantizeGray(gray[y * width + x], y * width + x), data[i + 3])
        } else if (outData[i + 3] === 0) {
          outData[i + 3] = data[i + 3]
        }
      }
    }
    return finalizeOut(out, preR, preG, preB, data, options.strength)
  }

  // --- Error diffusion (incl. hybrid second pass base) ---
  let kernelKey = algo
  if (algo === 'hybrid') kernelKey = 'floyd-steinberg'
  const kernel = KERNELS[kernelKey]

  if (!kernel) {
    // Fallback point
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        writeRgb(outData, idx * 4, quantizeGray(gray[idx], idx), data[idx * 4 + 3])
      }
    }
    return finalizeOut(out, preR, preG, preB, data, options.strength)
  }

  // Hybrid: seed gray with residual after bayer (already wrote out) - re-read... simpler: FS from original
  // Color error diffusion
  if (multi && options.colorMode) {
    for (let y = 0; y < height; y++) {
      const ltr = !options.serpentine || y % 2 === 0
      const xStart = ltr ? 0 : width - 1
      const xEnd = ltr ? width : -1
      const xStep = ltr ? 1 : -1
      for (let x = xStart; x !== xEnd; x += xStep) {
        const idx = y * width + x
        const i = idx * 4
        const oldR = rCh[idx]
        const oldG = gCh[idx]
        const oldB = bCh[idx]
        const neu = quantizeColor(oldR, oldG, oldB)
        writeRgb(outData, i, neu, data[i + 3])
        const er = oldR - neu[0]
        const eg = oldG - neu[1]
        const eb = oldB - neu[2]
        for (const tap of kernel.taps) {
          const tx = x + (ltr ? tap.dx : -tap.dx)
          const ty = y + tap.dy
          if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue
          const ti = ty * width + tx
          const f = tap.w / kernel.div
          rCh[ti] += er * f
          gCh[ti] += eg * f
          bCh[ti] += eb * f
        }
      }
    }
    return finalizeOut(out, preR, preG, preB, data, options.strength)
  }

  // Luminance error diffusion
  for (let y = 0; y < height; y++) {
    const ltr = !options.serpentine || y % 2 === 0
    const xStart = ltr ? 0 : width - 1
    const xEnd = ltr ? width : -1
    const xStep = ltr ? 1 : -1
    for (let x = xStart; x !== xEnd; x += xStep) {
      const idx = y * width + x
      const i = idx * 4
      let old = gray[idx]
      if (algo === 'hybrid') {
        const matrix = BAYER_8
        const m = (matrix[y % 8][x % 8] + 0.5) / 64
        old += (m - 0.5) * 48
      }
      const neuC = quantizeGray(old, idx)
      const neu = luminance(neuC[0], neuC[1], neuC[2])
      const err = old - neu
      writeRgb(outData, i, neuC, data[i + 3])
      for (const tap of kernel.taps) {
        const tx = x + (ltr ? tap.dx : -tap.dx)
        const ty = y + tap.dy
        if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue
        gray[ty * width + tx] += (err * tap.w) / kernel.div
      }
    }
  }

  return finalizeOut(out, preR, preG, preB, data, options.strength)
}

export function upscaleNearest(buffer: PixelBuffer, factor: number): PixelBuffer {
  const f = Math.max(1, Math.round(factor))
  if (f === 1) return buffer
  const { width, height, data } = buffer
  const out = createPixelBuffer(width * f, height * f)
  const od = out.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const di = ((y * f + dy) * width * f + (x * f + dx)) * 4
          od[di] = data[si]
          od[di + 1] = data[si + 1]
          od[di + 2] = data[si + 2]
          od[di + 3] = data[si + 3]
        }
      }
    }
  }
  return out
}

export function downsampleBuffer(
  buffer: PixelBuffer,
  maxDim: number,
  pixelSize: number,
): PixelBuffer {
  const { width: sw, height: sh, data } = buffer
  let tw = sw
  let th = sh
  if (maxDim > 0 && Math.max(sw, sh) > maxDim) {
    const r = maxDim / Math.max(sw, sh)
    tw = Math.max(1, Math.round(sw * r))
    th = Math.max(1, Math.round(sh * r))
  }
  const ps = Math.max(1, Math.round(pixelSize))
  const ww = Math.max(1, Math.round(tw / ps))
  const wh = Math.max(1, Math.round(th / ps))
  const out = createPixelBuffer(ww, wh)
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const x0 = Math.floor((x * sw) / ww)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / ww))
      const y0 = Math.floor((y * sh) / wh)
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / wh))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          a += data[i + 3]
          n++
        }
      }
      const di = (y * ww + x) * 4
      out.data[di] = r / n
      out.data[di + 1] = g / n
      out.data[di + 2] = b / n
      out.data[di + 3] = a / n
    }
  }
  return out
}

/** Median-cut palette extraction */
export function extractPalette(buffer: PixelBuffer, count: number): Rgb[] {
  const n = Math.max(2, Math.min(16, Math.round(count)))
  type Px = { r: number; g: number; b: number }
  const pixels: Px[] = []
  const { data, width, height } = buffer
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 8000)))
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 16) continue
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    }
  }
  if (pixels.length === 0) return [[0, 0, 0], [255, 255, 255]]

  type Box = { pts: Px[] }
  const range = (pts: Px[], ch: 'r' | 'g' | 'b') => {
    let lo = 255
    let hi = 0
    for (const p of pts) {
      lo = Math.min(lo, p[ch])
      hi = Math.max(hi, p[ch])
    }
    return hi - lo
  }
  const boxes: Box[] = [{ pts: pixels }]
  while (boxes.length < n) {
    let bi = 0
    let best = -1
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].pts.length < 2) continue
      const score = Math.max(range(boxes[i].pts, 'r'), range(boxes[i].pts, 'g'), range(boxes[i].pts, 'b'))
      if (score > best) {
        best = score
        bi = i
      }
    }
    if (best <= 0) break
    const box = boxes.splice(bi, 1)[0]
    const ch =
      range(box.pts, 'r') >= range(box.pts, 'g') && range(box.pts, 'r') >= range(box.pts, 'b')
        ? 'r'
        : range(box.pts, 'g') >= range(box.pts, 'b')
          ? 'g'
          : 'b'
    box.pts.sort((a, b) => a[ch] - b[ch])
    const mid = Math.floor(box.pts.length / 2)
    boxes.push({ pts: box.pts.slice(0, mid) }, { pts: box.pts.slice(mid) })
  }

  return boxes.map((box) => {
    let r = 0
    let g = 0
    let b = 0
    for (const p of box.pts) {
      r += p.r
      g += p.g
      b += p.b
    }
    const m = box.pts.length || 1
    return [Math.round(r / m), Math.round(g / m), Math.round(b / m)] as Rgb
  })
}

export function mergeDitherOptions(
  overrides: Partial<{
    algorithm: string
    threshold: number
    invert: boolean
    serpentine: boolean
    dark: string
    light: string
    darkColor: Rgb
    lightColor: Rgb
    cellSize: number
    palette: string[] | Rgb[]
    seed: number
    gamma: number
    contrast: number
    edgeAware: boolean
    colorMode: boolean
    brightness: number
    saturation: number
    noise: number
    strength: number
    softness: number
  }> = {},
): DitherOptions {
  const base = { ...DEFAULT_DITHER_OPTIONS }
  if (overrides.algorithm) {
    if (!isAlgorithmId(overrides.algorithm)) {
      throw new Error(
        `Unknown algorithm "${overrides.algorithm}". Use: ${ALGORITHM_IDS.join(', ')}`,
      )
    }
    base.algorithm = overrides.algorithm
  }
  if (overrides.threshold !== undefined) base.threshold = overrides.threshold
  if (overrides.invert !== undefined) base.invert = overrides.invert
  if (overrides.serpentine !== undefined) base.serpentine = overrides.serpentine
  if (overrides.cellSize !== undefined) base.cellSize = overrides.cellSize
  if (overrides.darkColor) base.darkColor = overrides.darkColor
  if (overrides.lightColor) base.lightColor = overrides.lightColor
  if (overrides.dark) base.darkColor = hexToRgb(overrides.dark)
  if (overrides.light) base.lightColor = hexToRgb(overrides.light)
  if (overrides.seed !== undefined) base.seed = overrides.seed
  if (overrides.gamma !== undefined) base.gamma = overrides.gamma
  if (overrides.contrast !== undefined) base.contrast = overrides.contrast
  if (overrides.edgeAware !== undefined) base.edgeAware = overrides.edgeAware
  if (overrides.colorMode !== undefined) base.colorMode = overrides.colorMode
  if (overrides.brightness !== undefined) base.brightness = overrides.brightness
  if (overrides.saturation !== undefined) base.saturation = overrides.saturation
  if (overrides.noise !== undefined) base.noise = overrides.noise
  if (overrides.strength !== undefined) base.strength = overrides.strength
  if (overrides.softness !== undefined) base.softness = overrides.softness
  if (overrides.palette) {
    base.palette = overrides.palette.map((c) =>
      typeof c === 'string' ? hexToRgb(c) : (c as Rgb),
    )
  }
  return normalizeOptions(base)
}

/** @deprecated */
export function ditherImageData(
  imageData: { width: number; height: number; data: Uint8ClampedArray },
  options: DitherOptions,
): PixelBuffer {
  return dither(imageData, options)
}

/** Full process: downsample → dither → upscale pixel → export scale */
export function processBuffer(
  source: PixelBuffer,
  opts: {
    dither?: Partial<DitherOptions>
    pixelSize?: number
    maxDim?: number
    exportScale?: number
  } = {},
): PixelBuffer {
  const pixelSize = Math.max(1, Math.round(opts.pixelSize ?? 1))
  const maxDim = opts.maxDim ?? 0
  const exportScale = Math.max(1, Math.round(opts.exportScale ?? 1))
  let buf = downsampleBuffer(source, maxDim || 999999, pixelSize)
  buf = dither(buf, opts.dither)
  if (pixelSize > 1) buf = upscaleNearest(buf, pixelSize)
  if (exportScale > 1) buf = upscaleNearest(buf, exportScale)
  return buf
}
