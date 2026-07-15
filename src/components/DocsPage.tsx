import {ArrowLeft, ArrowSquareOut} from '@phosphor-icons/react'

type DocsPageProps = {
  gitlabHref: string
  studioHref: string
  skillHref: string
}

const sections = [
  {
    title: 'Web studio',
    body: 'Drop an image, choose an algorithm, and export the result locally in the browser.',
    code: 'npm install\nnpm run dev',
  },
  {
    title: 'CLI',
    body: 'Use the same core renderer from the terminal for stills, batches, and video inputs.',
    code: 'npm run cli -- photo.jpg -o out.png -a floyd-steinberg -t 128 --json',
  },
  {
    title: 'HTTP API',
    body: 'POST image files or base64 payloads to the local service when agents need a request/response flow.',
    code: 'npm run serve\n# http://127.0.0.1:8787',
  },
]

export function DocsPage({gitlabHref, studioHref, skillHref}: DocsPageProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/92 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href={studioHref} className="inline-flex items-center gap-2 text-[12px] text-muted hover:text-ink">
            <ArrowLeft size={12} />
            Studio
          </a>
          <div className="flex items-center gap-4 text-[12px] text-muted">
            <a href={skillHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              DitherSkill
              <ArrowSquareOut size={12} />
            </a>
            <a href={gitlabHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              GitLab
              <ArrowSquareOut size={12} />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Docs</p>
        <h1 className="mt-3 text-[40px] font-semibold leading-[0.95] sm:text-[56px]">DitherStudio</h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-6 text-ink-soft">
          Local image dithering for coding agents. The studio, CLI, and API all share the same core renderer and the
          same palette logic.
        </p>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {sections.map((section) => (
            <section key={section.title} className="border border-line bg-surface p-4">
              <h2 className="text-[15px] font-medium">{section.title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-muted">{section.body}</p>
              <pre className="mt-4 overflow-x-auto border border-line bg-canvas p-3 text-[12px] leading-5 text-ink-soft">
                <code>{section.code}</code>
              </pre>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-6 text-[12px] text-muted">
          <p>Algorithms: threshold, random, floyd-steinberg, atkinson, jjn, stucki, burkes, sierra, bayer-2, bayer-4, bayer-8, halftone, blue-noise, riemersma, hybrid.</p>
          <p className="mt-3">
            API and examples live in the repo docs. Open the source on{' '}
            <a href={gitlabHref} target="_blank" rel="noreferrer" className="text-ink hover:underline">
              GitLab
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
