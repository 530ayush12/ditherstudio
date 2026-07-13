/**
 * DitherStudio library entry for Node and bundlers.
 *
 * @example
 * ```ts
 * import { ditherFile, ALGORITHMS } from 'ditherstudio'
 * await ditherFile('in.png', 'out.png', { algorithm: 'atkinson', threshold: 140 })
 * ```
 */
export {
  ALGORITHMS,
  ALGORITHM_IDS,
  DEFAULT_DITHER_OPTIONS,
  createPixelBuffer,
  dither,
  ditherImageData,
  downsampleBuffer,
  hexToRgb,
  isAlgorithmId,
  mergeDitherOptions,
  rgbToHex,
  upscaleNearest,
  type AlgorithmId,
  type AlgorithmMeta,
  type DitherOptions,
  type PixelBuffer,
} from './lib/dither.ts'

export {
  ditherBase64,
  ditherBuffer,
  ditherFile,
  type ProcessFileOptions,
  type ProcessResult,
} from './lib/node.ts'
