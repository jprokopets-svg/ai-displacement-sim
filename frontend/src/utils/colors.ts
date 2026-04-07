import * as d3 from 'd3'

/**
 * Color scale for AI exposure: green (low) → yellow (medium) → red (high).
 * Uses percentile (0-100) as input for even color distribution.
 */
export const exposureColorScale = d3.scaleSequential(
  d3.interpolateRgbBasis(['#22c55e', '#eab308', '#f97316', '#ef4444', '#991b1b'])
).domain([0, 100])

/**
 * Get color for a county by its exposure percentile (0-100).
 * Uses percentile-based coloring so the full green-to-red range is visible.
 */
export function getExposureColor(percentile: number): string {
  return exposureColorScale(Math.max(0, Math.min(100, percentile)))
}

/**
 * Get color for an individual occupation's exposure score (0-1 range).
 * Occupations have a wide score spread so linear mapping works.
 */
export function getOccupationExposureColor(score: number): string {
  return exposureColorScale(Math.max(0, Math.min(100, score * 100)))
}

/**
 * Format exposure score for display.
 */
export function formatExposure(score: number): string {
  return (score * 100).toFixed(1) + '%'
}

/**
 * Format large numbers with commas.
 */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString()
}

/**
 * Format currency.
 */
export function formatWage(wage: number): string {
  return '$' + Math.round(wage).toLocaleString()
}
