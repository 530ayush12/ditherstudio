import {
  type DitherOptions,
  type PixelBuffer,
  processBuffer,
} from '../lib/dither'

export type WorkerIn = {
  id: number
  width: number
  height: number
  /** Transferable ArrayBuffer of RGBA */
  data: ArrayBuffer
  dither: Partial<DitherOptions>
  pixelSize: number
  maxDim: number
  exportScale: number
}

export type WorkerOut = {
  id: number
  width: number
  height: number
  data: ArrayBuffer
  ms: number
  error?: string
}

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data
  const started = performance.now()
  try {
    const source: PixelBuffer = {
      width: msg.width,
      height: msg.height,
      data: new Uint8ClampedArray(msg.data),
    }
    const result = processBuffer(source, {
      dither: msg.dither,
      pixelSize: msg.pixelSize,
      maxDim: msg.maxDim,
      exportScale: msg.exportScale,
    })
    const out: WorkerOut = {
      id: msg.id,
      width: result.width,
      height: result.height,
      data: result.data.buffer.slice(
        result.data.byteOffset,
        result.data.byteOffset + result.data.byteLength,
      ) as ArrayBuffer,
      ms: Math.round(performance.now() - started),
    }
    ;(self as unknown as Worker).postMessage(out, [out.data])
  } catch (err) {
    const out: WorkerOut = {
      id: msg.id,
      width: 0,
      height: 0,
      data: new ArrayBuffer(0),
      ms: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    }
    ;(self as unknown as Worker).postMessage(out)
  }
}
