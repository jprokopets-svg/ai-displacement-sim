import * as d3 from 'd3'

/**
 * Perceptually uniform color scale with extra separation at the top 25%.
 *
 *   p0-p25:    green → yellow-green
 *   p25-p50:   yellow-green → yellow
 *   p50-p75:   yellow → orange
 *   p75-p90:   orange → red
 *   p90-p97:   red → deep red
 *   p97-p100:  deep red → near-black dark red
 *
 * Three distinct steps in the top 10% so high, very-high, and extreme
 * counties are visually distinguishable.
 */
export const exposureColorScale = d3.scaleLinear<string>()
  .domain([0, 25, 50, 75, 90, 97, 100])
  .range(['#2ecc71', '#a3d977', '#f1c40f', '#e67e22', '#e74c3c', '#c0392b', '#7b241c'])
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
