import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  type DitherOptions,
  type PixelBuffer,
  createPixelBuffer,
  mergeDitherOptions,
  processBuffer,
} from './dither.ts'

export interface ProcessFileOptions {
  algorithm?: string
  threshold?: number
  invert?: boolean
  serpentine?: boolean
  dark?: string
  light?: string
  cellSize?: number
  pixelSize?: number
  maxDim?: number
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
  seed?: number
  gamma?: number
  contrast?: number
  edgeAware?: boolean
  colorMode?: boolean
  palette?: string[]
  exportScale?: number
}

export interface ProcessResult {
  buffer: Buffer
  width: number
  height: number
  format: string
  options: DitherOptions
  pixelSize: number
  ms: number
}

async function bufferToPixels(input: Buffer): Promise<PixelBuffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 4) throw new Error(`Expected 4 channels, got ${info.channels}`)
  return createPixelBuffer(
    info.width,
    info.height,
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  )
}

async function pixelsToEncoded(
  pixels: PixelBuffer,
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
): Promise<Buffer> {
  let pipeline = sharp(
    Buffer.from(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength),
    {
      raw: { width: pixels.width, height: pixels.height, channels: 4 },
    },
  )
  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality, mozjpeg: true })
  else if (format === 'webp') pipeline = pipeline.webp({ quality })
  else pipeline = pipeline.png()
  return pipeline.toBuffer()
}

function toMerge(opts: ProcessFileOptions) {
  return mergeDitherOptions({
    algorithm: opts.algorithm,
    threshold: opts.threshold,
    invert: opts.invert,
    serpentine: opts.serpentine,
    dark: opts.dark,
    light: opts.light,
    cellSize: opts.cellSize,
    seed: opts.seed,
    gamma: opts.gamma,
    contrast: opts.contrast,
    edgeAware: opts.edgeAware,
    colorMode: opts.colorMode,
    palette: opts.palette,
  })
}

export async function ditherBuffer(
  input: Buffer,
  opts: ProcessFileOptions = {},
): Promise<ProcessResult> {
  const started = Date.now()
  const pixelSize = Math.max(1, Math.round(opts.pixelSize ?? 1))
  const maxDim = opts.maxDim ?? 4096
  const format = opts.format ?? 'png'
  const quality = opts.quality ?? 90
  const exportScale = Math.max(1, Math.round(opts.exportScale ?? 1))
  const options = toMerge(opts)

  const pixels = await bufferToPixels(input)
  const result = processBuffer(pixels, {
    dither: options,
    pixelSize,
    maxDim,
    exportScale,
  })
  const encoded = await pixelsToEncoded(result, format, quality)
  return {
    buffer: encoded,
    width: result.width,
    height: result.height,
    format,
    options,
    pixelSize,
    ms: Date.now() - started,
  }
}

export async function ditherFile(
  inputPath: string,
  outputPath: string,
  opts: ProcessFileOptions = {},
): Promise<ProcessResult> {
  const input = await readFile(inputPath)
  if (!opts.format) {
    const ext = path.extname(outputPath).toLowerCase()
    if (ext === '.jpg' || ext === '.jpeg') opts = { ...opts, format: 'jpeg' }
    else if (ext === '.webp') opts = { ...opts, format: 'webp' }
    else opts = { ...opts, format: 'png' }
  }
  const result = await ditherBuffer(input, opts)
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true }).catch(() => {})
  await writeFile(outputPath, result.buffer)
  return result
}

export async function ditherBase64(
  base64: string,
  opts: ProcessFileOptions = {},
): Promise<ProcessResult & { base64: string }> {
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, '')
  const input = Buffer.from(cleaned, 'base64')
  const result = await ditherBuffer(input, opts)
  return { ...result, base64: result.buffer.toString('base64') }
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tif', '.tiff', '.svg'])

export async function ditherBatch(
  inputGlobOrDir: string,
  outputDir: string,
  opts: ProcessFileOptions = {},
): Promise<ProcessResult[]> {
  const st = await stat(inputGlobOrDir).catch(() => null)
  let files: string[] = []
  if (st?.isDirectory()) {
    const entries = await readdir(inputGlobOrDir)
    files = entries
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .map((f) => path.join(inputGlobOrDir, f))
  } else if (inputGlobOrDir.includes('*')) {
    // simple basename glob in dir
    const dir = path.dirname(inputGlobOrDir)
    const pattern = path.basename(inputGlobOrDir)
    const re = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i',
    )
    const entries = await readdir(dir)
    files = entries.filter((f) => re.test(f)).map((f) => path.join(dir, f))
  } else {
    files = [inputGlobOrDir]
  }

  await mkdir(outputDir, { recursive: true })
  const results: ProcessResult[] = []
  for (const file of files) {
    const base = path.basename(file, path.extname(file))
    const ext =
      opts.format === 'jpeg' ? '.jpg' : opts.format === 'webp' ? '.webp' : '.png'
    const out = path.join(outputDir, `${base}-dither${ext}`)
    results.push(await ditherFile(file, out, opts))
  }
  return results
}
