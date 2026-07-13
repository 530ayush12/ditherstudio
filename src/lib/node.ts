import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  type DitherOptions,
  type PixelBuffer,
  createPixelBuffer,
  dither,
  downsampleBuffer,
  mergeDitherOptions,
  upscaleNearest,
} from './dither.ts'

export interface ProcessFileOptions {
  algorithm?: string
  threshold?: number
  invert?: boolean
  serpentine?: boolean
  dark?: string
  light?: string
  cellSize?: number
  /** Work at 1/N resolution then nearest upscale (chunky pixels). */
  pixelSize?: number
  /** Cap longest edge before dither (default 4096). */
  maxDim?: number
  /** Output format */
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
}

export interface ProcessResult {
  buffer: Buffer
  width: number
  height: number
  format: string
  options: DitherOptions
  pixelSize: number
}

async function bufferToPixels(input: Buffer): Promise<PixelBuffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 4) {
    throw new Error(`Expected 4 channels, got ${info.channels}`)
  }
  return createPixelBuffer(info.width, info.height, new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength))
}

async function pixelsToEncoded(
  pixels: PixelBuffer,
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
): Promise<Buffer> {
  let pipeline = sharp(Buffer.from(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength), {
    raw: {
      width: pixels.width,
      height: pixels.height,
      channels: 4,
    },
  })

  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true })
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality })
  } else {
    pipeline = pipeline.png()
  }

  return pipeline.toBuffer()
}

export async function ditherBuffer(
  input: Buffer,
  opts: ProcessFileOptions = {},
): Promise<ProcessResult> {
  const pixelSize = Math.max(1, Math.round(opts.pixelSize ?? 1))
  const maxDim = opts.maxDim ?? 4096
  const format = opts.format ?? 'png'
  const quality = opts.quality ?? 90
  const options = mergeDitherOptions(opts)

  let pixels = await bufferToPixels(input)
  pixels = downsampleBuffer(pixels, maxDim, pixelSize)
  let result = dither(pixels, options)
  if (pixelSize > 1) {
    result = upscaleNearest(result, pixelSize)
  }

  const encoded = await pixelsToEncoded(result, format, quality)
  return {
    buffer: encoded,
    width: result.width,
    height: result.height,
    format,
    options,
    pixelSize,
  }
}

export async function ditherFile(
  inputPath: string,
  outputPath: string,
  opts: ProcessFileOptions = {},
): Promise<ProcessResult> {
  const input = await readFile(inputPath)
  // Infer format from output extension if not set
  if (!opts.format) {
    const ext = path.extname(outputPath).toLowerCase()
    if (ext === '.jpg' || ext === '.jpeg') opts = { ...opts, format: 'jpeg' }
    else if (ext === '.webp') opts = { ...opts, format: 'webp' }
    else opts = { ...opts, format: 'png' }
  }
  const result = await ditherBuffer(input, opts)
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
  return {
    ...result,
    base64: result.buffer.toString('base64'),
  }
}
