/**
 * Bucket (quartile) labels, colors, and helpers for dual presentation mode.
 */
import * as d3 from 'd3'

export type DisplayMode = 'bucket' | 'continuous'

export const BUCKET_LABELS: Record<number, string> = {
  1: 'Lower',
  2: 'Lower-mid',
  3: 'Upper-mid',
  4: 'Higher',
}

// Magma palette sampled at quartile midpoints within 0.15–0.95 range.
// Q1 midpoint=12.5% → magma(0.25), Q2=37.5% → magma(0.45), etc.
export const BUCKET_COLORS: Record<number, string> = {
  1: d3.interpolateMagma(0.25),
  2: d3.interpolateMagma(0.45),
  3: d3.interpolateMagma(0.65),
  4: d3.interpolateMagma(0.85),
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
