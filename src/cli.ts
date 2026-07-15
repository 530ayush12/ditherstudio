#!/usr/bin/env node
/**
 * DitherStudio CLI
 */
import { createServer } from './server.ts'
import { ALGORITHM_IDS, ALGORITHMS, isAlgorithmId } from './lib/dither.ts'
import { ditherBatch, ditherFile } from './lib/node.ts'

const VERSION = '1.1.0'

function printHelp() {
  console.log(`DitherStudio ${VERSION}

Usage:
  ditherstudio <input> -o <output> [options]
  ditherstudio batch <dir|glob> -o <outdir> [options]
  ditherstudio serve [--port 8787] [--host 127.0.0.1]
  ditherstudio algorithms [--json]
  ditherstudio version

Options:
  -o, --output <path>       Output file or directory (batch)
  -a, --algorithm <id>      Algorithm (default: floyd-steinberg)
  -t, --threshold <0-255>   Threshold (default: 128)
  -p, --pixel-size <n>      Chunky pixel factor (default: 1)
  -c, --cell-size <n>       Halftone cell (default: 6)
  --dark <hex>              Ink (default: #111111)
  --light <hex>             Paper (default: #fafafa)
  --palette <hex,hex,...>   Multi-color palette
  --seed <n>                PRNG seed (default: 42)
  --gamma <n>               Gamma pre-pass (default: 1)
  --contrast <n>            Contrast pre-pass (default: 1)
  --edge-aware              Edge-aware threshold
  --color                   RGB error diffusion
  --export-scale <n>        Nearest upscale after dither (1-4)
  --video-fps <n>           Optional output FPS for video inputs
  --video-crf <n>           Video quality CRF (default: 24)
  --no-audio                Drop audio when processing video
  --invert                  Invert palette order
  --no-serpentine           Disable serpentine scan
  --max-dim <n>             Max edge (default: 4096)
  --format <png|jpeg|webp>  Output format
  --quality <1-100>         JPEG/WebP quality
  --json                    Machine-readable output
  -h, --help                Help
  -v, --version             Version

Algorithms:
  ${ALGORITHM_IDS.join(', ')}

Examples:
  ditherstudio photo.jpg -o out.png -a atkinson -t 140 --seed 7
  ditherstudio clip.mp4 -o out.mp4 -a bayer-8 --video-fps 12
  ditherstudio icon.png -o icon.png -a bayer-8 -p 4 --palette 000000,ffffff,55ffff
  ditherstudio batch ./shots -o ./dithered -a blue-noise --json
  ditherstudio serve --port 8787
`)
}

type Flags = Record<string, string | boolean>

function parseArgs(argv: string[]): { cmd: string; positionals: string[]; flags: Flags } {
  const flags: Flags = {}
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') flags.help = true
    else if (a === '-v' || a === '--version') flags.version = true
    else if (a === '--json') flags.json = true
    else if (a === '--invert') flags.invert = true
    else if (a === '--no-serpentine') flags['no-serpentine'] = true
    else if (a === '--edge-aware') flags['edge-aware'] = true
    else if (a === '--color') flags.color = true
    else if (a.startsWith('--') && a.includes('=')) {
      const [k, ...rest] = a.slice(2).split('=')
      flags[k] = rest.join('=')
    } else if (a.startsWith('-') && a.length === 2 && i + 1 < argv.length) {
      const map: Record<string, string> = {
        o: 'output',
        a: 'algorithm',
        t: 'threshold',
        p: 'pixel-size',
        c: 'cell-size',
      }
      flags[map[a[1]] ?? a[1]] = argv[++i]
    } else if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('-')) {
        flags[key] = next
        i++
      } else flags[key] = true
    } else positionals.push(a)
  }
  const cmd =
    positionals[0] === 'serve' ||
    positionals[0] === 'algorithms' ||
    positionals[0] === 'version' ||
    positionals[0] === 'batch'
      ? positionals[0]
      : 'dither'
  return { cmd, positionals, flags }
}

