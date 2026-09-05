/**
 * Exposure buckets: labels, colors, and plain-language descriptions.
 *
 * County buckets (1-4) come from the API - quartiles of the county score
 * distribution. Occupation buckets are quartiles of the 0-1 score itself,
 * since a single occupation has no distribution to sit in.
 */

export const BUCKET_LABELS: Record<number, string> = {
  1: 'Lower',
  2: 'Lower-mid',
  3: 'Upper-mid',
  4: 'Higher',
}

// Simple sequential blues, light to dark. Readable on white.
export const BUCKET_COLORS: Record<number, string> = {
  1: '#dbe9f6',
  2: '#a4c8e4',
  3: '#5b9bd0',
  4: '#1f5b96',
}

// Counties with no row in the API response.
export const NO_DATA_COLOR = '#eeeeee'

export function bucketLabel(bucket: number | undefined): string {
  return bucket ? BUCKET_LABELS[bucket] ?? '' : ''
}

export function bucketColor(bucket: number | undefined): string {
  return bucket ? BUCKET_COLORS[bucket] ?? NO_DATA_COLOR : NO_DATA_COLOR
}

/** Bucket an occupation by its own 0-1 exposure score. */
export function occupationBucket(score: number): number {
  if (score < 0.25) return 1
  if (score < 0.5) return 2
  if (score < 0.75) return 3
  return 4
}

/** One plain-language line describing an occupation's bucket. */
export const BUCKET_BLURBS: Record<number, string> = {
  1: "Few of this job's tasks are ones current language models can do.",
  2: "Some of this job's tasks are ones current language models can do.",
  3: "Many of this job's tasks are ones current language models can do.",
  4: "Most of this job's tasks are ones current language models can do.",
}

/** Format an exposure score (0-1) as a whole percentage. */
export function formatExposure(score: number): string {
  return `${Math.round(score * 100)}%`
}
