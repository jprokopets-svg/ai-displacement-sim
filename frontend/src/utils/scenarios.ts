/**
 * Client-side scenario modifiers.
 *
 * The backend serves base county scores (computed for year=2025, current tariffs).
 * This module applies scenario adjustments in real-time as the user changes
 * control panel settings, avoiding round-trips to the server.
 *
 * Modifiers are multiplicative: adjusted_score = base_score * modifier
 * Then re-percentiled across all counties.
 */

import type { ScenarioState } from '../components/ControlPanel'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
  is_estimated?: boolean
}

/**
 * Trade policy modifiers by county characteristics.
 * Manufacturing-heavy counties are more affected by tariff changes.
 */
function tradePolicyModifier(score: number, _county: CountyScore, policy: string): number {
  // Without per-county manufacturing data on the client, we use score-based heuristics:
  // Mid-range scores (0.3-0.5) are typically manufacturing/physical — most affected by trade
  // High scores (0.6+) are typically knowledge work — less affected by tariffs
  const isMfgLikely = score > 0.3 && score < 0.55

  switch (policy) {
    case 'escalating_tariffs':
      // Robotics acceleration: manufacturing counties get redder
      return isMfgLikely ? 1.12 : 1.03
    case 'free_trade':
      // Offshoring acceleration: knowledge workers get redder, manufacturing eases
      return isMfgLikely ? 0.95 : 1.06
    default:
      return 1.0
  }
}

/**
 * Year-based modifier: scores generally increase with time as AI capabilities grow.
 */
function yearModifier(score: number, year: number): number {
  if (year <= 2025) return 1.0

  // Agentic AI ramp: knowledge workers (high score) accelerate after 2026
  const agenticRamp = year > 2026 ? Math.min(1, (year - 2026) / 4) : 0
  const highScoreBoost = score > 0.5 ? agenticRamp * 0.15 : 0

  // Robotics ramp: mid-score occupations accelerate
  const roboticsRamp = Math.min(1, (year - 2025) / 10)
  const midScoreBoost = (score > 0.3 && score < 0.55) ? roboticsRamp * 0.10 : 0

  // General time progression
  const timeBoost = (year - 2025) * 0.005

  return 1.0 + timeBoost + highScoreBoost + midScoreBoost
}

/**
 * Corporate profit scenario modifier.
 */
function corporateProfitModifier(profit: string): number {
  switch (profit) {
    case 'surge':
      return 0.95  // Profit surge slightly reduces displacement (more adaptation budget)
    case 'decline':
      return 1.08  // Profit decline accelerates cost-cutting automation
    default:
      return 1.0
  }
}

/**
 * AI equity loop modifier.
 */
function equityLoopModifier(loop: string, year: number): number {
  if (loop === 'intact' || year <= 2027) return 1.0
  // Loop break: GDP drag increases displacement pressure over time
  const timeIntensity = Math.min(1, (year - 2027) / 8)
  return 1.0 + 0.10 * timeIntensity  // Up to +10% displacement
}

/**
 * Government response modifier.
 */
function govtResponseModifier(response: string, year: number): number {
  if (response === 'none') return 1.0
  // Policy takes 1-2 years to implement
  const ramp = year >= 2027 ? Math.min(1, (year - 2025) / 3) : 0
  switch (response) {
    case 'retraining':
      return 1.0 - 0.08 * ramp  // Up to -8% displacement
    case 'ubi':
      return 1.0 - 0.03 * ramp  // UBI preserves spending but doesn't reduce displacement much
    default:
      return 1.0
  }
}

/**
 * Fed response modifier.
 */
function fedResponseModifier(fed: string, year: number): number {
  if (fed === 'hold') return 1.0
  const ramp = Math.min(1, Math.max(0, (year - 2026) / 3))
  switch (fed) {
    case 'cut':
      return 1.0 - 0.02 * ramp  // Slight GDP boost reduces displacement pressure
    case 'zero':
      return 1.0 - 0.04 * ramp  // Stronger boost
    default:
      return 1.0
  }
}

/**
 * Apply all scenario modifiers to a set of county scores.
 * Returns new array with adjusted scores and re-computed percentiles.
 */
export function applyScenarioModifiers(
  counties: CountyScore[],
  scenario: ScenarioState,
): CountyScore[] {
  if (!counties.length) return counties

  // Apply modifiers to each county
  const adjusted = counties.map(county => {
    const base = county.ai_exposure_score

    let modifier = 1.0
    modifier *= yearModifier(base, scenario.year)
    modifier *= tradePolicyModifier(base, county, scenario.tradePolicy)
    modifier *= corporateProfitModifier(scenario.corporateProfit)
    modifier *= equityLoopModifier(scenario.equityLoop, scenario.year)
    modifier *= govtResponseModifier(scenario.govtResponse, scenario.year)
    modifier *= fedResponseModifier(scenario.fedResponse, scenario.year)

    const adjustedScore = Math.min(1, Math.max(0, base * modifier))

    return {
      ...county,
      ai_exposure_score: adjustedScore,
    }
  })

  // Re-compute percentiles on adjusted scores
  const scores = adjusted.map(c => c.ai_exposure_score).sort((a, b) => a - b)
  const n = scores.length

  return adjusted.map(county => {
    const rank = scores.filter(s => s <= county.ai_exposure_score).length
    return {
      ...county,
      exposure_percentile: Math.round((rank / n) * 1000) / 10,
    }
  })
}