function optsFromFlags(flags: Flags) {
  const algorithm = String(flags.algorithm ?? 'floyd-steinberg')
  if (!isAlgorithmId(algorithm)) {
    throw new Error(`Unknown algorithm: ${algorithm}. Valid: ${ALGORITHM_IDS.join(', ')}`)
  }
  const palette = flags.palette
    ? String(flags.palette)
        .split(',')
        .map((s) => {
          const h = s.trim().replace(/^#/, '')
          return `#${h}`
        })
    : undefined
  return {
    algorithm,
    threshold: flags.threshold !== undefined ? Number(flags.threshold) : 128,
    pixelSize: flags['pixel-size'] !== undefined ? Number(flags['pixel-size']) : 1,
    cellSize: flags['cell-size'] !== undefined ? Number(flags['cell-size']) : 6,
    dark: flags.dark ? String(flags.dark) : undefined,
    light: flags.light ? String(flags.light) : undefined,
    invert: Boolean(flags.invert),
    serpentine: !flags['no-serpentine'],
    maxDim: flags['max-dim'] !== undefined ? Number(flags['max-dim']) : 4096,
    format: flags.format as 'png' | 'jpeg' | 'webp' | undefined,
    quality: flags.quality !== undefined ? Number(flags.quality) : 90,
    seed: flags.seed !== undefined ? Number(flags.seed) : 42,
    gamma: flags.gamma !== undefined ? Number(flags.gamma) : 1,
    contrast: flags.contrast !== undefined ? Number(flags.contrast) : 1,
    edgeAware: Boolean(flags['edge-aware']),
    colorMode: Boolean(flags.color) || (palette !== undefined && palette.length > 2),
    palette,
    exportScale: flags['export-scale'] !== undefined ? Number(flags['export-scale']) : 1,
    videoFps: flags['video-fps'] !== undefined ? Number(flags['video-fps']) : undefined,
    videoCrf: flags['video-crf'] !== undefined ? Number(flags['video-crf']) : undefined,
    keepAudio: !flags['no-audio'],
  }
}

async function main() {
  const { cmd, positionals, flags } = parseArgs(process.argv.slice(2))
  if (flags.help) {
    printHelp()
    process.exit(0)
  }
  if (flags.version || cmd === 'version') {
    console.log(VERSION)
    process.exit(0)
  }

  if (cmd === 'algorithms') {
    if (flags.json) console.log(JSON.stringify(ALGORITHMS, null, 2))
    else for (const a of ALGORITHMS) console.log(`${a.id.padEnd(18)} ${a.family.padEnd(8)} ${a.blurb}`)
    process.exit(0)
  }

  if (cmd === 'serve') {
    await createServer({
      port: Number(flags.port ?? 8787),
      host: String(flags.host ?? '127.0.0.1'),
    })
    return
  }

  try {
    const opts = optsFromFlags(flags)

    if (cmd === 'batch') {
      const input = positionals[1] || positionals[0]
      const output = String(flags.output || '')
      if (!input || !output) {
        console.error('batch requires input dir/glob and -o outdir')
        process.exit(1)
      }
      const results = await ditherBatch(input, output, opts)
      if (flags.json) {
        console.log(
          JSON.stringify({
            ok: true,
            count: results.length,
            output,
            results: results.map((r) => ({
              width: r.width,
              height: r.height,
              algorithm: r.options.algorithm,
              ms: r.ms,
              bytes: r.buffer.length,
            })),
          }),
        )
      } else {
        console.log(`Batch: ${results.length} files → ${output}`)
      }
      process.exit(0)
    }

    const input = positionals[0]
    const output = String(flags.output || '')
    if (!input || !output) {
      console.error('input and -o/--output required\n')
      printHelp()
      process.exit(1)
    }

    const result = await ditherFile(input, output, opts)
    const payload = {
      ok: true,
      input,
      output,
      width: result.width,
      height: result.height,
      format: result.format,
      algorithm: result.options.algorithm,
      threshold: result.options.threshold,
      seed: result.options.seed,
      pixelSize: result.pixelSize,
      frames: 'frames' in result ? result.frames : undefined,
      fps: 'fps' in result ? result.fps : undefined,
      bytes: result.buffer.length,
      ms: result.ms,
    }
    if (flags.json) console.log(JSON.stringify(payload))
    else
      console.log(
        `Wrote ${output} (${result.width}x${result.height}, ${result.options.algorithm}${'frames' in result ? `, ${result.frames} frames` : ''}, ${result.ms}ms)`,
      )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (flags.json) console.log(JSON.stringify({ ok: false, error: message }))
    else console.error(`Error: ${message}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
