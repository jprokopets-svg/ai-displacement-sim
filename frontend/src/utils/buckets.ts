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

// Sequential 4-color scheme: cool → warm
export const BUCKET_COLORS: Record<number, string> = {
  1: '#2ecc71',  // green
  2: '#f1c40f',  // yellow
  3: '#e67e22',  // orange
  4: '#c0392b',  // red
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
