#!/usr/bin/env node
/**
 * DitherStudio CLI
 *
 *   ditherstudio <input> -o <output> [options]
 *   ditherstudio serve [--port 8787]
 *   ditherstudio algorithms [--json]
 *   ditherstudio --help
 */
import { createServer } from './server.ts'
import { ALGORITHM_IDS, ALGORITHMS, isAlgorithmId } from './lib/dither.ts'
import { ditherFile } from './lib/node.ts'

const VERSION = '1.0.0'

function printHelp() {
  console.log(`DitherStudio ${VERSION}

Usage:
  ditherstudio <input> -o <output> [options]
  ditherstudio serve [--port <n>] [--host <addr>]
  ditherstudio algorithms [--json]
  ditherstudio version

Options:
  -o, --output <path>       Output image path (required for dither)
  -a, --algorithm <id>      Algorithm id (default: floyd-steinberg)
  -t, --threshold <0-255>   Threshold (default: 128)
  -p, --pixel-size <n>      Chunky pixel factor 1-32 (default: 1)
  -c, --cell-size <n>       Halftone cell size (default: 6)
  --dark <hex>              Ink color (default: #111111)
  --light <hex>             Paper color (default: #fafafa)
  --invert                  Invert ink/paper mapping
  --no-serpentine           Disable serpentine scan (error diffusion)
  --max-dim <n>             Max longest edge before dither (default: 4096)
  --format <png|jpeg|webp>  Output format (default: from extension)
  --quality <1-100>         JPEG/WebP quality (default: 90)
  --json                    Machine-readable result / list
  -h, --help                Show help
  -v, --version             Show version

Algorithms:
  ${ALGORITHM_IDS.join(', ')}

Examples:
  ditherstudio photo.jpg -o out.png -a atkinson -t 140
  ditherstudio icon.png -o icon-dither.png -p 4 --dark #000 --light #fff
  ditherstudio serve --port 8787

Agent HTTP API (after serve):
  GET  /health
  GET  /v1/algorithms
  GET  /openapi.json
  POST /v1/dither          multipart field "file" + query/body options
  POST /v1/dither/base64   JSON { "image": "<base64>", ...options }
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
      const key = map[a[1]] ?? a[1]
      flags[key] = argv[++i]
    } else if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('-')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positionals.push(a)
    }
  }
  const cmd = positionals[0] === 'serve' || positionals[0] === 'algorithms' || positionals[0] === 'version'
    ? positionals[0]
    : 'dither'
  return { cmd, positionals, flags }
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
    if (flags.json) {
      console.log(JSON.stringify(ALGORITHMS, null, 2))
    } else {
      for (const a of ALGORITHMS) {
        console.log(`${a.id.padEnd(18)} ${a.family.padEnd(8)} ${a.blurb}`)
      }
    }
    process.exit(0)
  }

  if (cmd === 'serve') {
    const port = Number(flags.port ?? 8787)
    const host = String(flags.host ?? '127.0.0.1')
    await createServer({ host, port })
    return
  }

  // dither command
  const input = positionals[0]
  const output = (flags.output as string) || (flags.o as string)
  if (!input || !output) {
    console.error('Error: input path and -o/--output are required.\n')
    printHelp()
    process.exit(1)
  }

  const algorithm = String(flags.algorithm ?? 'floyd-steinberg')
  if (!isAlgorithmId(algorithm)) {
    console.error(`Unknown algorithm: ${algorithm}`)
    console.error(`Valid: ${ALGORITHM_IDS.join(', ')}`)
    process.exit(1)
  }

  const started = Date.now()
  try {
    const result = await ditherFile(input, output, {
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
    })

    const payload = {
      ok: true,
      input,
      output,
      width: result.width,
      height: result.height,
      format: result.format,
      algorithm: result.options.algorithm,
      threshold: result.options.threshold,
      pixelSize: result.pixelSize,
      bytes: result.buffer.length,
      ms: Date.now() - started,
    }

    if (flags.json) {
      console.log(JSON.stringify(payload))
    } else {
      console.log(
        `Wrote ${output} (${result.width}x${result.height}, ${result.options.algorithm}, ${payload.ms}ms)`,
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (flags.json) {
      console.log(JSON.stringify({ ok: false, error: message }))
    } else {
      console.error(`Error: ${message}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
