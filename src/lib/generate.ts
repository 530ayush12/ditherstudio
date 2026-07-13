/**
 * Procedural UI / chart generators for dithering.
 * All drawing is canvas-based so frames can be fed into the dither pipeline.
 */

export type GeneratorId =
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'button'
  | 'slider'
  | 'toggle'
  | 'progress'
  | 'knob'
  | 'meter'
  | 'card'
  | 'dashboard'
  | 'waveform'
  | 'histogram'
  | 'switch-row'

export interface GeneratorMeta {
  id: GeneratorId
  name: string
  blurb: string
  animated: boolean
}

export const GENERATORS: GeneratorMeta[] = [
  { id: 'bar-chart', name: 'Bar chart', blurb: 'Animated column values.', animated: true },
  { id: 'line-chart', name: 'Line chart', blurb: 'Moving series + grid.', animated: true },
  { id: 'pie-chart', name: 'Pie chart', blurb: 'Rotating segments.', animated: true },
  { id: 'button', name: 'Button', blurb: 'Primary / press states.', animated: true },
  { id: 'slider', name: 'Slider', blurb: 'Interactive range control.', animated: true },
  { id: 'toggle', name: 'Toggle', blurb: 'On/off switch.', animated: true },
  { id: 'progress', name: 'Progress', blurb: 'Loading bar.', animated: true },
  { id: 'knob', name: 'Knob', blurb: 'Rotary dial.', animated: true },
  { id: 'meter', name: 'Meter', blurb: 'VU / level meter.', animated: true },
  { id: 'card', name: 'Card', blurb: 'UI card with sparkline.', animated: true },
  { id: 'dashboard', name: 'Dashboard', blurb: 'Mini multi-widget board.', animated: true },
  { id: 'waveform', name: 'Waveform', blurb: 'Oscilloscope line.', animated: true },
  { id: 'histogram', name: 'Histogram', blurb: 'Distribution bars.', animated: true },
  { id: 'switch-row', name: 'Switch row', blurb: 'Settings list with toggles.', animated: true },
]

export interface GenerateOptions {
  width: number
  height: number
  /** Animation phase 0–1 (loops). */
  t: number
  seed: number
  /** 0–1 component value (slider position, progress, etc.). */
  value: number
  label: string
  ink: string
  paper: string
  accent: string
  muted: string
}

export const DEFAULT_GENERATE: GenerateOptions = {
  width: 640,
  height: 400,
  t: 0,
  seed: 42,
  value: 0.62,
  label: 'Dither',
  ink: '#111111',
  paper: '#f4f4f1',
  accent: '#111111',
  muted: '#9a9a94',
}

