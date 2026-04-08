import * as d3 from 'd3'

/**
 * Color scale for AI exposure using aggressive percentile breakpoints:
 *   Bottom 25% (p0-p25):    deep green → green
 *   25-50% (p25-p50):       green → yellow-green
 *   50-75% (p50-p75):       yellow → orange
 *   75-90% (p75-p90):       orange → red
 *   Top 10% (p90-p100):     red → deep red
 *
 * This ensures scenario modifiers visibly shift counties between color bands.
 */
export const exposureColorScale = d3.scaleLinear<string>()
  .domain([0, 25, 50, 75, 90, 100])
  .range(['#15803d', '#4ade80', '#eab308', '#f97316', '#ef4444', '#7f1d1d'])
  .clamp(true)

/**
 * Get color for a county by its exposure percentile (0-100).
 */
export function getExposureColor(percentile: number): string {
  return exposureColorScale(Math.max(0, Math.min(100, percentile)))
}

/**
 * Get color for an individual occupation's exposure score (0-1 range).
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
