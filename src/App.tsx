import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  CaretDown,
  DownloadSimple,
  GridFour,
  Image as ImageIcon,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Moon,
  Sun,
  Trash,
  X,
} from '@phosphor-icons/react'
import { Collapsible } from './components/Collapsible'
import {
  ALGORITHMS,
  type AlgorithmId,
  PALETTE_PRESETS,
  extractPalette,
  rgbToHex,
} from './lib/dither'
import { imageElementToBuffer, imageDataToBlob, canvasToBuffer } from './lib/browser'
import {
  DEFAULT_PRESET,
  type StudioPreset,
  mergePreset,
  presetFromJson,
  presetFromQuery,
  presetToDitherOptions,
  presetToJson,
  presetToQuery,
} from './lib/presets'
import { useDitherWorker } from './hooks/useDitherWorker'
import { GeneratePanel } from './components/GeneratePanel'
import {DocsPage} from './components/DocsPage'
import {LandingPage} from './components/LandingPage'
import { renderGenerator, type GeneratorId } from './lib/generate'

type SourceState = {
  fileName: string
  objectUrl: string
  width: number
  height: number
  element: HTMLImageElement
}

const DOCS_HREF = 'https://gitlab.com/arjunkshah/ditherstudio/-/blob/main/README.md'
const GITLAB_HREF = 'https://gitlab.com/arjunkshah/ditherstudio'
const SKILL_HREF = 'https://ditherskill.ideatr.dev'

const LANDING_SHOWCASE = [
  {src: '/showcase/gallery/01-real-color.png', title: '01 / Atkinson'},
  {src: '/showcase/gallery/02-real-color.png', title: '02 / Blue noise'},
  {src: '/showcase/gallery/03-real-color.png', title: '03 / Bayer 8'},
  {src: '/showcase/gallery/04-real-color.png', title: '04 / Stucki'},
  {src: '/showcase/gallery/05-real-color.png', title: '05 / Riemersma'},
  {src: '/showcase/gallery/06-real-color.png', title: '06 / Atkinson'},
  {src: '/showcase/gallery/07-real-color.png', title: '07 / Blue noise'},
  {src: '/showcase/gallery/08-real-color.png', title: '08 / Bayer 8'},
  {src: '/showcase/gallery/09-real-color.png', title: '09 / Stucki'},
  {src: '/showcase/gallery/10-real-color.png', title: '10 / Riemersma'},
  {src: '/showcase/gallery/11-real-color.png', title: '11 / Atkinson'},
  {src: '/showcase/gallery/12-real-color.png', title: '12 / Blue noise'},
  {src: '/showcase/gallery/13-real-color.png', title: '13 / Bayer 8'},
  {src: '/showcase/gallery/14-real-color.png', title: '14 / Stucki'},
  {src: '/showcase/gallery/15-real-color.png', title: '15 / Riemersma'},
  {src: '/showcase/gallery/16-real-color.png', title: '16 / Atkinson'},
  {src: '/showcase/gallery/17-real-color.png', title: '17 / Blue noise'},
  {src: '/showcase/gallery/18-real-color.png', title: '18 / Bayer 8'},
  {src: '/showcase/gallery/19-real-color.png', title: '19 / Stucki'},
  {src: '/showcase/gallery/20-real-color.png', title: '20 / Riemersma'},
]

function FieldLabel({ children, value }: { children: React.ReactNode; value?: string | number }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {children}
      </span>
      {value !== undefined && (
        <span className="font-mono text-[11px] tabular-nums text-ink-soft">{value}</span>
      )}
    </div>
  )
}

