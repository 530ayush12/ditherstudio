# DitherStudio — Agent Guide

Local image dithering for coding agents. Web: https://ditherstudio.trylotus.dev

## Commands

```bash
npm install
npm run cli -- <in> -o <out> [flags]
npm run cli -- batch ./dir -o ./out -a bayer-8 --json
npm run serve   # http://127.0.0.1:8787
npm test
```

## Algorithms

threshold, random, floyd-steinberg, atkinson, jjn, stucki, burkes, sierra, bayer-2, bayer-4, bayer-8, halftone, blue-noise, riemersma, hybrid

## Important flags

| Flag | Meaning |
|------|---------|
| `-a` | algorithm |
| `-t` | threshold 0-255 |
| `-p` | pixel size |
| `--palette #111,#eee,#f00` | multi-color |
| `--seed n` | deterministic RNG |
| `--gamma` / `--contrast` | pre-pass |
| `--edge-aware` | detail bias |
| `--color` | RGB diffusion |
| `--export-scale 1-4` | nearest upscale |
| `--json` | machine output |

## HTTP

- `GET /health` `GET /v1/algorithms` `GET /openapi.json`
- `POST /v1/dither` multipart `file`
- `POST /v1/dither/base64` JSON `{ image, algorithm, palette, seed, ... }`

## Library

```ts
import { ditherFile, processBuffer, extractPalette } from './src/index.ts'
await ditherFile('in.png', 'out.png', { algorithm: 'blue-noise', seed: 7, palette: ['#000','#fff','#0f0'] })
```

## Studio URL presets

`https://ditherstudio.trylotus.dev/?a=atkinson&t=140&pal=111111,fafafa,00ff9c&seed=42`
