import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  CaretDown,
  Copy,
  DownloadSimple,
  GridFour,
  Image as ImageIcon,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Moon,
  Sun,
  Terminal,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import {
  ALGORITHMS,
  type AlgorithmId,
  PALETTE_PRESETS,
  extractPalette,
  rgbToHex,
} from './lib/dither'
import { imageElementToBuffer, imageDataToBlob } from './lib/browser'
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

type SourceState = {
  fileName: string
  objectUrl: string
  width: number
  height: number
  element: HTMLImageElement
}

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

export default function App() {
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
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<{ w: number; h: number } | null>(null)
  const [showAgent, setShowAgent] = useState(false)
  const [showCompareAll, setShowCompareAll] = useState(false)
  const [compareThumbs, setCompareThumbs] = useState<Record<string, string>>({})
  const [zoom, setZoom] = useState(1)
  const [draggingCompare, setDraggingCompare] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultBlobRef = useRef<Blob | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const sourceBufRef = useRef<import('./lib/dither').PixelBuffer | null>(null)
  const processGen = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
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
  }, [])

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

  const loadSample = useCallback(async () => {
    const w = 720
    const h = 540
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#1a1a1a')
    g.addColorStop(0.35, '#777')
    g.addColorStop(0.7, '#d0d0d0')
    g.addColorStop(1, '#f5f5f5')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const r = ctx.createRadialGradient(w * 0.35, h * 0.4, 8, w * 0.35, h * 0.4, w * 0.5)
    r.addColorStop(0, 'rgba(255,255,255,0.55)')
    r.addColorStop(1, 'rgba(0,0,0,0.4)')
    ctx.fillStyle = r
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.arc(w * 0.7, h * 0.55, 100, 0, Math.PI * 2)
    ctx.fill()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('fail'))), 'image/png')
    })
    await loadFile(new File([blob], 'sample.png', { type: 'image/png' }))
  }, [loadFile])

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

  // Process
  useEffect(() => {
    if (!source || !sourceBufRef.current) return
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

  const extractPal = useCallback(() => {
    if (!sourceBufRef.current) return
    const colors = extractPalette(sourceBufRef.current, 6)
    const hex = colors.map((c) => rgbToHex(c[0], c[1], c[2]))
    patch({
      paletteHex: hex,
      darkHex: hex[0],
      lightHex: hex[hex.length - 1],
      colorMode: true,
    })
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

  const copyInstall = () => {
    void navigator.clipboard.writeText('npx skills add arjunkshah/ditherskill -g -y')
  }

  const copyPreset = () => {
    void navigator.clipboard.writeText(presetToJson(preset))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void loadFile(file)
  }

  const dark = preset.theme === 'dark'

  return (
    <div className={`min-h-[100dvh] ${dark ? 'theme-dark' : ''} bg-canvas text-ink`}>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft hover:border-line-strong"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setShowAgent((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] ${
                showAgent ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-soft'
              }`}
            >
              <Terminal size={15} weight="bold" />
              <span className="hidden sm:inline">Agents</span>
            </button>
            {source && (
              <button
                type="button"
                onClick={() => void runCompareAll()}
                className="hidden items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] text-ink-soft sm:inline-flex"
              >
                <GridFour size={15} />
                Compare
              </button>
            )}
            <button
              type="button"
              onClick={download}
              disabled={!resultUrl}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-surface disabled:opacity-30 active:scale-[0.98]"
            >
              <DownloadSimple size={15} weight="bold" />
              Export
            </button>
          </nav>
        </div>
      </header>

      {showAgent && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-3">
            <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-[11px] text-ink-soft">
              {`npx skills add arjunkshah/ditherskill -g -y\n\nnpm run cli -- in.png -o out.png -a ${preset.algorithm} -t ${preset.threshold} --seed ${preset.seed} --json`}
            </pre>
            <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-[11px] text-ink-soft">
              {`npm run serve\ncurl -F "file=@in.png" "http://127.0.0.1:8787/v1/dither?algorithm=${preset.algorithm}&threshold=${preset.threshold}" -o out.png`}
            </pre>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={copyInstall} className="rounded-md border border-line px-3 py-2 text-left text-[13px] hover:border-line-strong">
                <Copy size={14} className="mr-1 inline" /> Copy skill install
              </button>
              <button type="button" onClick={copyPreset} className="rounded-md border border-line px-3 py-2 text-left text-[13px] hover:border-line-strong">
                <Copy size={14} className="mr-1 inline" /> Copy preset JSON
              </button>
              <a href="https://ditherskill.ideatr.dev" className="text-[12px] text-muted underline" target="_blank" rel="noreferrer">
                ditherskill.ideatr.dev
              </a>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative flex min-h-[55dvh] flex-col border-b border-line lg:min-h-[calc(100dvh-3.5rem)] lg:border-b-0 lg:border-r">
          {!source ? (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`m-4 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 transition sm:m-6 ${
                dragOver ? 'border-ink bg-fill' : 'border-line-strong bg-surface hover:border-muted'
              }`}
            >
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-md border border-line bg-canvas">
                <UploadSimple size={22} weight="bold" />
              </div>
              <h1 className="text-center text-[1.7rem] font-semibold tracking-tight">
                Dither any image
              </h1>
              <p className="mt-2 max-w-sm text-center text-[14px] text-muted">
                Drop, paste, or browse. Multi-color palettes, workers, full-res export.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                <span className="rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-surface">
                  Choose image
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void loadSample()
                  }}
                  className="rounded-md border border-line bg-surface px-4 py-2 text-[13px] font-medium"
                >
                  Try sample
                </button>
              </div>
              <p className="mt-4 font-mono text-[11px] text-faint">
                PNG JPEG WebP GIF SVG · ⌘V paste · ⌘S export
              </p>
            </div>
          ) : (
            <div
              className="relative flex flex-1 flex-col"
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
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
                className="stage-grid relative flex flex-1 items-center justify-center overflow-auto p-4 sm:p-6"
              >
                <div
                  className="relative border border-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                >
                  <div className="relative inline-block max-h-[min(65dvh,680px)] max-w-full">
                    <img
                      src={source.objectUrl}
                      alt="Original"
                      className="block max-h-[min(65dvh,680px)] max-w-full object-contain select-none"
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
                    {/* Drag handle for compare */}
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
          )}
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

        <aside className="flex flex-col bg-surface lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Controls</h2>
            <div className="flex gap-2">
              <button type="button" onClick={undo} className="text-[12px] text-muted hover:text-ink" title="Undo ⌘Z">
                Undo
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreset(DEFAULT_PRESET)
                  setHistory([DEFAULT_PRESET])
                  setHistIdx(0)
                }}
                className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
              >
                <ArrowCounterClockwise size={13} />
                Reset
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4">
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
                      className={`rounded-md border px-2 py-1.5 text-left text-[11px] ${
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
            </div>

            <div>
              <FieldLabel value={preset.threshold}>Threshold</FieldLabel>
              <input
                type="range"
                min={0}
                max={255}
                value={preset.threshold}
                onChange={(e) => patch({ threshold: Number(e.target.value) })}
              />
            </div>

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
                    className={`rounded-md border py-1.5 text-[12px] font-mono ${
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
              <FieldLabel value={preset.maxDim >= 4000 ? 'full' : preset.maxDim}>Quality max edge</FieldLabel>
              <input
                type="range"
                min={800}
                max={4096}
                step={100}
                value={preset.maxDim}
                onChange={(e) => patch({ maxDim: Number(e.target.value) })}
              />
            </div>

            {preset.algorithm === 'halftone' && (
              <div>
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

            <div>
              <FieldLabel value={preset.gamma.toFixed(2)}>Gamma</FieldLabel>
              <input
                type="range"
                min={40}
                max={240}
                value={Math.round(preset.gamma * 100)}
                onChange={(e) => patch({ gamma: Number(e.target.value) / 100 })}
              />
            </div>

            <div>
              <FieldLabel value={preset.contrast.toFixed(2)}>Contrast</FieldLabel>
              <input
                type="range"
                min={50}
                max={200}
                value={Math.round(preset.contrast * 100)}
                onChange={(e) => patch({ contrast: Number(e.target.value) / 100 })}
              />
            </div>

            <div>
              <FieldLabel value={preset.seed}>Seed</FieldLabel>
              <input
                type="number"
                value={preset.seed}
                onChange={(e) => patch({ seed: Number(e.target.value) || 0 })}
                className="w-full rounded-md border border-line bg-canvas px-2 py-1.5 font-mono text-[13px]"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Palette
                </span>
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
                    onClick={() =>
                      patch({
                        paletteHex: pr.colors,
                        darkHex: pr.colors[0],
                        lightHex: pr.colors[pr.colors.length - 1],
                        colorMode: pr.colors.length > 2,
                      })
                    }
                    className="flex h-6 overflow-hidden rounded-sm border border-line"
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
                  <label key={`${hex}-${i}`} className="flex items-center gap-1 rounded border border-line bg-canvas px-1.5 py-1">
                    <input
                      type="color"
                      value={hex}
                      onChange={(e) => {
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
                    onClick={() =>
                      patch({
                        paletteHex: [...preset.paletteHex, '#888888'],
                        colorMode: true,
                      })
                    }
                    className="rounded border border-dashed border-line px-2 py-1 text-[12px] text-muted"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Toggle on={preset.invert} label="Invert" onClick={() => patch({ invert: !preset.invert })} />
              <Toggle
                on={preset.serpentine}
                label="Serpentine"
                onClick={() => patch({ serpentine: !preset.serpentine })}
              />
              <Toggle
                on={preset.edgeAware}
                label="Edge aware"
                onClick={() => patch({ edgeAware: !preset.edgeAware })}
              />
              <Toggle
                on={preset.colorMode}
                label="Color diffusion"
                onClick={() => patch({ colorMode: !preset.colorMode })}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyPreset}
                className="flex-1 rounded-md border border-line py-2 text-[12px] text-ink-soft hover:border-line-strong"
              >
                Export preset
              </button>
              <label className="flex-1 cursor-pointer rounded-md border border-line py-2 text-center text-[12px] text-ink-soft hover:border-line-strong">
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const text = await f.text()
                      setPreset(presetFromJson(text))
                    } catch {
                      setError('Invalid preset JSON')
                    }
                  }}
                />
              </label>
            </div>

            {error && (
              <p className="rounded-md border border-line bg-fill px-3 py-2 text-[13px] text-ink-soft">
                {error}
              </p>
            )}
          </div>

          <div className="mt-auto border-t border-line px-4 py-3">
            <p className="text-[11px] leading-relaxed text-faint">
              {activeMeta.name}. Keys: 1-9 algo, arrows threshold, space compare, ⌘S export, ⌘Z undo.
              Local only.
            </p>
          </div>
        </aside>
      </main>

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