function Toggle({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-[13px] transition active:scale-[0.99] ${
        on
          ? 'border-ink bg-ink text-surface'
          : 'border-line bg-surface text-ink hover:border-line-strong'
      }`}
    >
      <span>{label}</span>
      <span className={`font-mono text-[10px] ${on ? 'text-faint' : 'text-muted'}`}>
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

function extractedPalettePatch(buffer: import('./lib/dither').PixelBuffer): Partial<StudioPreset> {
  const colors = extractPalette(buffer, 6)
  const hex = colors.map((c) => rgbToHex(c[0], c[1], c[2]))
  return {
    paletteHex: hex,
    darkHex: hex[0],
    lightHex: hex[hex.length - 1],
    colorMode: true,
  }
}

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/docs')) {
    return <DocsPage gitlabHref={GITLAB_HREF} studioHref="/" skillHref={SKILL_HREF} />
  }

  const initialSearchRef = useRef(typeof window === 'undefined' ? '' : window.location.search)
  const initial = useMemo(() => {
    if (typeof window === 'undefined') return DEFAULT_PRESET
    return mergePreset(DEFAULT_PRESET, presetFromQuery(window.location.search))
  }, [])

  const [preset, setPreset] = useState<StudioPreset>(initial)
  const [history, setHistory] = useState<StudioPreset[]>([initial])
  const [histIdx, setHistIdx] = useState(0)

  const [source, setSource] = useState<SourceState | null>(null)
  const [compare, setCompare] = useState(0)
  const [busy, setBusy] = useState(false)
  const [procMs, setProcMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<{ w: number; h: number } | null>(null)
  const [showCompareAll, setShowCompareAll] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [compareThumbs, setCompareThumbs] = useState<Record<string, string>>({})
  const [examples, setExamples] = useState<
    { id: string; title: string; blurb: string; source: string; sourceFile: string; resultFile: string; algorithm: string; pixelSize: number }[]
  >([])
  const [zoom, setZoom] = useState(1)
  const [draggingCompare, setDraggingCompare] = useState(false)
  const [genPhase, setGenPhase] = useState(0)
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({
    algorithm: true,
    size: false,
    tone: false,
    palette: true,
    options: false,
    generate: false,
  })
  const toggleSec = (key: string) =>
    setOpenSec((s) => ({ ...s, [key]: !s[key] }))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultBlobRef = useRef<Blob | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const sourceBufRef = useRef<import('./lib/dither').PixelBuffer | null>(null)
  const autoPaletteRef = useRef<boolean>((() => {
    const params = new URLSearchParams(initialSearchRef.current)
    return !(
      params.has('pal') ||
      params.has('palette') ||
      params.has('dark') ||
      params.has('light') ||
      params.has('color')
    )
  })())
  const processGen = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const { run: runWorker } = useDitherWorker()

  const activeMeta = useMemo(
    () => ALGORITHMS.find((a) => a.id === preset.algorithm) ?? ALGORITHMS[0],
    [preset.algorithm],
  )

  const patch = useCallback((p: Partial<StudioPreset>, pushHist = true) => {
    setPreset((prev) => {
      const next = mergePreset(prev, p)
      if (pushHist) {
        setHistory((h) => {
          const trimmed = h.slice(0, histIdx + 1)
          const stack = [...trimmed, next].slice(-30)
          setHistIdx(stack.length - 1)
          return stack
        })
      }
      return next
    })
  }, [histIdx])

  const undo = useCallback(() => {
    setHistIdx((i) => {
      const ni = Math.max(0, i - 1)
      setPreset(history[ni] ?? DEFAULT_PRESET)
      return ni
    })
  }, [history])

  const redo = useCallback(() => {
    setHistIdx((i) => {
      const ni = Math.min(history.length - 1, i + 1)
      setPreset(history[ni] ?? DEFAULT_PRESET)
      return ni
    })
  }, [history])

  // URL sync
  useEffect(() => {
    const q = presetToQuery(preset)
    const url = `${window.location.pathname}?${q}`
    window.history.replaceState(null, '', url)
    document.documentElement.dataset.theme = preset.theme
  }, [preset])

  const loadFromUrl = useCallback(async (objectUrl: string, fileName: string) => {
    setError(null)
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = objectUrl
    })
    sourceBufRef.current = imageElementToBuffer(img, 4096)
    if (autoPaletteRef.current) {
      patch(extractedPalettePatch(sourceBufRef.current), false)
    }
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl)
      return {
        fileName,
        objectUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        element: img,
      }
    })
  }, [patch])

  const loadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/') && !file.name.match(/\.(svg|png|jpe?g|webp|gif)$/i)) {
        setError('Not an image. Use PNG, JPEG, WebP, GIF, or SVG.')
        return
      }
      const objectUrl = URL.createObjectURL(file)
      try {
        await loadFromUrl(objectUrl, file.name)
      } catch {
        URL.revokeObjectURL(objectUrl)
        setError('Could not read that image.')
      }
    },
    [loadFromUrl],
  )

  const loadNamedSample = useCallback(
    async (name: string, algo?: AlgorithmId, pixelSize?: number) => {
      const sampleFile = name === 'portrait'
        ? '01-picsum-10.jpg'
        : /\.[a-z0-9]+$/i.test(name)
          ? name
          : `${name}.png`
      const url = `/examples/sources/${sampleFile}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Sample "${name}" not found`)
      const blob = await res.blob()
      await loadFile(new File([blob], sampleFile, { type: blob.type || 'image/png' }))
      const patchOpts: Partial<StudioPreset> = { sample: name }
      if (algo) patchOpts.algorithm = algo
      if (pixelSize) patchOpts.pixelSize = pixelSize
      patch(patchOpts)
    },
    [loadFile, patch],
  )

  const loadSample = useCallback(async () => {
    try {
      await loadNamedSample('portrait', 'floyd-steinberg')
    } catch {
      setError('Could not load sample pack')
    }
  }, [loadNamedSample])

  // Load examples manifest + deep-link sample
  useEffect(() => {
    void fetch('/examples/manifest.json')
      .then((r) => r.json())
      .then((m) => setExamples(m.demos || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!preset.sample || source) return
    void loadNamedSample(preset.sample).catch(() => {})
    // only on first mount when URL has sample
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearSource = useCallback(() => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl)
      return null
    })
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = null
    resultBlobRef.current = null
    sourceBufRef.current = null
    setResultUrl(null)
    setResultSize(null)
    setError(null)
    setCompareThumbs({})
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void loadFile(file)
            break
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadFile])

  const buildGenBuffer = useCallback(
    (t: number) => {
      if (!preset.genType) return null
      const canvas = renderGenerator(preset.genType, {
        t,
        value: preset.genValue,
        width: preset.genWidth,
        height: preset.genHeight,
        seed: preset.seed,
        label: preset.genLabel,
        ink: preset.darkHex,
        paper: preset.lightHex,
        accent: preset.genAccent,
        muted: '#9a9a94',
      })
      return { canvas, buf: canvasToBuffer(canvas) }
    },
    [preset],
  )

  const commitGenSource = useCallback(
    (canvas: HTMLCanvasElement, buf: import('./lib/dither').PixelBuffer) => {
      sourceBufRef.current = buf
      const objectUrl = canvas.toDataURL('image/png')
      setSource((prev) => {
        if (prev?.objectUrl.startsWith('blob:')) URL.revokeObjectURL(prev.objectUrl)
        return {
          fileName: `gen-${preset.genType ?? 'component'}.png`,
          objectUrl,
          width: canvas.width,
          height: canvas.height,
          element: prev?.element ?? new Image(),
        }
      })
    },
    [preset.genType],
  )

  // Still frame when not animating
  useEffect(() => {
    if (!preset.genType || preset.genAnimate) return
    const built = buildGenBuffer(genPhase)
    if (built) commitGenSource(built.canvas, built.buf)
  }, [
    preset.genType,
    preset.genValue,
    preset.genWidth,
    preset.genHeight,
    preset.genLabel,
    preset.genAccent,
    preset.darkHex,
    preset.lightHex,
    preset.seed,
    preset.genAnimate,
    buildGenBuffer,
    commitGenSource,
    genPhase,
  ])

  // Live animate: generate + dither each tick (capped)
  useEffect(() => {
    if (!preset.genType || !preset.genAnimate) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }
    let alive = true
    let last = performance.now()
    let phase = 0
    let dithering = false
    const loop = (now: number) => {
      if (!alive) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      phase = (phase + dt * Math.max(0.05, preset.genSpeed)) % 1
      setGenPhase(phase)
      if (!dithering) {
        dithering = true
        const built = buildGenBuffer(phase)
        if (built) {
          sourceBufRef.current = built.buf
          // lightweight source preview every few frames
          if (Math.floor(phase * 30) % 3 === 0) {
            commitGenSource(built.canvas, built.buf)
          }
          void runWorker(built.buf, {
            dither: presetToDitherOptions(preset),
            pixelSize: Math.max(1, preset.pixelSize),
            maxDim: Math.min(preset.maxDim, 640),
            exportScale: 1,
          })
            .then(async ({ buffer, ms }) => {
              if (!alive) return
              const blob = await imageDataToBlob(buffer)
              if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
              const url = URL.createObjectURL(blob)
              resultUrlRef.current = url
              resultBlobRef.current = blob
              setResultUrl(url)
              setResultSize({ w: buffer.width, h: buffer.height })
              setProcMs(ms)
              setBusy(false)
            })
            .catch(() => {})
            .finally(() => {
              dithering = false
            })
        } else {
          dithering = false
        }
      }
      animRef.current = requestAnimationFrame(loop)
    }
    setBusy(true)
    animRef.current = requestAnimationFrame(loop)
    return () => {
      alive = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [
    preset.genType,
    preset.genAnimate,
    preset.genSpeed,
    preset.genValue,
    preset.genWidth,
    preset.genHeight,
    preset.genLabel,
    preset.genAccent,
    preset.algorithm,
    preset.threshold,
    preset.pixelSize,
    preset.seed,
    preset.darkHex,
    preset.lightHex,
    preset.brightness,
    preset.saturation,
    preset.noise,
    preset.strength,
    preset.softness,
    preset.gamma,
    preset.contrast,
    preset.edgeAware,
    preset.colorMode,
    preset.paletteHex,
    preset.invert,
    preset.serpentine,
    preset.cellSize,
    preset.maxDim,
    buildGenBuffer,
    commitGenSource,
    runWorker,
  ])

  // Process static sources (upload / sample / still gen)
  useEffect(() => {
    if (!source || !sourceBufRef.current) return
    if (preset.genType && preset.genAnimate) return // handled by anim loop
    const gen = ++processGen.current
    setBusy(true)
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const { buffer, ms } = await runWorker(sourceBufRef.current!, {
            dither: presetToDitherOptions(preset),
            pixelSize: preset.pixelSize,
            maxDim: preset.maxDim,
            exportScale: preset.exportScale,
          })
          if (gen !== processGen.current) return
          const blob = await imageDataToBlob(buffer)
          if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
          const url = URL.createObjectURL(blob)
          resultUrlRef.current = url
          resultBlobRef.current = blob
          setResultUrl(url)
          setResultSize({ w: buffer.width, h: buffer.height })
          setProcMs(ms)
          setBusy(false)
        } catch (err) {
          if (gen !== processGen.current) return
          setError(err instanceof Error ? err.message : 'Dither failed')
          setBusy(false)
        }
      })()
    }, 40)
    return () => window.clearTimeout(t)
  }, [source, preset, runWorker])

  const download = useCallback(() => {
    if (!resultBlobRef.current || !source) return
    const base = source.fileName.replace(/\.[^.]+$/, '') || 'dither'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(resultBlobRef.current)
    a.download = `${base}-${preset.algorithm}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [source, preset.algorithm])

  /** Export 32×32 + 16×16 favicon-style PNGs from current result */
  const downloadFavicon = useCallback(async () => {
    if (!resultUrl || !sourceBufRef.current) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('favicon source failed'))
      img.src = resultUrl
    })
    for (const size of [32, 16]) {
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, size, size)
      const blob = await new Promise<Blob>((resolve, reject) => {
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('fail'))), 'image/png')
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `favicon-${size}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }
  }, [resultUrl])

  const extractPal = useCallback(() => {
    if (!sourceBufRef.current) return
    autoPaletteRef.current = true
    patch(extractedPalettePatch(sourceBufRef.current))
  }, [patch])

  const runCompareAll = useCallback(async () => {
    if (!sourceBufRef.current) return
    setShowCompareAll(true)
    setCompareThumbs({})
    const thumbs: Record<string, string> = {}
    for (const algo of ALGORITHMS) {
      try {
        const { buffer } = await runWorker(sourceBufRef.current, {
          dither: { ...presetToDitherOptions(preset), algorithm: algo.id },
          pixelSize: Math.max(preset.pixelSize, 2),
          maxDim: 320,
          exportScale: 1,
        })
        const blob = await imageDataToBlob(buffer)
        thumbs[algo.id] = URL.createObjectURL(blob)
        setCompareThumbs({ ...thumbs })
      } catch {
        /* skip */
      }
    }
  }, [preset, runWorker])

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 's') {
        e.preventDefault()
        download()
      }
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
      if (e.key === ' ' && source) {
        e.preventDefault()
        setCompare((c) => (c === 0 ? 50 : 0))
      }
      if (!meta && e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1
        if (ALGORITHMS[idx]) patch({ algorithm: ALGORITHMS[idx].id })
      }
      if (e.key === 'ArrowLeft') patch({ threshold: Math.max(0, preset.threshold - 5) })
      if (e.key === 'ArrowRight') patch({ threshold: Math.min(255, preset.threshold + 5) })
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.25))
      if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [download, undo, redo, source, patch, preset.threshold])

  const copyPreset = () => {
    void navigator.clipboard.writeText(presetToJson(preset))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) void loadFile(file)
  }

  const dark = preset.theme === 'dark'

  if (!source) {
    return (
      <div className={`flex h-[100dvh] max-h-[100dvh] overflow-hidden ${dark ? 'theme-dark' : ''} bg-canvas text-ink`}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <LandingPage
            docsHref={DOCS_HREF}
            gitlabHref={GITLAB_HREF}
            skillHref={SKILL_HREF}
            onOpenEditor={() => fileInputRef.current?.click()}
            onTrySample={() => void loadSample()}
            showcase={LANDING_SHOWCASE}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void loadFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex h-[100dvh] max-h-[100dvh] overflow-hidden ${dark ? 'theme-dark' : ''} bg-canvas text-ink`}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="z-40 shrink-0 border-b border-line bg-surface">
        <div className="flex h-12 items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-6 w-6 shrink-0 grid-cols-2 grid-rows-2 gap-px bg-line" aria-hidden>
              <span className="bg-ink" />
              <span className="bg-fill" />
              <span className="bg-fill" />
              <span className="bg-ink" />
            </div>
            <p className="truncate text-[15px] font-semibold tracking-tight">DitherStudio</p>
          </div>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => patch({ theme: dark ? 'light' : 'dark' }, false)}
              className="inline-flex h-8 w-8 items-center justify-center border border-line text-ink-soft hover:border-line-strong"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? <Sun size={15} weight="bold" /> : <Moon size={15} weight="bold" />}
            </button>
            <button
              type="button"
              onClick={() => setShowExamples(true)}
              className="hidden items-center gap-1.5 border border-line px-2.5 py-1.5 text-[13px] text-ink-soft sm:inline-flex"
            >
              Examples
            </button>
            {source && (
              <button
                type="button"
                onClick={() => void runCompareAll()}
                className="hidden items-center gap-1.5 border border-line px-2.5 py-1.5 text-[13px] text-ink-soft md:inline-flex"
              >
                <GridFour size={15} />
                Compare
              </button>
            )}
            {resultUrl && (
              <button
                type="button"
                onClick={() => void downloadFavicon()}
                className="hidden items-center gap-1.5 border border-line px-2.5 py-1.5 text-[13px] text-ink-soft lg:inline-flex"
                title="Export 32px and 16px favicon PNGs"
              >
                Favicon
              </button>
            )}
            <button
              type="button"
              onClick={download}
              disabled={!resultUrl}
              className="inline-flex items-center gap-1.5 bg-ink px-3 py-1.5 text-[13px] font-medium text-surface disabled:opacity-30 active:scale-[0.98]"
            >
              <DownloadSimple size={15} weight="bold" />
              Export
            </button>
          </nav>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="relative flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
            <div
              className="relative flex flex-1 flex-col"
              onDrop={onDrop}
            >
              <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
                <div className="flex min-w-0 items-center gap-2 text-[13px]">
                  <ImageIcon size={15} className="text-muted" />
                  <span className="truncate font-medium">{source.fileName}</span>
                  <span className="hidden font-mono text-[11px] text-faint sm:inline">
                    {source.width}×{source.height}
                    {resultSize ? ` → ${resultSize.w}×${resultSize.h}` : ''}
                    {procMs != null ? ` · ${procMs}ms` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {busy && <span className="font-mono text-[11px] text-muted">working</span>}
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded border border-line p-1" aria-label="Zoom out">
                    <MagnifyingGlassMinus size={14} />
                  </button>
                  <span className="w-10 text-center font-mono text-[11px] text-faint">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded border border-line p-1" aria-label="Zoom in">
                    <MagnifyingGlassPlus size={14} />
                  </button>
                  <button type="button" onClick={clearSource} className="ml-1 rounded border border-line px-2 py-1 text-[12px] text-muted">
                    <X size={13} className="inline" /> Clear
                  </button>
                </div>
              </div>

              <div
                ref={stageRef}
                className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-canvas p-3 sm:p-5"
              >
                <div
                  className="relative max-h-full max-w-full"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                >
                  <div className="relative inline-block max-h-[calc(100dvh-9.5rem)] max-w-full">
                    <img
                      src={source.objectUrl}
                      alt="Original"
                      className="block max-h-[calc(100dvh-9.5rem)] max-w-full object-contain select-none"
                      draggable={false}
                    />
                    {resultUrl && (
                      <div
                        className="pointer-events-none absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${compare}% 0 0)` }}
                      >
                        <img
                          src={resultUrl}
                          alt="Dithered"
                          className="h-full w-full object-contain"
                          style={{ imageRendering: preset.pixelSize > 1 || preset.exportScale > 1 ? 'pixelated' : 'auto' }}
                          draggable={false}
                        />
                      </div>
                    )}
                    <div
                      className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize"
                      style={{ left: `${100 - compare}%` }}
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setDraggingCompare(true)
                        const target = e.currentTarget.parentElement
                        if (!target) return
                        const move = (ev: PointerEvent) => {
                          const rect = target.getBoundingClientRect()
                          const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width))
                          setCompare(Math.round((1 - x) * 100))
                        }
                        const up = () => {
                          setDraggingCompare(false)
                          window.removeEventListener('pointermove', move)
                          window.removeEventListener('pointerup', up)
                        }
                        window.addEventListener('pointermove', move)
                        window.addEventListener('pointerup', up)
                      }}
                    >
                      <div className={`mx-auto h-full w-px ${draggingCompare ? 'bg-ink' : 'bg-ink/70'}`} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-line bg-surface px-4 py-3">
                <div className="flex items-center gap-3">
                  <label htmlFor="compare" className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Compare
                  </label>
                  <input
                    id="compare"
                    type="range"
                    min={0}
                    max={100}
                    value={compare}
                    onChange={(e) => setCompare(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono text-[11px] text-faint">
                    {compare === 0 ? 'out' : compare === 100 ? 'src' : `${100 - compare}%`}
                  </span>
                </div>
              </div>
            </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void loadFile(f)
              e.target.value = ''
            }}
          />
        </section>

        <aside className="flex min-h-0 flex-col border-t border-line bg-surface lg:border-t-0">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Controls</h2>
            <div className="flex gap-2">
              <button type="button" onClick={undo} className="text-[12px] text-muted hover:text-ink" title="Undo ⌘Z">
                Undo
              </button>
              <button
                type="button"
                onClick={() => {
                  autoPaletteRef.current = true
                  const next = sourceBufRef.current
                    ? mergePreset(DEFAULT_PRESET, extractedPalettePatch(sourceBufRef.current))
                    : DEFAULT_PRESET
                  setPreset(next)
                  setHistory([next])
                  setHistIdx(0)
                }}
                className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
              >
                <ArrowCounterClockwise size={13} />
                Reset
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Collapsible
              title="Algorithm"
              open={openSec.algorithm}
              onToggle={() => toggleSec('algorithm')}
              badge={activeMeta.name}
            >
            <div>
              <FieldLabel>Algorithm</FieldLabel>
              <div className="relative">
                <select
                  value={preset.algorithm}
                  onChange={(e) => patch({ algorithm: e.target.value as AlgorithmId })}
                  className="w-full appearance-none rounded-md border border-line bg-canvas py-2 pl-3 pr-9 text-[13px] outline-none focus:border-ink"
                >
                  {ALGORITHMS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <CaretDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
              <p className="mt-1 text-[12px] text-muted">{activeMeta.blurb}</p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {(['floyd-steinberg', 'atkinson', 'bayer-8', 'blue-noise', 'halftone', 'hybrid'] as AlgorithmId[]).map(
                  (id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => patch({ algorithm: id })}
                      className={`border px-2 py-1.5 text-left text-[11px] ${
                        preset.algorithm === id
                          ? 'border-ink bg-ink text-surface'
                          : 'border-line bg-canvas text-ink-soft'
                      }`}
                    >
                      {ALGORITHMS.find((a) => a.id === id)?.name}
                    </button>
                  ),
                )}
              </div>
              <div className="mt-3">
                <FieldLabel value={preset.threshold}>Threshold</FieldLabel>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={preset.threshold}
                  onChange={(e) => patch({ threshold: Number(e.target.value) })}
                />
              </div>
              {preset.algorithm === 'halftone' && (
                <div className="mt-3">
                  <FieldLabel value={`${preset.cellSize}px`}>Dot cell</FieldLabel>
                  <input
                    type="range"
                    min={2}
                    max={24}
                    value={preset.cellSize}
                    onChange={(e) => patch({ cellSize: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
            </Collapsible>

            <Collapsible title="Size & export" open={openSec.size} onToggle={() => toggleSec('size')}>
              <div>
                <FieldLabel value={`${preset.pixelSize}x`}>Pixel size</FieldLabel>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={preset.pixelSize}
                  onChange={(e) => patch({ pixelSize: Number(e.target.value) })}
                />
              </div>
              <div>
                <FieldLabel value={`${preset.exportScale}x`}>Export scale</FieldLabel>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => patch({ exportScale: s })}
                      className={`border py-1.5 text-[12px] font-mono ${
                        preset.exportScale === s
                          ? 'border-ink bg-ink text-surface'
                          : 'border-line bg-canvas'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel value={preset.maxDim >= 4000 ? 'full' : preset.maxDim}>
                  Quality max edge
                </FieldLabel>
                <input
                  type="range"
                  min={800}
                  max={4096}
                  step={100}
                  value={preset.maxDim}
                  onChange={(e) => patch({ maxDim: Number(e.target.value) })}
                />
              </div>
            </Collapsible>

            <Collapsible title="Tone" open={openSec.tone} onToggle={() => toggleSec('tone')}>
              <div>
                <FieldLabel value={preset.brightness}>Brightness</FieldLabel>
                <input type="range" min={-100} max={100} value={preset.brightness} onChange={(e) => patch({ brightness: Number(e.target.value) })} />
              </div>
              <div>
                <FieldLabel value={preset.saturation.toFixed(2)}>Saturation</FieldLabel>
                <input type="range" min={0} max={200} value={Math.round(preset.saturation * 100)} onChange={(e) => patch({ saturation: Number(e.target.value) / 100 })} />
              </div>
              <div>
                <FieldLabel value={preset.gamma.toFixed(2)}>Gamma</FieldLabel>
                <input type="range" min={40} max={240} value={Math.round(preset.gamma * 100)} onChange={(e) => patch({ gamma: Number(e.target.value) / 100 })} />
              </div>
              <div>
                <FieldLabel value={preset.contrast.toFixed(2)}>Contrast</FieldLabel>
                <input type="range" min={50} max={200} value={Math.round(preset.contrast * 100)} onChange={(e) => patch({ contrast: Number(e.target.value) / 100 })} />
              </div>
              <div>
                <FieldLabel value={Math.round(preset.noise * 100)}>Noise</FieldLabel>
                <input type="range" min={0} max={100} value={Math.round(preset.noise * 100)} onChange={(e) => patch({ noise: Number(e.target.value) / 100 })} />
              </div>
              <div>
                <FieldLabel value={`${Math.round(preset.strength * 100)}%`}>Strength</FieldLabel>
                <input type="range" min={0} max={100} value={Math.round(preset.strength * 100)} onChange={(e) => patch({ strength: Number(e.target.value) / 100 })} />
              </div>
              <div>
                <FieldLabel value={preset.softness.toFixed(1)}>Softness</FieldLabel>
                <input type="range" min={0} max={30} value={Math.round(preset.softness * 10)} onChange={(e) => patch({ softness: Number(e.target.value) / 10 })} />
              </div>
              <div>
                <FieldLabel value={preset.seed}>Seed</FieldLabel>
                <input type="number" value={preset.seed} onChange={(e) => patch({ seed: Number(e.target.value) || 0 })} className="w-full border border-line bg-canvas px-2 py-1.5 font-mono text-[13px]" />
              </div>
            </Collapsible>

            <Collapsible title="Palette" open={openSec.palette} onToggle={() => toggleSec('palette')}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Colors</span>
                <button type="button" onClick={extractPal} disabled={!source} className="text-[11px] text-muted hover:text-ink disabled:opacity-40">
                  Extract
                </button>
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                {PALETTE_PRESETS.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    title={pr.name}
                    onClick={() => {
                      autoPaletteRef.current = false
                      patch({
                        paletteHex: pr.colors,
                        darkHex: pr.colors[0],
                        lightHex: pr.colors[pr.colors.length - 1],
                        colorMode: pr.colors.length > 2,
                      })
                    }}
                    className="flex h-6 overflow-hidden border border-line"
                    style={{ width: 8 + pr.colors.length * 10 }}
                  >
                    {pr.colors.map((c) => (
                      <span key={c} className="h-full flex-1" style={{ background: c }} />
                    ))}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preset.paletteHex.map((hex, i) => (
                  <label key={`${hex}-${i}`} className="flex items-center gap-1 border border-line bg-canvas px-1.5 py-1">
                    <input
                      type="color"
                      value={hex}
                      onChange={(e) => {
                        autoPaletteRef.current = false
                        const next = [...preset.paletteHex]
                        next[i] = e.target.value
                        patch({
                          paletteHex: next,
                          darkHex: next[0],
                          lightHex: next[next.length - 1],
                          colorMode: next.length > 2,
                        })
                      }}
                      className="h-6 w-6"
                    />
                    <button
                      type="button"
                      className="text-faint hover:text-ink"
                      onClick={() => {
                        if (preset.paletteHex.length <= 2) return
                        autoPaletteRef.current = false
                        const next = preset.paletteHex.filter((_, j) => j !== i)
                        patch({
                          paletteHex: next,
                          darkHex: next[0],
                          lightHex: next[next.length - 1],
                          colorMode: next.length > 2,
                        })
                      }}
                      aria-label="Remove color"
                    >
                      <Trash size={12} />
                    </button>
                  </label>
                ))}
                {preset.paletteHex.length < 12 && (
                  <button
                    type="button"
                    onClick={() => {
                      autoPaletteRef.current = false
                      patch({ paletteHex: [...preset.paletteHex, '#888888'], colorMode: true })
                    }}
                    className="border border-dashed border-line px-2 py-1 text-[12px] text-muted"
                  >
                    +
                  </button>
                )}
              </div>
            </Collapsible>

            <Collapsible title="Options" open={openSec.options} onToggle={() => toggleSec('options')}>
              <div className="flex flex-col gap-1.5">
                <Toggle on={preset.invert} label="Invert" onClick={() => patch({ invert: !preset.invert })} />
                <Toggle on={preset.serpentine} label="Serpentine" onClick={() => patch({ serpentine: !preset.serpentine })} />
                <Toggle on={preset.edgeAware} label="Edge aware" onClick={() => patch({ edgeAware: !preset.edgeAware })} />
                <Toggle on={preset.colorMode} label="Color diffusion" onClick={() => patch({ colorMode: !preset.colorMode })} />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={copyPreset} className="flex-1 border border-line py-2 text-[12px] text-ink-soft hover:border-line-strong">
                  Export preset
                </button>
                <label className="flex-1 cursor-pointer border border-line py-2 text-center text-[12px] text-ink-soft hover:border-line-strong">
                  Import
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        autoPaletteRef.current = false
                        setPreset(presetFromJson(await f.text()))
                      } catch {
                        setError('Invalid preset JSON')
                      }
                    }}
                  />
                </label>
              </div>
              {error && (
                <p className="mt-2 border border-line bg-fill px-3 py-2 text-[13px] text-ink-soft">{error}</p>
              )}
            </Collapsible>

            <Collapsible
              title="Generate"
              open={openSec.generate}
              onToggle={() => toggleSec('generate')}
              badge={preset.genType}
            >
              <GeneratePanel
                genType={preset.genType}
                genValue={preset.genValue}
                genWidth={preset.genWidth}
                genHeight={preset.genHeight}
                genAnimate={preset.genAnimate}
                genSpeed={preset.genSpeed}
                genLabel={preset.genLabel}
                genAccent={preset.genAccent}
                onChange={(p) => patch(p as Partial<StudioPreset>)}
                onApply={() => {
                  if (!preset.genType) patch({ genType: 'bar-chart' as GeneratorId })
                  const built = buildGenBuffer(genPhase)
                  if (built) commitGenSource(built.canvas, built.buf)
                }}
                onStop={() => patch({ genType: undefined, genAnimate: false })}
              />
            </Collapsible>
          </div>

          <div className="shrink-0 border-t border-line px-4 py-2.5">
            <p className="text-[11px] leading-relaxed text-faint">
              {activeMeta.name}
              {preset.genType ? ` · ${preset.genType}` : ''}. Locked layout. ⌘S export.
            </p>
          </div>
        </aside>
      </main>
      </div>

      {/* Examples gallery modal */}
      {showExamples && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-4xl overflow-auto rounded-lg border border-line bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold">Example pack</h3>
                <p className="text-[12px] text-muted">
                  Click to load source + apply the matching algorithm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExamples(false)}
                className="rounded border border-line p-1"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {examples.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    void loadNamedSample(ex.source, ex.algorithm as AlgorithmId, ex.pixelSize)
                    setShowExamples(false)
                  }}
                  className="overflow-hidden rounded-md border border-line text-left hover:border-ink"
                >
                  <div className="grid grid-cols-2">
                    <img
                      src={`/examples/${ex.sourceFile}`}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    <img
                      src={`/examples/${ex.resultFile}`}
                      alt=""
                      className="aspect-square w-full object-cover"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <div className="border-t border-line px-2 py-1.5">
                    <p className="text-[12px] font-medium leading-snug">{ex.title}</p>
                    <p className="font-mono text-[10px] text-faint">{ex.algorithm}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compare all modal */}
      {showCompareAll && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-4xl overflow-auto rounded-lg border border-line bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">All algorithms</h3>
              <button type="button" onClick={() => setShowCompareAll(false)} className="rounded border border-line p-1">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {ALGORITHMS.map((algo) => (
                <button
                  key={algo.id}
                  type="button"
                  onClick={() => {
                    patch({ algorithm: algo.id })
                    setShowCompareAll(false)
                  }}
                  className="overflow-hidden rounded-md border border-line text-left hover:border-ink"
                >
                  <div className="aspect-[4/3] bg-fill">
                    {compareThumbs[algo.id] ? (
                      <img src={compareThumbs[algo.id]} alt={algo.name} className="h-full w-full object-cover" style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="grid h-full place-items-center font-mono text-[10px] text-faint">…</div>
                    )}
                  </div>
                  <div className="border-t border-line px-2 py-1.5">
                    <p className="text-[12px] font-medium">{algo.name}</p>
                    <p className="font-mono text-[10px] text-faint">{algo.id}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
