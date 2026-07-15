import { readdir, readFile, writeFile, mkdir, stat, mkdtemp, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
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
  videoFps?: number
  videoCrf?: number
  keepAudio?: boolean
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

export interface VideoProcessResult {
  buffer: Buffer
  width: number
  height: number
  format: 'mp4' | 'webm' | 'mov'
  options: DitherOptions
  pixelSize: number
  frames: number
  fps: number
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
): Promise<ProcessResult | VideoProcessResult> {
  if (isVideoPath(inputPath) || isVideoPath(outputPath)) {
    return ditherVideoFile(inputPath, outputPath, opts)
  }
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

export async function ditherVideoBuffer(
  input: Buffer,
  opts: ProcessFileOptions = {},
): Promise<VideoProcessResult> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ditherstudio-video-buffer-'))
  const inputPath = path.join(tmp, 'input.mp4')
  const outputPath = path.join(tmp, `output.${opts.format === 'webp' ? 'webm' : 'mp4'}`)
  try {
    await writeFile(inputPath, input)
    return await ditherVideoFile(inputPath, outputPath, opts)
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tif', '.tiff', '.svg'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'])

function isVideoPath(file: string) {
  return VIDEO_EXT.has(path.extname(file).toLowerCase())
}

function videoFormatFromPath(file: string): VideoProcessResult['format'] {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.webm') return 'webm'
  if (ext === '.mov') return 'mov'
  return 'mp4'
}

function runBin(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    const err: Buffer[] = []
    child.stderr.on('data', (chunk) => err.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${bin} failed (${code}): ${Buffer.concat(err).toString('utf8').trim()}`))
    })
  })
}

async function ffprobe(inputPath: string): Promise<{ width: number; height: number; fps: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,avg_frame_rate,r_frame_rate',
      '-of',
      'json',
      inputPath,
    ])
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk) => out.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => err.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed (${code}): ${Buffer.concat(err).toString('utf8').trim()}`))
        return
      }
      try {
        const json = JSON.parse(Buffer.concat(out).toString('utf8')) as {
          streams?: { width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string }[]
        }
        const stream = json.streams?.[0]
        if (!stream?.width || !stream.height) throw new Error('No video stream found')
        const rate = stream.avg_frame_rate || stream.r_frame_rate || '30/1'
        const [n, d] = rate.split('/').map(Number)
        const fps = d ? n / d : n || 30
        resolve({ width: stream.width, height: stream.height, fps: Number.isFinite(fps) ? fps : 30 })
      } catch (errJson) {
        reject(errJson)
      }
    })
  })
}

export async function ditherVideoFile(
  inputPath: string,
  outputPath: string,
  opts: ProcessFileOptions = {},
): Promise<VideoProcessResult> {
  const started = Date.now()
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ditherstudio-video-'))
  const framesDir = path.join(tmp, 'frames')
  const outDir = path.join(tmp, 'out')
  await mkdir(framesDir)
  await mkdir(outDir)

  try {
    const meta = await ffprobe(inputPath)
    const fps = Math.max(1, opts.videoFps ?? meta.fps)
    const extractArgs = ['-y', '-i', inputPath]
    if (opts.videoFps) extractArgs.push('-vf', `fps=${fps}`)
    extractArgs.push(path.join(framesDir, 'frame-%06d.png'))
    await runBin('ffmpeg', extractArgs)

    const frames = (await readdir(framesDir))
      .filter((file) => file.endsWith('.png'))
      .sort()
    if (!frames.length) throw new Error('No video frames extracted')

    let width = 0
    let height = 0
    for (const frame of frames) {
      const inputFrame = path.join(framesDir, frame)
      const outputFrame = path.join(outDir, frame)
      const result = await ditherFile(inputFrame, outputFrame, { ...opts, format: 'png' })
      width = result.width
      height = result.height
    }

    await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true }).catch(() => {})
    const format = videoFormatFromPath(outputPath)
    const crf = String(Math.max(0, Math.min(63, opts.videoCrf ?? 24)))
    const encodeArgs = [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(outDir, 'frame-%06d.png'),
      '-i',
      inputPath,
      '-map',
      '0:v:0',
    ]
    if (opts.keepAudio !== false) encodeArgs.push('-map', '1:a?', '-shortest')
    if (format === 'webm') {
      encodeArgs.push('-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0', '-pix_fmt', 'yuva420p')
      if (opts.keepAudio !== false) encodeArgs.push('-c:a', 'libopus')
    } else {
      encodeArgs.push('-c:v', 'libx264', '-crf', crf, '-pix_fmt', 'yuv420p')
      if (opts.keepAudio !== false) encodeArgs.push('-c:a', 'aac', '-b:a', '160k')
    }
    encodeArgs.push(outputPath)
    await runBin('ffmpeg', encodeArgs)

    const buffer = await readFile(outputPath)
    return {
      buffer,
      width,
      height,
      format,
      options: toMerge(opts),
      pixelSize: Math.max(1, Math.round(opts.pixelSize ?? 1)),
      frames: frames.length,
      fps,
      ms: Date.now() - started,
    }
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

export async function ditherBatch(
  inputGlobOrDir: string,
  outputDir: string,
  opts: ProcessFileOptions = {},
): Promise<(ProcessResult | VideoProcessResult)[]> {
  const st = await stat(inputGlobOrDir).catch(() => null)
  let files: string[] = []
  if (st?.isDirectory()) {
    const entries = await readdir(inputGlobOrDir)
    files = entries
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()) || VIDEO_EXT.has(path.extname(f).toLowerCase()))
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
  const results: (ProcessResult | VideoProcessResult)[] = []
  for (const file of files) {
    const base = path.basename(file, path.extname(file))
    const ext = isVideoPath(file)
      ? '.mp4'
      : opts.format === 'jpeg' ? '.jpg' : opts.format === 'webp' ? '.webp' : '.png'
    const out = path.join(outputDir, `${base}-dither${ext}`)
    results.push(await ditherFile(file, out, opts))
  }
  return results
}
