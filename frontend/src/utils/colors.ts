import * as d3 from 'd3'

/**
 * Color scale for AI exposure using percentile breakpoints:
 *   Bottom 40% (p0-p40):   green shades
 *   Middle 40% (p40-p80):  yellow to orange
 *   Top 20% (p80-p100):    orange to deep red
 *
 * This ensures readable contrast — not everything appears red.
 */
export const exposureColorScale = d3.scaleLinear<string>()
  .domain([0, 20, 40, 60, 80, 90, 100])
  .range(['#15803d', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#991b1b'])
  .clamp(true)

/**
 * Get color for a county by its exposure percentile (0-100).
 */
export function getExposureColor(percentile: number): string {
  return exposureColorScale(Math.max(0, Math.min(100, percentile)))
}

/**
 * Get color for an individual occupation's exposure score (0-1 range).
 * Maps the 0-1 score to the same percentile color scale.
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