function mulberry(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function fillBg(ctx: CanvasRenderingContext2D, o: GenerateOptions) {
  ctx.fillStyle = o.paper
  ctx.fillRect(0, 0, o.width, o.height)
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: GenerateOptions, size = 14) {
  ctx.fillStyle = o.ink
  ctx.font = `600 ${size}px "IBM Plex Mono", ui-monospace, monospace`
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

export function renderGenerator(
  type: GeneratorId,
  opts: Partial<GenerateOptions> = {},
): HTMLCanvasElement {
  const o = { ...DEFAULT_GENERATE, ...opts }
  const canvas = document.createElement('canvas')
  canvas.width = o.width
  canvas.height = o.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  fillBg(ctx, o)

  const rng = mulberry(o.seed)
  const phase = o.t * Math.PI * 2
  const val = Math.max(0, Math.min(1, o.value))

  switch (type) {
    case 'bar-chart': {
      const n = 8
      const pad = 48
      const chartW = o.width - pad * 2
      const chartH = o.height - pad * 2
      const bw = chartW / n - 10
      // axes
      ctx.strokeStyle = o.muted
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(pad, pad)
      ctx.lineTo(pad, pad + chartH)
      ctx.lineTo(pad + chartW, pad + chartH)
      ctx.stroke()
      for (let i = 0; i < n; i++) {
        const base = 0.25 + rng() * 0.55
        const wave = 0.2 * Math.sin(phase + i * 0.7)
        const h = Math.max(0.08, Math.min(0.95, base + wave)) * chartH
        const x = pad + i * (bw + 10) + 5
        const y = pad + chartH - h
        ctx.fillStyle = i % 2 === 0 ? o.ink : o.accent
        ctx.fillRect(x, y, bw, h)
      }
      drawLabel(ctx, o.label.toUpperCase(), pad, 22, o, 12)
      break
    }
    case 'line-chart': {
      const pad = 48
      const pts = 24
      ctx.strokeStyle = o.muted
      ctx.lineWidth = 1
      for (let g = 0; g < 5; g++) {
        const y = pad + ((o.height - pad * 2) * g) / 4
        ctx.beginPath()
        ctx.moveTo(pad, y)
        ctx.lineTo(o.width - pad, y)
        ctx.stroke()
      }
      ctx.strokeStyle = o.ink
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let i = 0; i < pts; i++) {
        const x = pad + ((o.width - pad * 2) * i) / (pts - 1)
        const y =
          pad +
          (o.height - pad * 2) *
            (0.5 +
              0.28 * Math.sin(phase * 1.2 + i * 0.45) +
              0.12 * Math.sin(phase * 2.1 + i * 0.9))
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      // dot
      const di = Math.floor(((o.t * pts) % pts + pts) % pts)
      const dx = pad + ((o.width - pad * 2) * di) / (pts - 1)
      const dy =
        pad +
        (o.height - pad * 2) *
          (0.5 + 0.28 * Math.sin(phase * 1.2 + di * 0.45) + 0.12 * Math.sin(phase * 2.1 + di * 0.9))
      ctx.fillStyle = o.ink
      ctx.beginPath()
      ctx.arc(dx, dy, 6, 0, Math.PI * 2)
      ctx.fill()
      drawLabel(ctx, o.label.toUpperCase(), pad, 22, o, 12)
      break
    }
    case 'pie-chart': {
      const cx = o.width / 2
      const cy = o.height / 2 + 8
      const R = Math.min(o.width, o.height) * 0.32
      const segs = [0.28, 0.22, 0.18, 0.17, 0.15]
      let a0 = phase * 0.25
      segs.forEach((s, i) => {
        const a1 = a0 + s * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, R, a0, a1)
        ctx.closePath()
        const shade = i % 2 === 0 ? o.ink : o.muted
        ctx.fillStyle = shade
        ctx.fill()
        a0 = a1
      })
      ctx.fillStyle = o.paper
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.45, 0, Math.PI * 2)
      ctx.fill()
      drawLabel(ctx, o.label.toUpperCase(), 32, 28, o, 12)
      break
    }
    case 'button': {
      const press = 0.5 + 0.5 * Math.sin(phase)
      const w = Math.min(280, o.width * 0.5)
      const h = 56
      const x = (o.width - w) / 2
      const y = (o.height - h) / 2 + press * 4
      ctx.fillStyle = o.ink
      roundRect(ctx, x, y, w, h, 8)
      ctx.fill()
      ctx.fillStyle = o.paper
      ctx.font = `700 18px "DM Sans", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(o.label || 'Continue', o.width / 2, y + h / 2)
      ctx.textAlign = 'start'
      // ghost secondary
      ctx.strokeStyle = o.ink
      ctx.lineWidth = 2
      roundRect(ctx, x, y + h + 20, w, h - 8, 8)
      ctx.stroke()
      ctx.fillStyle = o.ink
      ctx.font = `600 15px "DM Sans", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Secondary', o.width / 2, y + h + 20 + (h - 8) / 2)
      ctx.textAlign = 'start'
      break
    }
    case 'slider': {
      const trackW = o.width * 0.62
      const trackH = 8
      const x = (o.width - trackW) / 2
      const y = o.height / 2
      const animVal = (val + 0.5 * Math.sin(phase) * 0.25 + 1) % 1
      const thumbX = x + animVal * trackW
      ctx.fillStyle = o.muted
      roundRect(ctx, x, y - trackH / 2, trackW, trackH, 4)
      ctx.fill()
      ctx.fillStyle = o.ink
      roundRect(ctx, x, y - trackH / 2, animVal * trackW, trackH, 4)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(thumbX, y, 14, 0, Math.PI * 2)
      ctx.fill()
      drawLabel(ctx, `${o.label}  ${Math.round(animVal * 100)}%`, x, y - 36, o, 13)
      break
    }
    case 'toggle': {
      const on = Math.sin(phase) > 0
      const w = 88
      const h = 48
      const x = (o.width - w) / 2
      const y = (o.height - h) / 2
      ctx.fillStyle = on ? o.ink : o.muted
      roundRect(ctx, x, y, w, h, h / 2)
      ctx.fill()
      const knobX = on ? x + w - h / 2 - 4 : x + h / 2 + 4
      ctx.fillStyle = o.paper
      ctx.beginPath()
      ctx.arc(knobX, y + h / 2, h / 2 - 6, 0, Math.PI * 2)
      ctx.fill()
      drawLabel(ctx, on ? 'ENABLED' : 'DISABLED', (o.width - 90) / 2, y - 28, o, 12)
      break
    }
    case 'progress': {
      const w = o.width * 0.7
      const h = 18
      const x = (o.width - w) / 2
      const y = o.height / 2
      const p = (val * 0.4 + (0.5 + 0.5 * Math.sin(phase)) * 0.6) % 1
      ctx.strokeStyle = o.ink
      ctx.lineWidth = 2
      roundRect(ctx, x, y, w, h, 6)
      ctx.stroke()
      ctx.fillStyle = o.ink
      roundRect(ctx, x + 3, y + 3, Math.max(4, (w - 6) * p), h - 6, 4)
      ctx.fill()
      drawLabel(ctx, `${o.label}  ${Math.round(p * 100)}%`, x, y - 28, o, 13)
      break
    }
    case 'knob': {
      const cx = o.width / 2
      const cy = o.height / 2 + 10
      const R = 70
      const angle = -Math.PI * 0.75 + val * Math.PI * 1.5 + Math.sin(phase) * 0.15
      ctx.strokeStyle = o.muted
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.arc(cx, cy, R, -Math.PI * 0.75, Math.PI * 0.75)
      ctx.stroke()
      ctx.strokeStyle = o.ink
      ctx.beginPath()
      ctx.arc(cx, cy, R, -Math.PI * 0.75, angle)
      ctx.stroke()
      ctx.fillStyle = o.ink
      ctx.beginPath()
      ctx.arc(cx, cy, 36, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = o.paper
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * 28, cy + Math.sin(angle) * 28)
      ctx.stroke()
      drawLabel(ctx, o.label.toUpperCase(), cx - 30, cy - R - 24, o, 12)
      break
    }
    case 'meter': {
      const n = 16
      const level = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(phase * 1.7))
      const gap = 6
      const barW = (o.width * 0.7 - gap * (n - 1)) / n
      const x0 = o.width * 0.15
      const y0 = o.height / 2 + 20
      for (let i = 0; i < n; i++) {
        const on = i / n < level
        const h = 20 + i * 6
        ctx.fillStyle = on ? o.ink : o.muted
        ctx.globalAlpha = on ? 1 : 0.35
        ctx.fillRect(x0 + i * (barW + gap), y0 - h, barW, h)
      }
      ctx.globalAlpha = 1
      drawLabel(ctx, `${o.label} LEVEL`, x0, y0 - 140, o, 12)
      break
    }
    case 'card': {
      const w = Math.min(360, o.width * 0.7)
      const h = 200
      const x = (o.width - w) / 2
      const y = (o.height - h) / 2
      ctx.fillStyle = o.paper
      ctx.strokeStyle = o.ink
      ctx.lineWidth = 2
      roundRect(ctx, x, y, w, h, 12)
      ctx.fill()
      ctx.stroke()
      drawLabel(ctx, o.label.toUpperCase(), x + 20, y + 28, o, 12)
      ctx.fillStyle = o.ink
      ctx.font = `700 36px "DM Sans", system-ui, sans-serif`
      ctx.fillText(`${Math.round(40 + 20 * Math.sin(phase))}%`, x + 20, y + 78)
      // sparkline
      ctx.strokeStyle = o.ink
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < 20; i++) {
        const sx = x + 20 + i * ((w - 40) / 19)
        const sy = y + 140 + Math.sin(phase + i * 0.5) * 18
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
      break
    }
    case 'dashboard': {
      // three panels
      const pad = 24
      const gap = 16
      const colW = (o.width - pad * 2 - gap * 2) / 3
      for (let c = 0; c < 3; c++) {
        const x = pad + c * (colW + gap)
        const y = pad + 36
        const h = o.height - pad * 2 - 36
        ctx.strokeStyle = o.ink
        ctx.lineWidth = 2
        roundRect(ctx, x, y, colW, h, 10)
        ctx.stroke()
        drawLabel(ctx, ['CPU', 'NET', 'DISK'][c], x + 14, y + 22, o, 11)
        // mini bars
        for (let i = 0; i < 5; i++) {
          const bh = 20 + ((Math.sin(phase + c + i) + 1) / 2) * (h - 80)
          ctx.fillStyle = o.ink
          ctx.fillRect(x + 16 + i * ((colW - 32) / 5), y + h - 20 - bh, (colW - 40) / 5, bh)
        }
      }
      drawLabel(ctx, 'SYSTEM', pad, 22, o, 12)
      break
    }
    case 'waveform': {
      ctx.strokeStyle = o.ink
      ctx.lineWidth = 2.5
      ctx.beginPath()
      const mid = o.height / 2
      for (let x = 0; x < o.width; x++) {
        const nx = x / o.width
        const y =
          mid +
          Math.sin(nx * 18 + phase * 2) * 40 * val +
          Math.sin(nx * 41 + phase * 3.2) * 18 +
          Math.sin(nx * 7 - phase) * 12
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      // center line
      ctx.strokeStyle = o.muted
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, mid)
      ctx.lineTo(o.width, mid)
      ctx.stroke()
      drawLabel(ctx, o.label.toUpperCase(), 24, 28, o, 12)
      break
    }
    case 'histogram': {
      const n = 32
      const pad = 40
      const maxH = o.height - pad * 2
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1)
        const h =
          maxH *
          (0.15 +
            0.7 * Math.exp(-Math.pow((u - (0.5 + 0.1 * Math.sin(phase))) * 3.2, 2)) +
            0.08 * Math.sin(phase * 2 + i))
        const bw = (o.width - pad * 2) / n - 2
        ctx.fillStyle = o.ink
        ctx.fillRect(pad + i * (bw + 2), pad + maxH - h, bw, h)
      }
      drawLabel(ctx, 'HISTOGRAM', pad, 22, o, 12)
      break
    }
    case 'switch-row': {
      const rows = ['Dark mode', 'Serpentine', 'Edge aware', 'Color mode', 'Notifications']
      const rowH = 52
      const startY = (o.height - rows.length * rowH) / 2
      rows.forEach((label, i) => {
        const y = startY + i * rowH
        const on = Math.sin(phase + i * 1.1) > 0
        ctx.fillStyle = o.ink
        ctx.font = `500 15px "DM Sans", system-ui, sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(label, 48, y + rowH / 2)
        // switch
        const sw = 52
        const sh = 30
        const sx = o.width - 48 - sw
        const sy = y + (rowH - sh) / 2
        ctx.fillStyle = on ? o.ink : o.muted
        roundRect(ctx, sx, sy, sw, sh, sh / 2)
        ctx.fill()
        ctx.fillStyle = o.paper
        ctx.beginPath()
        ctx.arc(on ? sx + sw - sh / 2 - 3 : sx + sh / 2 + 3, sy + sh / 2, sh / 2 - 5, 0, Math.PI * 2)
        ctx.fill()
        // divider
        if (i < rows.length - 1) {
          ctx.strokeStyle = o.muted
          ctx.globalAlpha = 0.4
          ctx.beginPath()
          ctx.moveTo(48, y + rowH)
          ctx.lineTo(o.width - 48, y + rowH)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      })
      break
    }
    default:
      drawLabel(ctx, 'Unknown generator', 24, 24, o)
  }

  void lerp
  return canvas
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function generatorIds(): GeneratorId[] {
  return GENERATORS.map((g) => g.id)
}
