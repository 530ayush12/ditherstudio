# DitherStudio — Agent Guide

Dither any image with classic algorithms. Use the **web studio**, **CLI**, **HTTP API**, or **Node library**. Processing is local (no cloud upload).

## Quick start

```bash
# Install deps (from repo root)
npm install

# Web studio
npm run dev

# CLI dither
npm run cli -- photo.jpg -o out.png -a floyd-steinberg -t 128

# Local HTTP API for agents
npm run serve
# → http://127.0.0.1:8787
```

## CLI

```text
ditherstudio <input> -o <output> [options]
ditherstudio serve [--port 8787] [--host 127.0.0.1]
ditherstudio algorithms [--json]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output` | Output path | required |
| `-a, --algorithm` | Algorithm id | `floyd-steinberg` |
| `-t, --threshold` | 0–255 | `128` |
| `-p, --pixel-size` | Chunky factor 1–32 | `1` |
| `-c, --cell-size` | Halftone cell | `6` |
| `--dark` | Ink hex | `#111111` |
| `--light` | Paper hex | `#fafafa` |
| `--invert` | Invert mapping | off |
| `--no-serpentine` | Disable serpentine | serpentine on |
| `--max-dim` | Max edge | `4096` |
| `--format` | `png` \| `jpeg` \| `webp` | from extension |
| `--quality` | JPEG/WebP quality | `90` |
| `--json` | Machine-readable result | off |

**Algorithms:** `threshold`, `random`, `floyd-steinberg`, `atkinson`, `jjn`, `stucki`, `burkes`, `sierra`, `bayer-2`, `bayer-4`, `bayer-8`, `halftone`

### CLI examples for agents

```bash
# Deterministic export
npm run cli -- ./in.png -o ./out.png -a atkinson -t 140 --json

# Chunky pixel look
npm run cli -- ./photo.jpg -o ./pixel.png -a bayer-8 -p 4

# List algorithms as JSON
npm run cli -- algorithms --json
```

## HTTP API (coding agents / apps)

Start server:

```bash
npm run serve
# or: npx tsx src/server.ts
# or: HOST=0.0.0.0 PORT=8787 npm run serve
```

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness |
| `GET` | `/v1/algorithms` | Algorithm catalog |
| `GET` | `/openapi.json` | OpenAPI 3.1 spec |
| `POST` | `/v1/dither` | Multipart `file` or raw body → image bytes |
| `POST` | `/v1/dither/base64` | JSON in/out with base64 image |

### Multipart dither

```bash
curl -sS -X POST \
  "http://127.0.0.1:8787/v1/dither?algorithm=floyd-steinberg&threshold=128&pixelSize=1" \
  -F "file=@photo.jpg" \
  -o out.png
```

Response headers: `X-Dither-Width`, `X-Dither-Height`, `X-Dither-Algorithm`, `X-Dither-Threshold`.

### Base64 JSON (easy for LLM tool calls)

```bash
curl -sS -X POST http://127.0.0.1:8787/v1/dither/base64 \
  -H 'Content-Type: application/json' \
  -d '{
    "image": "<base64 or data-url>",
    "algorithm": "atkinson",
    "threshold": 140,
    "pixelSize": 2,
    "dark": "#111111",
    "light": "#fafafa",
    "format": "png"
  }'
```

Response:

```json
{
  "ok": true,
  "width": 800,
  "height": 600,
  "format": "png",
  "algorithm": "atkinson",
  "image": "<base64>",
  "mime": "image/png"
}
```

## Node library

```ts
import { ditherFile, ditherBuffer, ALGORITHMS, dither } from './src/index.ts'
// or after publish: from 'ditherstudio'

await ditherFile('in.png', 'out.png', {
  algorithm: 'stucki',
  threshold: 128,
  pixelSize: 1,
  dark: '#000000',
  light: '#ffffff',
})

// Pure buffer API (browser-safe core)
import { dither, createPixelBuffer } from './src/lib/dither.ts'
```

## Recommended agent workflow

1. Prefer **CLI** when files are on disk (`--json` for structured results).
2. Prefer **`POST /v1/dither/base64`** when the image is already in memory / tool context.
3. Call **`GET /v1/algorithms`** if you need to pick an algorithm dynamically.
4. Read **`/openapi.json`** for full schema discovery.
5. Do not assume a public internet URL — this is a local tool unless the user hosts it.

## Constraints

- Max edge defaults to 4096 (CLI/API) or 1600 (web preview for speed).
- Random algorithm is non-deterministic.
- No authentication on the local server — bind to `127.0.0.1` by default.
