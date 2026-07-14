import sharp from 'sharp'
import { unlink } from 'node:fs/promises'
import {
  createPixelBuffer,
  processBuffer,
  hexToRgb,
} from '../src/lib/dither.ts'

async function load(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return createPixelBuffer(
    info.width,
    info.height,
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  )
}

async function save(buf, path) {
  await sharp(Buffer.from(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength), {
    raw: { width: buf.width, height: buf.height, channels: 4 },
  })
    .png()
    .toFile(path)
}

async function main() {
  for (const name of ['portrait', 'photo', 'ui', 'logo']) {
    const p = `public/examples/sources/${name}.png`
    await sharp(p).png().toFile(p + '.tmp')
    await sharp(p + '.tmp').toFile(p)
    await unlink(p + '.tmp')
    console.log('normalized', name)
  }

  const jobs = [
    { src: 'portrait', out: 'portrait-fs', opts: { algorithm: 'floyd-steinberg' } },
    { src: 'portrait', out: 'portrait-atkinson', opts: { algorithm: 'atkinson' } },
    { src: 'portrait', out: 'portrait-chunky', opts: { algorithm: 'floyd-steinberg' }, pixelSize: 3 },
    { src: 'photo', out: 'photo-blue', opts: { algorithm: 'blue-noise', seed: 11 } },
    { src: 'photo', out: 'photo-halftone', opts: { algorithm: 'halftone', cellSize: 8 } },
    {
      src: 'photo',
      out: 'photo-riso',
      opts: {
        algorithm: 'stucki',
        palette: [hexToRgb('#000000'), hexToRgb('#ff4800'), hexToRgb('#0078bf'), hexToRgb('#fff6e6')],
        colorMode: true,
      },
    },
    { src: 'ui', out: 'ui-bayer', opts: { algorithm: 'bayer-8' } },
    {
      src: 'ui',
      out: 'ui-gameboy',
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
      src: 'logo',
      out: 'logo-threshold',
      opts: { algorithm: 'threshold', darkColor: [0, 0, 0], lightColor: [255, 255, 255] },
    },
    { src: 'logo', out: 'logo-chunky', opts: { algorithm: 'bayer-4' }, pixelSize: 4 },
  ]

  for (const j of jobs) {
    const src = await load(`public/examples/sources/${j.src}.png`)
    const out = processBuffer(src, {
      dither: j.opts,
      pixelSize: j.pixelSize || 1,
      maxDim: 720,
      exportScale: 1,
    })
    await save(out, `public/examples/results/${j.out}.png`)
    console.log('ok', j.out)
  }

  // also copy sources to skill website
  const { copyFile, mkdir } = await import('node:fs/promises')
  await mkdir('../ditherskill/website/examples/sources', { recursive: true })
  await mkdir('../ditherskill/website/examples/results', { recursive: true })
  for (const name of ['portrait', 'photo', 'ui', 'logo']) {
    await copyFile(
      `public/examples/sources/${name}.png`,
      `../ditherskill/website/examples/sources/${name}.png`,
    )
  }
  for (const j of jobs) {
    await copyFile(
      `public/examples/results/${j.out}.png`,
      `../ditherskill/website/examples/results/${j.out}.png`,
    )
  }
  console.log('synced to skill site')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
