import {useEffect, useRef, useState} from 'react'
import {ArrowRight, ArrowSquareOut} from '@phosphor-icons/react'

type ShowcaseItem = {
  src: string
  title: string
}

type LandingPageProps = {
  docsHref: string
  githubHref: string
  onOpenEditor: () => void
  onTrySample: () => void
  showcase: ShowcaseItem[]
}

const ratios = ['4 / 5', '1 / 1', '5 / 4', '16 / 9']

export function LandingPage({
  docsHref,
  githubHref,
  onOpenEditor,
  onTrySample,
  showcase,
}: LandingPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const update = () => {
      const section = lockRef.current
      if (!section) return
      const start = section.offsetTop
      const span = Math.max(1, section.offsetHeight - node.clientHeight)
      const raw = (node.scrollTop - start) / span
      setProgress(Math.max(0, Math.min(1, raw)))
    }

    update()
    node.addEventListener('scroll', update, {passive: true})
    window.addEventListener('resize', update)
    return () => {
      node.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const muted = 0.62 + progress * 0.38
  const body = 0.5 + progress * 0.5

  return (
    <div ref={scrollRef} className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/90 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-ink" />
            <span className="text-[12px] font-medium tracking-tight text-ink">DitherStudio</span>
          </div>
          <nav className="flex items-center gap-4 text-[12px] text-muted">
            <button
              type="button"
              onClick={() => galleryRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})}
              className="hover:text-ink"
            >
              Examples
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})}
              className="hover:text-ink"
            >
              Gallery
            </button>
            <a href={docsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              Docs
              <ArrowSquareOut size={12} />
            </a>
          </nav>
        </div>
      </header>

      <section className="relative flex min-h-[100dvh] items-end overflow-hidden border-b border-line bg-[#0d100d] text-[#f4f0e6]">
        <img
          src="/showcase/gallery/mountain-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,10,8,.88),rgba(8,10,8,.54)_54%,rgba(8,10,8,.72)),linear-gradient(180deg,rgba(8,10,8,.12),rgba(8,10,8,.58))]" />
        <div className="relative z-10 w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#d8d3c6]/70">Local dithering for agents</p>
          <h1 className="mt-4 max-w-[12ch] text-[48px] font-semibold leading-[0.92] sm:text-[64px] lg:text-[84px]">
            DitherStudio
          </h1>
          <p className="mt-4 max-w-[34rem] text-[14px] leading-6 text-[#d8d3c6]/78">
            Dither images, generated scenes, and video frames in the browser. Palette extraction stays on by default.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex h-9 items-center gap-2 bg-[#f4f0e6] px-3 text-[12px] font-medium text-[#111]"
            >
              Choose image
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})}
              className="h-9 border border-[#f4f0e6]/18 px-3 text-[12px] text-[#f4f0e6]/82"
            >
              View gallery
            </button>
            <button
              type="button"
              onClick={onTrySample}
              className="h-9 border border-[#f4f0e6]/18 px-3 text-[12px] text-[#f4f0e6]/82"
            >
              Try portrait
            </button>
          </div>
        </div>
      </section>

      <section ref={lockRef} className="relative h-[220vh] border-b border-line bg-[#0a0d0a] text-[#f3efe6]">
        <div className="sticky top-0 flex h-[100dvh] items-center">
          <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#b7b09f]">Scroll lock</p>
              <h2
                style={{color: `rgba(243, 239, 230, ${muted})`}}
                className="mt-3 text-[20px] font-medium leading-8 sm:text-[24px]"
              >
                Extracted colors by default. Minimal controls. Fast local processing.
              </h2>
              <p
                style={{color: `rgba(243, 239, 230, ${body})`}}
                className="mt-4 max-w-lg text-[13px] leading-6"
              >
                The interface stays quiet until it needs to move. Load a file, let the palette come from the source,
                tune it only when you want a custom scheme, and export without leaving the browser.
              </p>
              <div className="mt-6 flex gap-3 text-[12px]">
                <button type="button" onClick={onOpenEditor} className="text-[#f3efe6]/80 hover:text-[#f3efe6]">
                  Start a dither
                </button>
                <a href={githubHref} target="_blank" rel="noreferrer" className="text-[#f3efe6]/80 hover:text-[#f3efe6]">
                  GitHub
                </a>
              </div>
            </div>
            <div className="ml-auto hidden w-[28rem] lg:block">
              <div className="grid gap-3">
                {[
                  'Palette extraction reads the source image first.',
                  'Custom colors stay available when you need them.',
                  'The web app, CLI, and HTTP API share the same core.',
                ].map((line, index) => (
                  <div
                    key={line}
                    className="border-b border-[#f3efe6]/10 pb-3"
                    style={{color: `rgba(243, 239, 230, ${0.48 + progress * 0.52 - index * 0.08})`}}
                  >
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[#b7b09f]">
                      0{index + 1}
                    </div>
                    <div className="mt-1 text-[13px] leading-6">{line}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={galleryRef} className="border-b border-line bg-canvas px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Gallery</p>
              <h2 className="mt-2 text-[16px] font-medium">New image set</h2>
            </div>
            <p className="max-w-md text-right text-[12px] leading-5 text-muted">
              Real web images, already dithered, used as the new example gallery.
            </p>
          </div>

          <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
            {showcase.map((item, index) => {
              const ratio = ratios[index % ratios.length]
              return (
                <button
                  key={item.src}
                  type="button"
                  onClick={onOpenEditor}
                  className="mb-3 block w-full break-inside-avoid overflow-hidden border border-line bg-surface text-left"
                >
                  <div className="bg-fill" style={{aspectRatio: ratio}}>
                    <img
                      src={item.src}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-2 py-1.5 text-[11px] text-muted">
                    <span className="truncate">{item.title}</span>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="bg-canvas px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-line pt-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Local dithering. Extracted palettes. Agent-ready.</p>
          <div className="flex items-center gap-4">
            <a href={docsHref} target="_blank" rel="noreferrer" className="hover:text-ink">
              Docs
            </a>
            <a href={githubHref} target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
