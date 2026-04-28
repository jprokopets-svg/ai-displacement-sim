import * as d3 from 'd3'

/**
 * Single-hue blue progression for continuous exposure display.
 * Light blue (low exposure) → dark blue (high exposure).
 * Not red/orange — high exposure means high LLM task overlap,
 * not "danger."
 */
export const exposureColorScale = d3.scaleLinear<string>()
  .domain([0, 25, 50, 75, 100])
  .range(['#eff6ff', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'])
  .clamp(true)

/**
 * Get color for a county by its exposure percentile (0-100).
 */
export function getExposureColor(percentile: number): string {
  return exposureColorScale(Math.max(0, Math.min(100, percentile)))
}

/**
 * Diverging color scale for scenario deltas.
 * Negative delta (cool/teal) → zero (neutral gray) → positive delta (warm/amber).
 * Domain: -maxDelta to +maxDelta, centered on 0.
 */
export const deltaColorScale = d3.scaleLinear<string>()
  .domain([-1, -0.5, 0, 0.5, 1])
  .range(['#0d9488', '#5eead4', '#d4d4d8', '#fbbf24', '#d97706'])
  .clamp(true)

/**
 * Get color for a scenario delta value, scaled to ±maxDelta.
 */
export function getDeltaColor(delta: number, maxDelta: number): string {
  if (maxDelta <= 0) return '#d4d4d8'
  const normalized = delta / maxDelta
  return deltaColorScale(normalized)
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
