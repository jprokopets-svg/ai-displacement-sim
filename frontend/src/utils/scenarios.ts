/**
 * Client-side scenario modifiers.
 *
 * The backend serves base county scores (computed for year=2025, current tariffs).
 * This module applies scenario adjustments in real-time as the user changes
 * control panel settings.
 *
 * Modifiers are multiplicative and LARGE ENOUGH to visibly shift map colors.
 * A 25% modifier should move a county across at least one color band.
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
 * Trade policy modifier.
 * Manufacturing counties (mid-range scores) are most affected by tariff changes.
 * Knowledge counties (high scores) are most affected by free trade.
 */
function tradePolicyModifier(score: number, policy: string): number {
  const isMfgLikely = score > 0.25 && score < 0.55
  const isKnowledgeLikely = score > 0.55

  switch (policy) {
    case 'escalating_tariffs':
      // Robotics acceleration in manufacturing + general automation pressure
      return isMfgLikely ? 1.25 : 1.08
    case 'free_trade':
      // Offshoring acceleration for knowledge workers
      return isKnowledgeLikely ? 1.20 : (isMfgLikely ? 0.90 : 1.05)
    default:
      return 1.0
  }
}

/**
 * Year modifier: scores increase as AI capabilities expand.
 */
function yearModifier(score: number, year: number): number {
  if (year <= 2025) return 1.0

  const yearsOut = year - 2025

  // Agentic AI ramp for knowledge workers (post-2026)
  const agenticRamp = year > 2026 ? Math.min(1, (year - 2026) / 4) : 0
  const highScoreBoost = score > 0.5 ? agenticRamp * 0.25 : 0

  // Robotics ramp for physical occupations
  const roboticsRamp = Math.min(1, yearsOut / 10)
  const midScoreBoost = (score > 0.25 && score < 0.55) ? roboticsRamp * 0.20 : 0

  // General time progression
  const timeBoost = yearsOut * 0.008

  return 1.0 + timeBoost + highScoreBoost + midScoreBoost
}

/**
 * Corporate profit scenario.
 */
function corporateProfitModifier(profit: string): number {
  switch (profit) {
    case 'surge':
      return 0.85  // -15%: profit surge funds adaptation, reduces displacement pressure
    case 'decline':
      return 1.20  // +20%: profit decline accelerates cost-cutting automation
    default:
      return 1.0
  }
}

/**
 * AI equity loop.
 */
function equityLoopModifier(loop: string, year: number): number {
  if (loop === 'intact' || year <= 2027) return 1.0
  const timeIntensity = Math.min(1, (year - 2027) / 6)
  return 1.0 + 0.25 * timeIntensity  // Up to +25%
}

/**
 * Government response.
 */
function govtResponseModifier(response: string, year: number): number {
  if (response === 'none') return 1.0
  const ramp = year >= 2027 ? Math.min(1, (year - 2025) / 3) : 0
  switch (response) {
    case 'retraining':
      return 1.0 - 0.12 * ramp  // Up to -12%
    case 'ubi':
      return 1.0 - 0.20 * ramp  // Up to -20%: UBI preserves spending, slows cascade
    default:
      return 1.0
  }
}

/**
 * Fed response.
 */
function fedResponseModifier(fed: string, year: number): number {
  if (fed === 'hold') return 1.0
  const ramp = Math.min(1, Math.max(0, (year - 2026) / 3))
  switch (fed) {
    case 'cut':
      return 1.0 - 0.05 * ramp
    case 'zero':
      // Zero rates: cheap capital accelerates automation investment
      return 1.0 + 0.15 * ramp  // +15%: more displacement, not less
    default:
      return 1.0
  }
}

/**
 * Apply all scenario modifiers and recompute percentiles.
 */
export function applyScenarioModifiers(
  counties: CountyScore[],
  scenario: ScenarioState,
): CountyScore[] {
  if (!counties.length) return counties

  const adjusted = counties.map(county => {
    const base = county.ai_exposure_score

    let modifier = 1.0
    modifier *= yearModifier(base, scenario.year)
    modifier *= tradePolicyModifier(base, scenario.tradePolicy)
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

  // Recompute percentiles
  const sorted = adjusted.map(c => c.ai_exposure_score).sort((a, b) => a - b)
  const n = sorted.length

  return adjusted.map(county => {
    const rank = sorted.filter(s => s <= county.ai_exposure_score).length
    return {
      ...county,
      exposure_percentile: Math.round((rank / n) * 1000) / 10,
    }
  })
}
