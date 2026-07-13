/**
 * Local HTTP API for coding agents and apps.
 * Start: `npx tsx src/server.ts` or `ditherstudio serve`
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { ALGORITHM_IDS, ALGORITHMS } from './lib/dither.ts'
import { ditherBase64, ditherBuffer, type ProcessFileOptions } from './lib/node.ts'

const VERSION = '1.0.0'

export interface ServeOptions {
  host?: string
  port?: number
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(data)
}

function sendBinary(res: ServerResponse, status: number, buf: Buffer, contentType: string, extra: Record<string, string> = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'Access-Control-Allow-Origin': '*',
    ...extra,
  })
  res.end(buf)
}

function parseQuery(url: URL): ProcessFileOptions {
  const q = url.searchParams
  const opts: ProcessFileOptions = {}
  if (q.has('algorithm')) opts.algorithm = q.get('algorithm')!
  if (q.has('threshold')) opts.threshold = Number(q.get('threshold'))
  if (q.has('pixelSize') || q.has('pixel_size'))
    opts.pixelSize = Number(q.get('pixelSize') ?? q.get('pixel_size'))
  if (q.has('cellSize') || q.has('cell_size'))
    opts.cellSize = Number(q.get('cellSize') ?? q.get('cell_size'))
  if (q.has('dark')) opts.dark = q.get('dark')!
  if (q.has('light')) opts.light = q.get('light')!
  if (q.has('invert')) opts.invert = q.get('invert') === '1' || q.get('invert') === 'true'
  if (q.has('serpentine'))
    opts.serpentine = !(q.get('serpentine') === '0' || q.get('serpentine') === 'false')
  if (q.has('maxDim') || q.has('max_dim'))
    opts.maxDim = Number(q.get('maxDim') ?? q.get('max_dim'))
  if (q.has('format')) opts.format = q.get('format') as ProcessFileOptions['format']
  if (q.has('quality')) opts.quality = Number(q.get('quality'))
  return opts
}

/** Minimal multipart file extractor for field name "file" or "image". */
function extractMultipartFile(body: Buffer, contentType: string): Buffer | null {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  if (!m) return null
  const boundary = m[1] || m[2]
  const parts = body.toString('binary').split(`--${boundary}`)
  for (const part of parts) {
    if (!/name="(?:file|image)"/i.test(part)) continue
    const idx = part.indexOf('\r\n\r\n')
    if (idx === -1) continue
    let data = part.slice(idx + 4)
    if (data.endsWith('\r\n')) data = data.slice(0, -2)
    if (data.endsWith('--')) data = data.slice(0, -2)
    if (data.endsWith('\r\n')) data = data.slice(0, -2)
    return Buffer.from(data, 'binary')
  }
  return null
}

function openApiSpec(baseUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'DitherStudio API',
      version: VERSION,
      description:
        'Local image dithering API for coding agents and apps. All processing is on-device.',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v1/algorithms': {
        get: {
          summary: 'List dither algorithms',
          responses: { '200': { description: 'Algorithm list' } },
        },
      },
      '/v1/dither': {
        post: {
          summary: 'Dither an uploaded image',
          parameters: [
            { name: 'algorithm', in: 'query', schema: { type: 'string', enum: ALGORITHM_IDS } },
            { name: 'threshold', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 255 } },
            { name: 'pixelSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 32 } },
            { name: 'dark', in: 'query', schema: { type: 'string' } },
            { name: 'light', in: 'query', schema: { type: 'string' } },
            { name: 'invert', in: 'query', schema: { type: 'boolean' } },
            { name: 'format', in: 'query', schema: { type: 'string', enum: ['png', 'jpeg', 'webp'] } },
          ],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: { file: { type: 'string', format: 'binary' } },
                  required: ['file'],
                },
              },
              'application/octet-stream': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Dithered image bytes',
              headers: {
                'X-Dither-Width': { schema: { type: 'integer' } },
                'X-Dither-Height': { schema: { type: 'integer' } },
                'X-Dither-Algorithm': { schema: { type: 'string' } },
              },
            },
          },
        },
      },
      '/v1/dither/base64': {
        post: {
          summary: 'Dither a base64-encoded image (JSON in/out)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['image'],
                  properties: {
                    image: { type: 'string', description: 'Base64 or data-URL image' },
                    algorithm: { type: 'string', enum: ALGORITHM_IDS },
                    threshold: { type: 'integer' },
                    pixelSize: { type: 'integer' },
                    cellSize: { type: 'integer' },
                    dark: { type: 'string' },
                    light: { type: 'string' },
                    invert: { type: 'boolean' },
                    serpentine: { type: 'boolean' },
                    format: { type: 'string', enum: ['png', 'jpeg', 'webp'] },
                    quality: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'JSON with base64 result' } },
        },
      },
    },
  }
}

