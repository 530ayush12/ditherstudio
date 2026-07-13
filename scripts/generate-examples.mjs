/**
 * Generate demo sources + dithered examples for websites and studio.
 * Run: node scripts/generate-examples.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  createPixelBuffer,
  dither,
  processBuffer,
  hexToRgb,
} from '../src/lib/dither.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const skillWeb = path.resolve(root, '../ditherskill/website/examples')
const studioPub = path.resolve(root, 'public/examples')

async function ensure(dir) {
  await mkdir(dir, { recursive: true })
}

function writeRaw(w, h, fn) {
  const buf = createPixelBuffer(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const [r, g, b] = fn(x, y, w, h)
      buf.data[i] = r
      buf.data[i + 1] = g
      buf.data[i + 2] = b
      buf.data[i + 3] = 255
    }
  }
  return buf
}

async function savePng(buffer, file) {
  const raw = Buffer.from(buffer.data.buffer, buffer.data.byteOffset, buffer.data.byteLength)
  await sharp(raw, { raw: { width: buffer.width, height: buffer.height, channels: 4 } })
    .png()
    .toFile(file)
}

// Synthetic subjects
const sources = {
  portrait: writeRaw(480, 560, (x, y, w, h) => {
    const nx = x / w
    const ny = y / h
    // soft face-like oval
    const cx = 0.5
    const cy = 0.42
    const dx = (nx - cx) / 0.28
    const dy = (ny - cy) / 0.36
    const face = Math.exp(-(dx * dx + dy * dy))
    const hair = ny < 0.28 ? 0.15 : 0
    const bg = 0.75 + 0.15 * Math.sin(nx * 6) * Math.cos(ny * 4)
    let v = bg * (1 - face * 0.85) + face * (0.55 + 0.2 * Math.sin(nx * 12 + ny * 8))
    v = v * (1 - hair) + hair * 0.08
    // shoulders
    if (ny > 0.68 && Math.abs(nx - 0.5) < 0.35 + (ny - 0.68) * 0.5) v = 0.35 + (nx - 0.5) * 0.1
    const g = Math.max(0, Math.min(255, Math.round(v * 255)))
    return [g, Math.round(g * 0.96), Math.round(g * 0.9)]
  }),
  photo: writeRaw(640, 400, (x, y, w, h) => {
    const nx = x / w
    const ny = y / h
    // landscape-ish
    const sky = 180 + 40 * (1 - ny)
    const hill = ny > 0.55 + 0.08 * Math.sin(nx * 8) ? 60 + 40 * nx : sky
    const sun = Math.hypot(nx - 0.78, ny - 0.22)
    let r = hill
    let g = hill * 0.95
    let b = hill * 0.85
    if (ny < 0.55 + 0.08 * Math.sin(nx * 8)) {
      r = 140 + 60 * nx
      g = 170 + 30 * (1 - ny)
      b = 210
    }
    if (sun < 0.12) {
      const t = 1 - sun / 0.12
      r = r * (1 - t) + 255 * t
      g = g * (1 - t) + 230 * t
      b = b * (1 - t) + 120 * t
    }
    return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))))
  }),
  ui: writeRaw(560, 360, (x, y, w, h) => {
    const nx = x / w
    const ny = y / h
    // faux dashboard
    let r = 245
    let g = 245
    let b = 248
    // sidebar
    if (nx < 0.22) {
      r = 24
      g = 24
      b = 28
    }
    // cards
    if (nx > 0.28 && nx < 0.62 && ny > 0.18 && ny < 0.48) {
      r = 255
      g = 255
      b = 255
    }
    if (nx > 0.66 && nx < 0.94 && ny > 0.18 && ny < 0.48) {
      r = 20
      g = 20
      b = 24
    }
    // chart bars
    if (nx > 0.3 && nx < 0.9 && ny > 0.58 && ny < 0.88) {
      const bar = Math.floor((nx - 0.3) / 0.08)
      const height = 0.15 + (bar % 5) * 0.06
      if (ny > 0.88 - height) {
        r = 30 + bar * 20
        g = 30 + bar * 10
        b = 40
      } else {
        r = 236
        g = 236
        b = 240
      }
    }
    // noise
    const n = ((x * 12.9898 + y * 78.233) % 1) * 8
    return [r + n, g + n, b + n].map((v) => Math.max(0, Math.min(255, Math.round(v))))
  }),
  logo: writeRaw(400, 400, (x, y, w, h) => {
    const cx = w / 2
    const cy = h / 2
    const dx = x - cx
    const dy = y - cy
    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    // ring + letter-like bars
    let on = dist > 110 && dist < 150
    if (Math.abs(dx) < 28 && dy > -90 && dy < 90) on = true
    if (Math.abs(dy + 40) < 22 && dx > -70 && dx < 70) on = true
    // soft bg gradient
    const bg = 230 + 20 * Math.sin(angle * 2)
    if (on) return [12, 12, 14]
    return [bg, bg, bg - 4].map((v) => Math.max(0, Math.min(255, Math.round(v))))
  }),
  gradient: writeRaw(480, 320, (x, y, w, h) => {
    const t = x / (w - 1)
    const s = y / (h - 1)
    const r = t * 255
    const g = (1 - t) * 180 + s * 40
    const b = s * 220
    return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))))
  }),
}

const demos = [
  {
    id: 'portrait-fs',
    source: 'portrait',
    title: 'Portrait · Floyd-Steinberg',
    blurb: 'Classic error diffusion on continuous tone.',
    opts: { algorithm: 'floyd-steinberg', threshold: 128 },
  },
  {
    id: 'portrait-atkinson',
    source: 'portrait',
    title: 'Portrait · Atkinson',
    blurb: 'Higher contrast Mac print heritage.',
    opts: { algorithm: 'atkinson', threshold: 130 },
  },
  {
    id: 'photo-blue',
    source: 'photo',
    title: 'Landscape · Blue noise',
    blurb: 'Modern grain without ordered lattice.',
    opts: { algorithm: 'blue-noise', seed: 11, threshold: 128 },
  },
  {
    id: 'photo-halftone',
    source: 'photo',
    title: 'Landscape · Halftone',
    blurb: 'Circular print dots.',
    opts: { algorithm: 'halftone', cellSize: 8, threshold: 140 },
  },
  {
    id: 'ui-bayer',
    source: 'ui',
    title: 'UI · Bayer 8×8',
    blurb: 'Stable ordered texture for interfaces.',
    opts: { algorithm: 'bayer-8', threshold: 128 },
  },
  {
    id: 'ui-gameboy',
    source: 'ui',
    title: 'UI · Game Boy palette',
    blurb: '4-color median-style brand look.',
    opts: {
      algorithm: 'floyd-steinberg',
      palette: [
        hexToRgb('#0f380f'),
        hexToRgb('#306230'),
        hexToRgb('#8bac0f'),
        hexToRgb('#9bbc0f'),
      ],
      colorMode: true,
    },
  },
  {
    id: 'logo-threshold',
    source: 'logo',
    title: 'Logo · 1-bit mark',
    blurb: 'Hard cut for favicons and stamps.',
    opts: { algorithm: 'threshold', threshold: 140, darkColor: [0, 0, 0], lightColor: [255, 255, 255] },
  },
  {
    id: 'logo-chunky',
    source: 'logo',
    title: 'Logo · Chunky Bayer',
    blurb: 'Pixel size 4 for retro marks.',
    opts: { algorithm: 'bayer-4', threshold: 128 },
    pixelSize: 4,
  },
  {
    id: 'gradient-hybrid',
    source: 'gradient',
    title: 'Gradient · Hybrid',
    blurb: 'Bayer bias + error diffusion.',
    opts: { algorithm: 'hybrid', threshold: 128 },
  },
  {
    id: 'gradient-riemersma',
    source: 'gradient',
    title: 'Gradient · Riemersma',
    blurb: 'Hilbert-path diffusion.',
    opts: { algorithm: 'riemersma', threshold: 128 },
  },
  {
    id: 'photo-riso',
    source: 'photo',
    title: 'Landscape · Riso palette',
    blurb: 'Multi-ink dual + accent feel.',
    opts: {
      algorithm: 'stucki',
      palette: [hexToRgb('#000000'), hexToRgb('#ff4800'), hexToRgb('#0078bf'), hexToRgb('#fff6e6')],
      colorMode: true,
    },
  },
  {
    id: 'portrait-chunky',
    source: 'portrait',
    title: 'Portrait · Chunky FS',
    blurb: 'Pixel size 3 portrait print.',
    opts: { algorithm: 'floyd-steinberg', threshold: 120 },
    pixelSize: 3,
  },
]

const manifest = { generatedAt: new Date().toISOString(), sources: [], demos: [] }

async function main() {
  await ensure(studioPub)
  await ensure(path.join(studioPub, 'sources'))
  await ensure(path.join(studioPub, 'results'))
  await ensure(skillWeb)
  await ensure(path.join(skillWeb, 'sources'))
  await ensure(path.join(skillWeb, 'results'))

  for (const [name, buf] of Object.entries(sources)) {
    const rel = `sources/${name}.png`
    await savePng(buf, path.join(studioPub, rel))
    await savePng(buf, path.join(skillWeb, rel))
    manifest.sources.push({ id: name, file: rel, width: buf.width, height: buf.height })
    console.log('source', name)
  }

  for (const demo of demos) {
    const src = sources[demo.source]
    const out = processBuffer(src, {
      dither: demo.opts,
      pixelSize: demo.pixelSize ?? 1,
      maxDim: 0,
      exportScale: 1,
    })
    const rel = `results/${demo.id}.png`
    await savePng(out, path.join(studioPub, rel))
    await savePng(out, path.join(skillWeb, rel))
    manifest.demos.push({
      id: demo.id,
      title: demo.title,
      blurb: demo.blurb,
      source: demo.source,
      sourceFile: `sources/${demo.source}.png`,
      resultFile: rel,
      algorithm: demo.opts.algorithm,
      pixelSize: demo.pixelSize ?? 1,
    })
    console.log('demo', demo.id)
  }

  const json = JSON.stringify(manifest, null, 2)
  await writeFile(path.join(studioPub, 'manifest.json'), json)
  await writeFile(path.join(skillWeb, 'manifest.json'), json)
  console.log('Wrote', demos.length, 'demos to studio + skill websites')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
