# DitherStudio

**Dither any image in the browser.** Clean monochrome studio plus CLI and HTTP API for coding agents.

<p align="center">
  <a href="https://ditherstudio.trylotus.dev">Studio</a> ·
  <a href="https://github.com/530ayush12/ditherstudio">GitHub</a>
</p>

## Live

- **Studio:** https://ditherstudio.trylotus.dev
- **Example pack:** `/examples` in the studio (portrait, landscape, UI, logo, gradient)

### Regenerate example gallery

```bash
npm run examples
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
npm run cli -- clip.mp4 -o clip-dither.mp4 -a bayer-8 --video-fps 12 --video-crf 24
npm run cli -- algorithms --json
```

Video input uses local `ffmpeg`/`ffprobe` for frame extraction and encoding. Add `--no-audio` to drop the source audio track.

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

Threshold · Random · Floyd-Steinberg · Atkinson · Jarvis-Judice-Ninke · Stucki · Burkes · Sierra · Bayer 2/4/8 · Halftone · Blue-noise · Riemersma · Hybrid

## Docs for agents

- [AGENTS.md](./AGENTS.md)
- [llms.txt](./llms.txt)

## Stack

Vite · React · TypeScript · Tailwind · sharp (CLI/API)

## License

MIT
