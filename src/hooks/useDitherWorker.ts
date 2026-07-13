import { useCallback, useEffect, useRef } from 'react'
import type { DitherOptions, PixelBuffer } from '../lib/dither'
import { processBuffer } from '../lib/dither'
import type { WorkerIn, WorkerOut } from '../workers/dither.worker'

type Job = {
  id: number
  resolve: (v: { buffer: PixelBuffer; ms: number }) => void
  reject: (e: Error) => void
}

export function useDitherWorker() {
  const workerRef = useRef<Worker | null>(null)
  const jobs = useRef(new Map<number, Job>())
  const seq = useRef(0)

  useEffect(() => {
    try {
      const w = new Worker(new URL('../workers/dither.worker.ts', import.meta.url), {
        type: 'module',
      })
      w.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const job = jobs.current.get(ev.data.id)
        if (!job) return
        jobs.current.delete(ev.data.id)
        if (ev.data.error) {
          job.reject(new Error(ev.data.error))
          return
        }
        job.resolve({
          buffer: {
            width: ev.data.width,
            height: ev.data.height,
            data: new Uint8ClampedArray(ev.data.data),
          },
          ms: ev.data.ms,
        })
      }
      workerRef.current = w
    } catch {
      workerRef.current = null
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
      jobs.current.clear()
    }
  }, [])

  const run = useCallback(
    async (
      source: PixelBuffer,
      opts: {
        dither: Partial<DitherOptions>
        pixelSize: number
        maxDim: number
        exportScale: number
      },
    ) => {
      const id = ++seq.current
      const w = workerRef.current
      if (!w) {
        const started = performance.now()
        const buffer = processBuffer(source, opts)
        return { buffer, ms: Math.round(performance.now() - started) }
      }

      return new Promise<{ buffer: PixelBuffer; ms: number }>((resolve, reject) => {
        jobs.current.set(id, { id, resolve, reject })
        const copy = source.data.buffer.slice(
          source.data.byteOffset,
          source.data.byteOffset + source.data.byteLength,
        ) as ArrayBuffer
        const msg: WorkerIn = {
          id,
          width: source.width,
          height: source.height,
          data: copy,
          dither: opts.dither,
          pixelSize: opts.pixelSize,
          maxDim: opts.maxDim,
          exportScale: opts.exportScale,
        }
        w.postMessage(msg, [copy])
      })
    },
    [],
  )

  return { run }
}
