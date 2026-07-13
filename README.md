# DitherStudio

**Dither any image in the browser.** Clean monochrome studio plus CLI and HTTP API for coding agents.

<p align="center">
  <a href="https://ditherstudio.ideatr.dev">Studio</a> ·
  <a href="https://ditherskill.ideatr.dev">DitherSkill</a> ·
  <a href="https://gitlab.com/arjunkshah/ditherstudio">GitLab</a> ·
  <a href="https://github.com/arjunkshah/ditherstudio">GitHub</a>
</p>

## Live

- **Studio:** https://ditherstudio.ideatr.dev  
- **Agent skill:** https://ditherskill.ideatr.dev  

```bash
npx skills add arjunkshah/ditherskill -g -y
```

## Web studio

```bash
npm install
npm run dev
```

Drop an image, pick an algorithm, export PNG. All client-side.

## CLI

```bash
npm run cli -- photo.jpg -o out.png -a floyd-steinberg -t 128 --json
npm run cli -- algorithms --json
```

## HTTP API (agents)

```bash
npm run serve
# http://127.0.0.1:8787
```

```bash
curl -sS -X POST \
  "http://127.0.0.1:8787/v1/dither?algorithm=atkinson&threshold=140" \
  -F "file=@photo.jpg" -o out.png
```

- `GET /health`
- `GET /v1/algorithms`
- `GET /openapi.json`
- `POST /v1/dither`
- `POST /v1/dither/base64`

## Library

```ts
import { ditherFile, ALGORITHMS } from 'ditherstudio'

await ditherFile('in.png', 'out.png', {
  algorithm: 'stucki',
  threshold: 128,
})
```

## Algorithms

Threshold · Random · Floyd-Steinberg · Atkinson · Jarvis-Judice-Ninke · Stucki · Burkes · Sierra · Bayer 2/4/8 · Halftone

## Docs for agents

- [AGENTS.md](./AGENTS.md)
- [llms.txt](./llms.txt)
- Companion skill: [arjunkshah/ditherskill](https://gitlab.com/arjunkshah/ditherskill)

## Stack

Vite · React · TypeScript · Tailwind · sharp (CLI/API)

## License

MIT