export async function createServer(opts: ServeOptions = {}) {
  const host = opts.host ?? '127.0.0.1'
  const port = opts.port ?? 8787

  const server = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${host}:${port}`)

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        res.end()
        return
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true, service: 'ditherstudio', version: VERSION })
        return
      }

      if (req.method === 'GET' && (url.pathname === '/v1/algorithms' || url.pathname === '/algorithms')) {
        sendJson(res, 200, { algorithms: ALGORITHMS })
        return
      }

      if (req.method === 'GET' && url.pathname === '/openapi.json') {
        sendJson(res, 200, openApiSpec(`http://${host}:${port}`))
        return
      }

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/v1')) {
        sendJson(res, 200, {
          name: 'DitherStudio',
          version: VERSION,
          docs: {
            openapi: '/openapi.json',
            algorithms: '/v1/algorithms',
            dither: 'POST /v1/dither',
            ditherBase64: 'POST /v1/dither/base64',
          },
          cli: 'ditherstudio <input> -o <output> [options]',
        })
        return
      }

      if (req.method === 'POST' && url.pathname === '/v1/dither/base64') {
        const raw = await readBody(req)
        const json = JSON.parse(raw.toString('utf8') || '{}') as Record<string, unknown>
        if (!json.image || typeof json.image !== 'string') {
          sendJson(res, 400, { ok: false, error: 'Missing "image" base64 string' })
          return
        }
        const optsProc: ProcessFileOptions = {
          algorithm: (json.algorithm as string) ?? undefined,
          threshold: json.threshold !== undefined ? Number(json.threshold) : undefined,
          pixelSize: json.pixelSize !== undefined ? Number(json.pixelSize) : undefined,
          cellSize: json.cellSize !== undefined ? Number(json.cellSize) : undefined,
          dark: json.dark as string | undefined,
          light: json.light as string | undefined,
          invert: json.invert !== undefined ? Boolean(json.invert) : undefined,
          serpentine: json.serpentine !== undefined ? Boolean(json.serpentine) : undefined,
          format: (json.format as ProcessFileOptions['format']) ?? 'png',
          quality: json.quality !== undefined ? Number(json.quality) : undefined,
          maxDim: json.maxDim !== undefined ? Number(json.maxDim) : undefined,
        }
        const result = await ditherBase64(json.image, optsProc)
        sendJson(res, 200, {
          ok: true,
          width: result.width,
          height: result.height,
          format: result.format,
          algorithm: result.options.algorithm,
          threshold: result.options.threshold,
          pixelSize: result.pixelSize,
          image: result.base64,
          mime:
            result.format === 'jpeg'
              ? 'image/jpeg'
              : result.format === 'webp'
                ? 'image/webp'
                : 'image/png',
        })
        return
      }

      if (req.method === 'POST' && url.pathname === '/v1/dither') {
        const body = await readBody(req)
        const ct = String(req.headers['content-type'] || '')
        let input: Buffer | null = null
        if (ct.includes('multipart/form-data')) {
          input = extractMultipartFile(body, ct)
        } else {
          input = body.length ? body : null
        }
        if (!input || input.length === 0) {
          sendJson(res, 400, {
            ok: false,
            error: 'Send image as multipart field "file" or raw body (application/octet-stream)',
          })
          return
        }

        const queryOpts = parseQuery(url)
        // Also merge JSON fields if content was multipart with extra - skip for simplicity
        const result = await ditherBuffer(input, queryOpts)
        const mime =
          result.format === 'jpeg'
            ? 'image/jpeg'
            : result.format === 'webp'
              ? 'image/webp'
              : 'image/png'
        sendBinary(res, 200, result.buffer, mime, {
          'X-Dither-Width': String(result.width),
          'X-Dither-Height': String(result.height),
          'X-Dither-Algorithm': result.options.algorithm,
          'X-Dither-Threshold': String(result.options.threshold),
        })
        return
      }

      sendJson(res, 404, { ok: false, error: 'Not found', see: '/openapi.json' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { ok: false, error: message })
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve())
  })

  const base = `http://${host}:${port}`
  console.log(`DitherStudio API ${VERSION}`)
  console.log(`  ${base}`)
  console.log(`  OpenAPI  ${base}/openapi.json`)
  console.log(`  Health   ${base}/health`)
  console.log(`  Dither   POST ${base}/v1/dither`)
  console.log(`  Base64   POST ${base}/v1/dither/base64`)

  return server
}

// Allow direct execution
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))

if (isMain) {
  const port = Number(process.env.PORT || 8787)
  const host = process.env.HOST || '127.0.0.1'
  createServer({ host, port }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
