import {
  type AlgorithmId,
  type DitherOptions,
  type Rgb,
  DEFAULT_DITHER_OPTIONS,
  hexToRgb,
  isAlgorithmId,
  rgbToHex,
} from './dither'
import type { GeneratorId } from './generate'

export interface StudioPreset {
  algorithm: AlgorithmId
  threshold: number
  invert: boolean
  serpentine: boolean
  darkHex: string
  lightHex: string
  pixelSize: number
  cellSize: number
  seed: number
  gamma: number
  contrast: number
  edgeAware: boolean
  colorMode: boolean
  paletteHex: string[]
  exportScale: number
  maxDim: number
  theme: 'light' | 'dark'
  sample?: string
  brightness: number
  saturation: number
  noise: number
  strength: number
  softness: number
  /** Generator mode */
  genType?: GeneratorId
  genValue: number
  genWidth: number
  genHeight: number
  genAnimate: boolean
  genSpeed: number
  genLabel: string
  genAccent: string
}

export const DEFAULT_PRESET: StudioPreset = {
  algorithm: 'floyd-steinberg',
  threshold: 128,
  invert: false,
  serpentine: true,
  darkHex: '#111111',
  lightHex: '#fafafa',
  pixelSize: 1,
  cellSize: 6,
  seed: 42,
  gamma: 1,
  contrast: 1,
  edgeAware: false,
  colorMode: false,
  paletteHex: ['#111111', '#fafafa'],
  exportScale: 1,
  maxDim: 2400,
  theme: 'light',
  sample: undefined,
  brightness: 0,
  saturation: 1,
  noise: 0,
  strength: 1,
  softness: 0,
  genType: undefined,
  genValue: 0.62,
  genWidth: 640,
  genHeight: 400,
  genAnimate: true,
  genSpeed: 0.35,
  genLabel: 'Dither',
  genAccent: '#111111',
}

export function presetToDitherOptions(p: StudioPreset): Partial<DitherOptions> {
  const palette: Rgb[] = p.paletteHex.map((h) => hexToRgb(h))
  return {
    algorithm: p.algorithm,
    threshold: p.threshold,
    invert: p.invert,
    serpentine: p.serpentine,
    darkColor: hexToRgb(p.darkHex),
    lightColor: hexToRgb(p.lightHex),
    cellSize: p.cellSize,
    seed: p.seed,
    gamma: p.gamma,
    contrast: p.contrast,
    edgeAware: p.edgeAware,
    colorMode: p.colorMode || palette.length > 2,
    palette: palette.length >= 2 ? palette : undefined,
    brightness: p.brightness,
    saturation: p.saturation,
    noise: p.noise,
    strength: p.strength,
    softness: p.softness,
  }
}

export function presetToQuery(p: StudioPreset): string {
  const q = new URLSearchParams()
  q.set('a', p.algorithm)
  q.set('t', String(p.threshold))
  if (p.invert) q.set('inv', '1')
  if (!p.serpentine) q.set('serp', '0')
  q.set('dark', p.darkHex.replace('#', ''))
  q.set('light', p.lightHex.replace('#', ''))
  if (p.pixelSize !== 1) q.set('p', String(p.pixelSize))
  if (p.cellSize !== 6) q.set('c', String(p.cellSize))
  if (p.seed !== 42) q.set('seed', String(p.seed))
  if (p.gamma !== 1) q.set('gamma', String(p.gamma))
  if (p.contrast !== 1) q.set('con', String(p.contrast))
  if (p.edgeAware) q.set('edge', '1')
  if (p.colorMode) q.set('color', '1')
  if (p.exportScale !== 1) q.set('scale', String(p.exportScale))
  if (p.maxDim !== 2400) q.set('max', String(p.maxDim))
  if (p.theme === 'dark') q.set('theme', 'dark')
  if (p.sample) q.set('sample', p.sample)
  if (p.brightness !== 0) q.set('br', String(p.brightness))
  if (p.saturation !== 1) q.set('sat', String(p.saturation))
  if (p.noise !== 0) q.set('noise', String(p.noise))
  if (p.strength !== 1) q.set('str', String(p.strength))
  if (p.softness !== 0) q.set('soft', String(p.softness))
  if (p.genType) {
    q.set('gen', p.genType)
    q.set('gv', String(p.genValue))
    if (!p.genAnimate) q.set('anim', '0')
    if (p.genSpeed !== 0.35) q.set('spd', String(p.genSpeed))
  }
  if (
    p.paletteHex.length > 2 ||
    p.paletteHex[0] !== p.darkHex ||
    p.paletteHex[1] !== p.lightHex
  ) {
    q.set(
      'pal',
      p.paletteHex.map((h) => h.replace('#', '')).join(','),
    )
  }
  return q.toString()
}

