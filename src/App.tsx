import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  CaretDown,
  CircleHalf,
  Code,
  DownloadSimple,
  Image as ImageIcon,
  Terminal,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import {
  ALGORITHMS,
  type AlgorithmId,
  type DitherOptions,
  dither,
  hexToRgb,
  upscaleNearest,
} from './lib/dither'
import { imageDataToBlob, prepareSource } from './lib/browser'

const MAX_PROCESS = 1600

const DEFAULT = {
  algorithm: 'floyd-steinberg' as AlgorithmId,
  threshold: 128,
  invert: false,
  serpentine: true,
  darkHex: '#111111',
  lightHex: '#fafafa',
  pixelSize: 1,
  cellSize: 6,
}

type SourceState = {
  fileName: string
  objectUrl: string
  width: number
  height: number
  element: HTMLImageElement
}

function FieldLabel({
  children,
  value,
}: {
  children: React.ReactNode
  value?: string | number
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
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
  icon,
  onClick,
}: {
  on: boolean
  label: string
  icon?: React.ReactNode
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
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-[10px] ${on ? 'text-faint' : 'text-muted'}`}>
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

export default function App() {
  const [source, setSource] = useState<SourceState | null>(null)
  const [algorithm, setAlgorithm] = useState<AlgorithmId>(DEFAULT.algorithm)
  const [threshold, setThreshold] = useState(DEFAULT.threshold)
  const [invert, setInvert] = useState(DEFAULT.invert)
  const [serpentine, setSerpentine] = useState(DEFAULT.serpentine)
  const [darkHex, setDarkHex] = useState(DEFAULT.darkHex)
  const [lightHex, setLightHex] = useState(DEFAULT.lightHex)
  const [pixelSize, setPixelSize] = useState(DEFAULT.pixelSize)
  const [cellSize, setCellSize] = useState(DEFAULT.cellSize)
  const [compare, setCompare] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<{ w: number; h: number } | null>(null)
  const [showAgent, setShowAgent] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultBlobRef = useRef<Blob | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const processGen = useRef(0)

  const activeMeta = useMemo(
    () => ALGORITHMS.find((a) => a.id === algorithm) ?? ALGORITHMS[0],
    [algorithm],
  )

  const loadFromUrl = useCallback(async (objectUrl: string, fileName: string) => {
    setError(null)
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = objectUrl
    })
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
      if (!file.type.startsWith('image/')) {
        setError('Not an image. Use PNG, JPEG, WebP, or GIF.')
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
    g.addColorStop(0.4, '#888888')
    g.addColorStop(0.7, '#d4d4d4')
    g.addColorStop(1, '#f5f5f5')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const r = ctx.createRadialGradient(w * 0.38, h * 0.42, 10, w * 0.38, h * 0.42, w * 0.5)
    r.addColorStop(0, 'rgba(255,255,255,0.5)')
    r.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = r
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.beginPath()
    ctx.arc(w * 0.7, h * 0.55, 100, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.arc(w * 0.58, h * 0.3, 52, 0, Math.PI * 2)
    ctx.fill()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Sample failed'))), 'image/png')
    })
    await loadFile(new File([blob], 'sample.png', { type: 'image/png' }))
  }, [loadFile])

  const clearSource = useCallback(() => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl)
      return null
    })
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    resultBlobRef.current = null
    setResultUrl(null)
    setResultSize(null)
    setError(null)
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

  useEffect(() => {
    if (!source) return
    const gen = ++processGen.current
    setBusy(true)
    const timer = window.setTimeout(() => {
      try {
        const options: DitherOptions = {
          algorithm,
          threshold,
          invert,
          serpentine,
          darkColor: hexToRgb(darkHex),
          lightColor: hexToRgb(lightHex),
          cellSize,
        }
        const prepared = prepareSource(source.element, MAX_PROCESS, pixelSize)
        let dithered = dither(prepared, options)
        if (pixelSize > 1) dithered = upscaleNearest(dithered, pixelSize)
        void imageDataToBlob(dithered).then((blob) => {
          if (gen !== processGen.current) return
          if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
          const url = URL.createObjectURL(blob)
          resultUrlRef.current = url
          resultBlobRef.current = blob
          setResultUrl(url)
          setResultSize({ w: dithered.width, h: dithered.height })
          setBusy(false)
        })
      } catch (err) {
        if (gen !== processGen.current) return
        setError(err instanceof Error ? err.message : 'Dither failed.')
        setBusy(false)
      }
    }, 36)
    return () => window.clearTimeout(timer)
  }, [
    source,
    algorithm,
    threshold,
    invert,
    serpentine,
    darkHex,
    lightHex,
    pixelSize,
    cellSize,
  ])

  const download = useCallback(async () => {
    if (!resultBlobRef.current || !source) return
    const base = source.fileName.replace(/\.[^.]+$/, '') || 'dither'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(resultBlobRef.current)
    a.download = `${base}-${algorithm}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [source, algorithm])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void loadFile(file)
    },
    [loadFile],
  )

  const resetControls = () => {
    setAlgorithm(DEFAULT.algorithm)
    setThreshold(DEFAULT.threshold)
    setInvert(DEFAULT.invert)
    setSerpentine(DEFAULT.serpentine)
    setDarkHex(DEFAULT.darkHex)
    setLightHex(DEFAULT.lightHex)
    setPixelSize(DEFAULT.pixelSize)
    setCellSize(DEFAULT.cellSize)
    setCompare(0)
  }

  const cliExample = `npx tsx src/cli.ts photo.jpg -o out.png \\
  -a ${algorithm} -t ${threshold} -p ${pixelSize}`

  const curlExample = `curl -sS -X POST "http://127.0.0.1:8787/v1/dither?algorithm=${algorithm}&threshold=${threshold}" \\
  -F "file=@photo.jpg" -o out.png`

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="grid h-6 w-6 shrink-0 grid-cols-2 grid-rows-2 gap-px bg-line"
              aria-hidden
            >
              <span className="bg-ink" />
              <span className="bg-fill" />
              <span className="bg-fill" />
              <span className="bg-ink" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight">DitherStudio</p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAgent((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition active:scale-[0.98] ${
                showAgent
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong'
              }`}
            >
              <Terminal size={15} weight="bold" />
              <span className="hidden sm:inline">Agents</span>
            </button>
            {source && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-line-strong sm:inline-flex active:scale-[0.98]"
              >
                <UploadSimple size={15} weight="bold" />
                Replace
              </button>
            )}
            <button
              type="button"
              onClick={() => void download()}
              disabled={!resultUrl}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-surface transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-30 active:scale-[0.98]"
            >
              <DownloadSimple size={15} weight="bold" />
              Export
            </button>
          </nav>
        </div>
      </header>

      {/* Agent panel */}
      {showAgent && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                <Terminal size={14} />
                CLI
              </div>
              <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                {cliExample}
              </pre>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                <Code size={14} />
                HTTP API
              </div>
              <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                {`npm run serve\n\n${curlExample}`}
              </pre>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Library
              </div>
              <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                {`import { ditherFile } from 'ditherstudio'\nawait ditherFile('in.png', 'out.png', {\n  algorithm: '${algorithm}',\n  threshold: ${threshold},\n})`}
              </pre>
              <p className="mt-2 text-[12px] text-muted leading-relaxed">
                Skill:{' '}
                <a
                  className="text-ink-soft underline underline-offset-2 hover:text-ink"
                  href="https://ditherskill.ideatr.dev"
                  target="_blank"
                  rel="noreferrer"
                >
                  ditherskill.ideatr.dev
                </a>
                . Install{' '}
                <code className="font-mono text-ink-soft">
                  npx skills add arjunkshah/ditherskill -g -y
                </code>
                . OpenAPI at{' '}
                <code className="font-mono text-ink-soft">/openapi.json</code> when serving.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Stage */}
        <section className="relative flex min-h-[58dvh] flex-col border-b border-line lg:min-h-[calc(100dvh-3.5rem)] lg:border-b-0 lg:border-r">
          {!source ? (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`m-4 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-20 transition sm:m-6 ${
                dragOver
                  ? 'border-ink bg-fill'
                  : 'border-line-strong bg-surface hover:border-muted'
              }`}
            >
              <div className="mb-6 grid h-12 w-12 place-items-center rounded-md border border-line bg-canvas">
                <UploadSimple size={22} className="text-ink" weight="bold" />
              </div>
              <h1 className="max-w-sm text-center text-[1.65rem] font-semibold tracking-tight text-ink sm:text-[1.85rem]">
                Dither any image
              </h1>
              <p className="mt-3 max-w-xs text-center text-[14px] leading-relaxed text-muted">
                Drop a file, paste from clipboard, or browse. Runs fully in your browser.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-surface">
                  Choose image
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void loadSample()
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink transition hover:border-line-strong active:scale-[0.98]"
                >
                  Try sample
                </button>
              </div>
              <p className="mt-5 font-mono text-[11px] text-faint">PNG JPEG WebP GIF</p>
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
              {dragOver && (
                <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-surface/70">
                  <span className="rounded-md border border-ink bg-surface px-4 py-2 text-[13px] font-medium">
                    Drop to replace
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-2 text-[13px]">
                  <ImageIcon size={15} className="shrink-0 text-muted" />
                  <span className="truncate font-medium">{source.fileName}</span>
                  <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline">
                    {source.width}×{source.height}
                    {resultSize ? ` → ${resultSize.w}×${resultSize.h}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {busy && (
                    <span className="font-mono text-[11px] text-muted">working</span>
                  )}
                  <button
                    type="button"
                    onClick={clearSource}
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] text-muted transition hover:border-line-strong hover:text-ink"
                    aria-label="Clear image"
                  >
                    <X size={13} weight="bold" />
                    Clear
                  </button>
                </div>
              </div>

              <div className="stage-grid relative flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
                <div className="relative max-h-full max-w-full rounded-sm border border-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                  <div className="relative inline-block max-h-[min(68dvh,700px)] max-w-full">
                    <img
                      src={source.objectUrl}
                      alt="Original"
                      className="block max-h-[min(68dvh,700px)] max-w-full object-contain"
                      draggable={false}
                    />
                    {resultUrl && (
                      <div
                        className="pointer-events-none absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${compare}% 0 0)` }}
                      >
                        <img
                          src={resultUrl}
                          alt="Dithered result"
                          className="h-full w-full object-contain"
                          style={{
                            imageRendering: pixelSize > 1 ? 'pixelated' : 'auto',
                          }}
                          draggable={false}
                        />
                      </div>
                    )}
                    {compare > 0 && compare < 100 && (
                      <div
                        className="pointer-events-none absolute inset-y-0 w-px bg-ink"
                        style={{ right: `${compare}%` }}
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-line bg-surface px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="compare"
                    className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted"
                  >
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
                  <span className="w-14 shrink-0 text-right font-mono text-[11px] text-faint">
                    {compare === 0 ? 'out' : compare === 100 ? 'src' : `${100 - compare}%`}
                  </span>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void loadFile(f)
              e.target.value = ''
            }}
          />
        </section>

        {/* Controls */}
        <aside className="flex flex-col bg-surface lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Controls
            </h2>
            <button
              type="button"
              onClick={resetControls}
              className="inline-flex items-center gap-1 text-[12px] text-muted transition hover:text-ink"
            >
              <ArrowCounterClockwise size={13} />
              Reset
            </button>
          </div>

          <div className="flex flex-col gap-5 p-4">
            {/* Algorithm select */}
            <div>
              <FieldLabel>Algorithm</FieldLabel>
              <div className="relative">
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as AlgorithmId)}
                  className="w-full appearance-none rounded-md border border-line bg-canvas py-2 pl-3 pr-9 text-[13px] text-ink outline-none transition focus:border-ink"
                >
                  {ALGORITHMS.map((algo) => (
                    <option key={algo.id} value={algo.id}>
                      {algo.name}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{activeMeta.blurb}</p>
            </div>

            {/* Quick algorithm chips - top families only as compact grid */}
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  'floyd-steinberg',
                  'atkinson',
                  'bayer-8',
                  'halftone',
                ] as AlgorithmId[]
              ).map((id) => {
                const selected = algorithm === id
                const name = ALGORITHMS.find((a) => a.id === id)?.name ?? id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAlgorithm(id)}
                    className={`rounded-md border px-2 py-1.5 text-left text-[12px] transition active:scale-[0.99] ${
                      selected
                        ? 'border-ink bg-ink text-surface'
                        : 'border-line bg-canvas text-ink-soft hover:border-line-strong'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>

            <div>
              <FieldLabel value={threshold}>Threshold</FieldLabel>
              <input
                type="range"
                min={0}
                max={255}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>

            <div>
              <FieldLabel value={`${pixelSize}x`}>Pixel size</FieldLabel>
              <input
                type="range"
                min={1}
                max={12}
                value={pixelSize}
                onChange={(e) => setPixelSize(Number(e.target.value))}
              />
            </div>

            {algorithm === 'halftone' && (
              <div>
                <FieldLabel value={`${cellSize}px`}>Dot cell</FieldLabel>
                <input
                  type="range"
                  min={2}
                  max={24}
                  value={cellSize}
                  onChange={(e) => setCellSize(Number(e.target.value))}
                />
              </div>
            )}

            <div>
              <FieldLabel>Palette</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-md border border-line bg-canvas px-2 py-2">
                  <input
                    type="color"
                    value={darkHex}
                    onChange={(e) => setDarkHex(e.target.value)}
                    aria-label="Ink color"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] text-muted">Ink</span>
                    <span className="block truncate font-mono text-[11px]">{darkHex}</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-line bg-canvas px-2 py-2">
                  <input
                    type="color"
                    value={lightHex}
                    onChange={(e) => setLightHex(e.target.value)}
                    aria-label="Paper color"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] text-muted">Paper</span>
                    <span className="block truncate font-mono text-[11px]">{lightHex}</span>
                  </span>
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  ['#111111', '#fafafa'],
                  ['#000000', '#ffffff'],
                  ['#1a1a1a', '#e8e4dc'],
                  ['#0c1220', '#dce6f5'],
                  ['#1a1210', '#f0e6e0'],
                ].map(([d, l]) => (
                  <button
                    key={`${d}${l}`}
                    type="button"
                    onClick={() => {
                      setDarkHex(d)
                      setLightHex(l)
                    }}
                    className="flex h-6 w-9 overflow-hidden rounded-sm border border-line transition hover:border-muted"
                    aria-label={`Palette ${d} ${l}`}
                  >
                    <span className="flex-1" style={{ background: d }} />
                    <span className="flex-1" style={{ background: l }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Toggle
                on={invert}
                label="Invert"
                icon={<CircleHalf size={15} />}
                onClick={() => setInvert((v) => !v)}
              />
              {activeMeta.family === 'error' && (
                <Toggle
                  on={serpentine}
                  label="Serpentine"
                  onClick={() => setSerpentine((v) => !v)}
                />
              )}
            </div>

            {error && (
              <p className="rounded-md border border-line bg-fill px-3 py-2 text-[13px] text-ink-soft">
                {error}
              </p>
            )}
          </div>

          <div className="mt-auto border-t border-line px-4 py-3">
            <p className="text-[11px] leading-relaxed text-faint">
              {activeMeta.name}. Client-side only. Agents: CLI, HTTP API, or{' '}
              <code className="font-mono">import</code> the library.
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
