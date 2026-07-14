import { CaretDown } from '@phosphor-icons/react'

export function Collapsible({
  title,
  open,
  onToggle,
  children,
  badge,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: string
}) {
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-fill/60"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="font-mono text-[10px] text-faint">{badge}</span>
          )}
          <CaretDown
            size={14}
            className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  )
}
