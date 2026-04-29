import * as d3 from 'd3'

/**
 * Magma palette for exposure display.
 * Uses the 0.15–0.95 range of the magma scale so the low end
 * (visible mid-purple) doesn't blend into the dark theme background.
 */
const MAGMA_LO = 0.15
const MAGMA_HI = 0.95
const MAGMA_RANGE = MAGMA_HI - MAGMA_LO

/**
 * Get color for a county by its exposure percentile (0-100).
 * Maps percentile linearly into the magma(0.15)–magma(0.95) range.
 */
export function getExposureColor(percentile: number): string {
  const t = Math.max(0, Math.min(100, percentile)) / 100
  return d3.interpolateMagma(MAGMA_LO + t * MAGMA_RANGE)
}

/**
 * Pre-built CSS gradient string for legends.
 * Six evenly-spaced samples from the same 0.15–0.95 magma range.
 */
export const MAGMA_GRADIENT_CSS: string = (() => {
  const stops = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map(
    fraction => d3.interpolateMagma(MAGMA_LO + fraction * MAGMA_RANGE)
  )
  return `linear-gradient(to right, ${stops.join(', ')})`
})()

/**
 * Diverging color scale for scenario deltas.
 * Negative delta (cool/teal) → zero (neutral gray) → positive delta (warm/amber).
 * Domain: -1 to +1 (normalized by maxDelta).
 */
export const deltaColorScale = d3.scaleLinear<string>()
  .domain([-1, -0.5, 0, 0.5, 1])
  .range(['#0d9488', '#5eead4', '#d4d4d8', '#fbbf24', '#d97706'])
  .clamp(true)

// Counties with absolute delta below this threshold render as neutral gray.
// 0.005 = ~0.5 percentage-point shift — below the noise floor of
// the Bartik shift-share estimation.
const DELTA_DEAD_ZONE = 0.010

/**
 * Get color for a scenario delta value, scaled to ±maxDelta.
 * Deltas smaller than ±0.5pp render as neutral gray so the map
 * isn't uniformly teal/amber when most counties have near-zero shifts.
 */
export function getDeltaColor(delta: number, maxDelta: number): string {
  if (maxDelta <= DELTA_DEAD_ZONE) return '#d4d4d8'
  if (Math.abs(delta) < DELTA_DEAD_ZONE) return '#d4d4d8'
  // Normalize the portion beyond the dead zone into [-1, 1]
  const sign = delta < 0 ? -1 : 1
  const magnitude = Math.abs(delta) - DELTA_DEAD_ZONE
  const maxMagnitude = maxDelta - DELTA_DEAD_ZONE
  const normalized = sign * (magnitude / maxMagnitude)
  return deltaColorScale(normalized)
}

/**
 * Get color for an individual occupation's exposure score (0-1 range).
 */
export function getOccupationExposureColor(score: number): string {
  return getExposureColor(score * 100)
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
