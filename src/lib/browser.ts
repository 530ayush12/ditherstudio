import type { PixelBuffer } from './dither'
import { createPixelBuffer } from './dither'

export function prepareSource(
  source: HTMLImageElement | ImageBitmap,
  maxDim: number,
  pixelSize: number,
): PixelBuffer {
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height

  let tw = sw
  let th = sh
  // For worker path we often pass maxDim=0 and let processBuffer handle it.
  // Here: prepare at full res (capped lightly to avoid memory bombs in UI decode).
  const cap = maxDim > 0 ? maxDim : 4096
  if (Math.max(sw, sh) > cap) {
    const r = cap / Math.max(sw, sh)
    tw = Math.max(1, Math.round(sw * r))
    th = Math.max(1, Math.round(sh * r))
  }

  const ps = Math.max(1, Math.round(pixelSize))
  // When using processBuffer later, pass pixelSize=1 here and let processBuffer do chunk.
  // This helper draws at full prepared size.
  void ps
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, tw, th)
  const imageData = ctx.getImageData(0, 0, tw, th)
  return createPixelBuffer(tw, th, imageData.data)
}

export function imageElementToBuffer(img: HTMLImageElement, maxEdge = 4096): PixelBuffer {
  return prepareSource(img, maxEdge, 1)
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

export function bufferToObjectUrl(buffer: PixelBuffer): Promise<string> {
  return imageDataToBlob(buffer).then((blob) => URL.createObjectURL(blob))
}
