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

export interface AlgorithmMeta {
  id: AlgorithmId
  name: string
  family: 'point' | 'error' | 'ordered' | 'pattern'
  blurb: string
}

export const ALGORITHMS: AlgorithmMeta[] = [
  { id: 'threshold', name: 'Threshold', family: 'point', blurb: 'Hard cut. No diffusion.' },
  { id: 'random', name: 'Random', family: 'point', blurb: 'Noise threshold. Grainy.' },
  {
    id: 'floyd-steinberg',
    name: 'Floyd-Steinberg',
    family: 'error',
    blurb: 'Classic error diffusion.',
  },
  { id: 'atkinson', name: 'Atkinson', family: 'error', blurb: 'Mac classic. Higher contrast.' },
  {
    id: 'jjn',
    name: 'Jarvis-Judice-Ninke',
    family: 'error',
    blurb: 'Wide kernel. Soft detail.',
  },
  { id: 'stucki', name: 'Stucki', family: 'error', blurb: 'Sharp, clean diffusion.' },
  { id: 'burkes', name: 'Burkes', family: 'error', blurb: 'Faster wide kernel.' },
  { id: 'sierra', name: 'Sierra', family: 'error', blurb: 'Balanced mid-tone spread.' },
  { id: 'bayer-2', name: 'Bayer 2x2', family: 'ordered', blurb: 'Tiny ordered matrix.' },
  { id: 'bayer-4', name: 'Bayer 4x4', family: 'ordered', blurb: 'Standard ordered dither.' },
  { id: 'bayer-8', name: 'Bayer 8x8', family: 'ordered', blurb: 'Fine ordered texture.' },
  { id: 'halftone', name: 'Halftone', family: 'pattern', blurb: 'Circular print dots.' },
]

export const ALGORITHM_IDS = ALGORITHMS.map((a) => a.id) as AlgorithmId[]

/** RGBA pixel buffer (compatible with ImageData shape). */
export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface DitherOptions {
  algorithm: AlgorithmId
  /** 0-255 */
  threshold: number
  invert: boolean
  serpentine: boolean
  darkColor: [number, number, number]
  lightColor: [number, number, number]
  /** Halftone cell size in pixels (2-32) */
  cellSize: number
}

export const DEFAULT_DITHER_OPTIONS: DitherOptions = {
  algorithm: 'floyd-steinberg',
  threshold: 128,
  invert: false,
  serpentine: true,
  darkColor: [17, 17, 17],
  lightColor: [250, 250, 250],
  cellSize: 6,
}

export function createPixelBuffer(width: number, height: number, data?: Uint8ClampedArray): PixelBuffer {
  const size = width * height * 4
  return {
    width,
    height,
    data: data ?? new Uint8ClampedArray(size),
  }
}

export function isAlgorithmId(value: string): value is AlgorithmId {
  return (ALGORITHM_IDS as string[]).includes(value)
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hexToRgb(hex: string): [number, number, number] {
  return parseHex(hex)
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
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

function writePixel(
  out: Uint8ClampedArray,
  i: number,
  on: boolean,
  dark: [number, number, number],
  light: [number, number, number],
  alpha: number,
) {
  const c = on ? light : dark
  out[i] = c[0]
  out[i + 1] = c[1]
  out[i + 2] = c[2]
  out[i + 3] = alpha
}

function normalizeOptions(partial?: Partial<DitherOptions>): DitherOptions {
  return {
    ...DEFAULT_DITHER_OPTIONS,
    ...partial,
    threshold: Math.max(0, Math.min(255, partial?.threshold ?? DEFAULT_DITHER_OPTIONS.threshold)),
    cellSize: Math.max(2, Math.min(32, partial?.cellSize ?? DEFAULT_DITHER_OPTIONS.cellSize)),
  }
}

/**
 * Dither an RGBA buffer. Returns a new buffer (input is not mutated).
 */
export function dither(buffer: PixelBuffer, partial?: Partial<DitherOptions>): PixelBuffer {
  const options = normalizeOptions(partial)
  const { width, height, data } = buffer
  const out = createPixelBuffer(width, height)
  const outData = out.data

  const dark = options.invert ? options.lightColor : options.darkColor
  const light = options.invert ? options.darkColor : options.lightColor
  const thr = options.threshold

  const gray = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      gray[y * width + x] = luminance(data[i], data[i + 1], data[i + 2])
    }
  }

  const algo = options.algorithm

  if (algo === 'threshold' || algo === 'random') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const i = idx * 4
        const g = gray[idx]
        const t = algo === 'random' ? thr + (Math.random() * 2 - 1) * 64 : thr
        writePixel(outData, i, g >= t, dark, light, data[i + 3])
      }
    }
    return out
  }

  if (algo.startsWith('bayer-')) {
    const matrix = algo === 'bayer-2' ? BAYER_2 : algo === 'bayer-4' ? BAYER_4 : BAYER_8
    const n = matrix.length
    const levels = n * n
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const i = idx * 4
        const m = (matrix[y % n][x % n] + 0.5) / levels
        const localThr = thr + (m - 0.5) * 255
        writePixel(outData, i, gray[idx] >= localThr, dark, light, data[i + 3])
      }
    }
    return out
  }

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
        const brightness = g / 255
        const maxR = cell * 0.5 * Math.SQRT2
        const tNorm = thr / 255
        const radius = maxR * (1 - brightness) * (0.4 + tNorm * 0.8)
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        writePixel(outData, i, dist > radius, dark, light, data[i + 3])
      }
    }
    return out
  }

  const kernel = KERNELS[algo]
  if (!kernel) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        writePixel(outData, idx * 4, gray[idx] >= thr, dark, light, data[idx * 4 + 3])
      }
    }
    return out
  }

  for (let y = 0; y < height; y++) {
    const leftToRight = !options.serpentine || y % 2 === 0
    const xStart = leftToRight ? 0 : width - 1
    const xEnd = leftToRight ? width : -1
    const xStep = leftToRight ? 1 : -1

    for (let x = xStart; x !== xEnd; x += xStep) {
      const idx = y * width + x
      const i = idx * 4
      const old = gray[idx]
      const neu = old >= thr ? 255 : 0
      const err = old - neu
      writePixel(outData, i, neu === 255, dark, light, data[i + 3])

      for (const tap of kernel.taps) {
        const tx = x + (leftToRight ? tap.dx : -tap.dx)
        const ty = y + tap.dy
        if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue
        gray[ty * width + tx] += (err * tap.w) / kernel.div
      }
    }
  }

  return out
}

