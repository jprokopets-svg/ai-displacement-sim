/**
 * Bucket (quartile) labels, colors, and helpers for dual presentation mode.
 */

export type DisplayMode = 'bucket' | 'continuous'

export const BUCKET_LABELS: Record<number, string> = {
  1: 'Lower',
  2: 'Lower-mid',
  3: 'Upper-mid',
  4: 'Higher',
}

// Magma palette sampled at quartile midpoints within 0.15–0.95 range.
// Hardcoded to avoid Vite production bundling order issue with top-level
// d3.interpolateMagma() calls. Values verified via Playwright against
// d3.interpolateMagma(0.25), (0.45), (0.65), (0.85).
export const BUCKET_COLORS: Record<number, string> = {
  1: '#51127c',  // magma(0.25)
  2: '#a1307e',  // magma(0.45)
  3: '#ed5a5f',  // magma(0.65)
  4: '#feb77e',  // magma(0.85)
}

export function bucketLabel(bucket: number | undefined): string {
  if (!bucket) return ''
  return BUCKET_LABELS[bucket] ?? ''
}

export function bucketColor(bucket: number | undefined): string {
  if (!bucket) return '#1a1a25'
  return BUCKET_COLORS[bucket] ?? '#1a1a25'
}

export function formatExposureWhole(score: number): string {
  return `${Math.round(score * 100)}%`
}

/** Read display mode from localStorage, defaulting to bucket. */
export function getStoredDisplayMode(): DisplayMode {
  if (typeof localStorage === 'undefined') return 'bucket'
  const stored = localStorage.getItem('displayMode')
  if (stored === 'continuous') return 'continuous'
  return 'bucket'
}

/** Persist display mode to localStorage. */
export function setStoredDisplayMode(mode: DisplayMode): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('displayMode', mode)
  }
}