export function presetFromQuery(search: string): Partial<StudioPreset> {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const out: Partial<StudioPreset> = {}
  const a = q.get('a')
  if (a && isAlgorithmId(a)) out.algorithm = a
  if (q.has('t')) out.threshold = Number(q.get('t'))
  if (q.get('inv') === '1') out.invert = true
  if (q.get('serp') === '0') out.serpentine = false
  if (q.has('dark')) out.darkHex = '#' + q.get('dark')!.replace('#', '')
  if (q.has('light')) out.lightHex = '#' + q.get('light')!.replace('#', '')
  if (q.has('p')) out.pixelSize = Number(q.get('p'))
  if (q.has('c')) out.cellSize = Number(q.get('c'))
  if (q.has('seed')) out.seed = Number(q.get('seed'))
  if (q.has('gamma')) out.gamma = Number(q.get('gamma'))
  if (q.has('con')) out.contrast = Number(q.get('con'))
  if (q.get('edge') === '1') out.edgeAware = true
  if (q.get('color') === '1') out.colorMode = true
  if (q.has('scale')) out.exportScale = Number(q.get('scale'))
  if (q.has('max')) out.maxDim = Number(q.get('max'))
  if (q.get('theme') === 'dark') out.theme = 'dark'
  if (q.has('sample')) out.sample = q.get('sample') || undefined
  if (q.has('br')) out.brightness = Number(q.get('br'))
  if (q.has('sat')) out.saturation = Number(q.get('sat'))
  if (q.has('noise')) out.noise = Number(q.get('noise'))
  if (q.has('str')) out.strength = Number(q.get('str'))
  if (q.has('soft')) out.softness = Number(q.get('soft'))
  if (q.has('gen')) out.genType = q.get('gen') as StudioPreset['genType']
  if (q.has('gv')) out.genValue = Number(q.get('gv'))
  if (q.get('anim') === '0') out.genAnimate = false
  if (q.has('spd')) out.genSpeed = Number(q.get('spd'))
  if (q.has('pal')) {
    out.paletteHex = q
      .get('pal')!
      .split(',')
      .filter(Boolean)
      .map((h) => '#' + h.replace('#', ''))
  }
  return out
}

export function mergePreset(base: StudioPreset, patch: Partial<StudioPreset>): StudioPreset {
  return { ...base, ...patch }
}

export function presetToJson(p: StudioPreset): string {
  return JSON.stringify(p, null, 2)
}

export function presetFromJson(raw: string): StudioPreset {
  const j = JSON.parse(raw) as Partial<StudioPreset>
  return mergePreset(DEFAULT_PRESET, j)
}

export function optionsToHexPalette(opts: DitherOptions): string[] {
  if (opts.palette && opts.palette.length >= 2) {
    return opts.palette.map((c) => rgbToHex(c[0], c[1], c[2]))
  }
  return [rgbToHex(...opts.darkColor), rgbToHex(...opts.lightColor)]
}

export { DEFAULT_DITHER_OPTIONS }
