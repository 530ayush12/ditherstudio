import { GENERATORS, type GeneratorId } from '../lib/generate'

export function GeneratePanel({
  genType,
  genValue,
  genWidth,
  genHeight,
  genAnimate,
  genSpeed,
  genLabel,
  genAccent,
  onChange,
  onApply,
  onStop,
}: {
  genType?: GeneratorId
  genValue: number
  genWidth: number
  genHeight: number
  genAnimate: boolean
  genSpeed: number
  genLabel: string
  genAccent: string
  onChange: (p: Record<string, unknown>) => void
  onApply: () => void
  onStop: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Component
        </p>
        <div className="grid grid-cols-2 gap-1">
          {GENERATORS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange({ genType: g.id })}
              className={`rounded-md border px-2 py-1.5 text-left text-[11px] leading-snug transition ${
                genType === g.id
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line bg-canvas text-ink-soft hover:border-line-strong'
              }`}
              title={g.blurb}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-[11px]">
          <span className="font-medium uppercase tracking-[0.08em] text-muted">Value</span>
          <span className="font-mono text-ink-soft">{Math.round(genValue * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(genValue * 100)}
          onChange={(e) => onChange({ genValue: Number(e.target.value) / 100 })}
        />
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-[11px]">
          <span className="font-medium uppercase tracking-[0.08em] text-muted">Speed</span>
          <span className="font-mono text-ink-soft">{genSpeed.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(genSpeed * 100)}
          onChange={(e) => onChange({ genSpeed: Number(e.target.value) / 100 })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted">
          W
          <input
            type="number"
            min={160}
            max={1280}
            value={genWidth}
            onChange={(e) => onChange({ genWidth: Number(e.target.value) || 640 })}
            className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1 font-mono text-[12px] text-ink"
          />
        </label>
        <label className="text-[11px] text-muted">
          H
          <input
            type="number"
            min={120}
            max={960}
            value={genHeight}
            onChange={(e) => onChange({ genHeight: Number(e.target.value) || 400 })}
            className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1 font-mono text-[12px] text-ink"
          />
        </label>
      </div>

      <label className="text-[11px] text-muted">
        Label
        <input
          type="text"
          value={genLabel}
          onChange={(e) => onChange({ genLabel: e.target.value })}
          className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-[13px] text-ink"
        />
      </label>

      <label className="flex items-center gap-2 rounded border border-line bg-canvas px-2 py-2 text-[13px]">
        <input
          type="color"
          value={genAccent}
          onChange={(e) => onChange({ genAccent: e.target.value })}
        />
        <span className="text-muted">Accent</span>
        <span className="ml-auto font-mono text-[11px]">{genAccent}</span>
      </label>

      <button
        type="button"
        onClick={() => onChange({ genAnimate: !genAnimate })}
        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-[13px] ${
          genAnimate ? 'border-ink bg-ink text-surface' : 'border-line bg-canvas'
        }`}
      >
        <span>Animate</span>
        <span className="font-mono text-[10px]">{genAnimate ? 'ON' : 'OFF'}</span>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={!genType}
          className="rounded-md bg-ink py-2 text-[13px] font-medium text-surface disabled:opacity-30"
        >
          Generate
        </button>
        <button
          type="button"
          onClick={onStop}
          className="rounded-md border border-line py-2 text-[13px] text-ink-soft"
        >
          Clear gen
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-faint">
        Generates charts, buttons, sliders, meters, and dashboards as live canvases, then
        dithers every frame when animate is on.
      </p>
    </div>
  )
}
