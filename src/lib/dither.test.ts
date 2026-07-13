import { describe, expect, it } from 'vitest'
import {
  createPixelBuffer,
  dither,
  extractPalette,
  processBuffer,
} from './dither'

function gradient(w: number, h: number) {
  const buf = createPixelBuffer(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const v = Math.round((x / (w - 1)) * 255)
      buf.data[i] = v
      buf.data[i + 1] = v
      buf.data[i + 2] = v
      buf.data[i + 3] = 255
    }
  }
  return buf
}

describe('dither core', () => {
  it('floyd-steinberg is deterministic', () => {
    const src = gradient(32, 24)
    const a = dither(src, { algorithm: 'floyd-steinberg', seed: 1 })
    const b = dither(src, { algorithm: 'floyd-steinberg', seed: 1 })
    expect(a.data).toEqual(b.data)
  })

  it('random respects seed', () => {
    const src = gradient(32, 24)
    const a = dither(src, { algorithm: 'random', seed: 99 })
    const b = dither(src, { algorithm: 'random', seed: 99 })
    const c = dither(src, { algorithm: 'random', seed: 100 })
    expect(a.data).toEqual(b.data)
    expect(a.data).not.toEqual(c.data)
  })

  it('threshold produces only palette colors', () => {
    const src = gradient(16, 16)
    const out = dither(src, {
      algorithm: 'threshold',
      darkColor: [0, 0, 0],
      lightColor: [255, 255, 255],
      threshold: 128,
    })
    for (let i = 0; i < out.data.length; i += 4) {
      const v = out.data[i]
      expect(v === 0 || v === 255).toBe(true)
      expect(out.data[i]).toBe(out.data[i + 1])
    }
  })

  it('multi-color palette quantizes to palette only', () => {
    const src = gradient(24, 24)
    const palette: [number, number, number][] = [
      [0, 0, 0],
      [80, 80, 80],
      [160, 160, 160],
      [255, 255, 255],
    ]
    const out = dither(src, {
      algorithm: 'floyd-steinberg',
      palette,
      colorMode: false,
    })
    const set = new Set(palette.map((c) => c.join(',')))
    for (let i = 0; i < out.data.length; i += 4) {
      const key = `${out.data[i]},${out.data[i + 1]},${out.data[i + 2]}`
      expect(set.has(key)).toBe(true)
    }
  })

  it('blue-noise and hybrid run without throw', () => {
    const src = gradient(20, 20)
    expect(() => dither(src, { algorithm: 'blue-noise', seed: 3 })).not.toThrow()
    expect(() => dither(src, { algorithm: 'hybrid' })).not.toThrow()
    expect(() => dither(src, { algorithm: 'riemersma' })).not.toThrow()
  })

  it('processBuffer upscales export scale', () => {
    const src = gradient(10, 10)
    const out = processBuffer(src, {
      dither: { algorithm: 'threshold' },
      pixelSize: 1,
      maxDim: 100,
      exportScale: 2,
    })
    expect(out.width).toBe(20)
    expect(out.height).toBe(20)
  })

  it('extractPalette returns requested count', () => {
    const src = gradient(40, 40)
    const pal = extractPalette(src, 4)
    expect(pal.length).toBeGreaterThanOrEqual(2)
    expect(pal.length).toBeLessThanOrEqual(4)
  })
})
