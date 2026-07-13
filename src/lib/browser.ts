import type { PixelBuffer } from './dither'
import { createPixelBuffer } from './dither'

/** Canvas downsample for browser (better quality than pure box when available). */
export function prepareSource(
  source: HTMLImageElement | ImageBitmap,
  maxDim: number,
  pixelSize: number,
): PixelBuffer {
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height

  let tw = sw
  let th = sh
  if (Math.max(sw, sh) > maxDim) {
    const r = maxDim / Math.max(sw, sh)
    tw = Math.max(1, Math.round(sw * r))
    th = Math.max(1, Math.round(sh * r))
  }

  const ps = Math.max(1, Math.round(pixelSize))
  const ww = Math.max(1, Math.round(tw / ps))
  const wh = Math.max(1, Math.round(th / ps))

  const canvas = document.createElement('canvas')
  canvas.width = ww
  canvas.height = wh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, ww, wh)
  const imageData = ctx.getImageData(0, 0, ww, wh)
  return createPixelBuffer(ww, wh, imageData.data)
}

export function pixelBufferToImageData(buffer: PixelBuffer): ImageData {
  return new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height)
}

export function imageDataToBlob(buffer: PixelBuffer, type = 'image/png'): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = buffer.width
  canvas.height = buffer.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(pixelBufferToImageData(buffer), 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type)
  })
}