/** @deprecated Use dither() */
export function ditherImageData(
  imageData: { width: number; height: number; data: Uint8ClampedArray },
  options: DitherOptions,
): PixelBuffer {
  return dither(imageData, options)
}

/** Nearest-neighbor upscale for chunky pixels. */
export function upscaleNearest(buffer: PixelBuffer, factor: number): PixelBuffer {
  const f = Math.max(1, Math.round(factor))
  if (f === 1) return buffer
  const { width, height, data } = buffer
  const out = createPixelBuffer(width * f, height * f)
  const od = out.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      const r = data[si]
      const g = data[si + 1]
      const b = data[si + 2]
      const a = data[si + 3]
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const di = ((y * f + dy) * width * f + (x * f + dx)) * 4
          od[di] = r
          od[di + 1] = g
          od[di + 2] = b
          od[di + 3] = a
        }
      }
    }
  }
  return out
}

/**
 * Downsample RGBA buffer by block-averaging (pixelSize) after optional max-dim fit.
 * Pure (no canvas). Used by Node and can be used when you already have raw pixels.
 */
export function downsampleBuffer(
  buffer: PixelBuffer,
  maxDim: number,
  pixelSize: number,
): PixelBuffer {
  const { width: sw, height: sh, data } = buffer
  let tw = sw
  let th = sh
  if (Math.max(sw, sh) > maxDim) {
    const r = maxDim / Math.max(sw, sh)
    tw = Math.max(1, Math.round(sw * r))
    th = Math.max(1, Math.round(sh * r))
  }
  const ps = Math.max(1, Math.round(pixelSize))
  const ww = Math.max(1, Math.round(tw / ps))
  const wh = Math.max(1, Math.round(th / ps))

  // Box filter into target size
  const out = createPixelBuffer(ww, wh)
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const x0 = Math.floor((x * sw) / ww)
      const x1 = Math.floor(((x + 1) * sw) / ww)
      const y0 = Math.floor((y * sh) / wh)
      const y1 = Math.floor(((y + 1) * sh) / wh)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < Math.max(y0 + 1, y1); sy++) {
        for (let sx = x0; sx < Math.max(x0 + 1, x1); sx++) {
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

export function mergeDitherOptions(
  overrides: Partial<{
    algorithm: string
    threshold: number
    invert: boolean
    serpentine: boolean
    dark: string
    light: string
    darkColor: [number, number, number]
    lightColor: [number, number, number]
    cellSize: number
  }> = {},
): DitherOptions {
  const base = { ...DEFAULT_DITHER_OPTIONS }
  if (overrides.algorithm) {
    if (!isAlgorithmId(overrides.algorithm)) {
      throw new Error(
        `Unknown algorithm "${overrides.algorithm}". Use one of: ${ALGORITHM_IDS.join(', ')}`,
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
  return normalizeOptions(base)
}
