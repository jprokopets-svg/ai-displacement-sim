/**
 * Client-side scenario modifiers.
 *
 * CRITICAL DESIGN: Percentiles are computed from the BASELINE (unmodified)
 * score distribution. When modifiers are applied, the adjusted score is
 * placed into the baseline percentile scale. This means a +25% modifier
 * actually shifts a county into a higher percentile band because its
 * adjusted score exceeds the baseline thresholds.
 *
 * Previous bug: percentiles were recomputed from modified scores, which
 * preserved relative ranks and made all modifiers invisible on the map.
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

// Cached baseline percentile thresholds (computed once from unmodified data)
let baselineThresholds: number[] = []

function computeBaselineThresholds(counties: CountyScore[]) {
  const scores = counties.map(c => c.ai_exposure_score).sort((a, b) => a - b)
  // Store every percentile point (p0, p1, ..., p100)
  baselineThresholds = []
  for (let p = 0; p <= 100; p++) {
    const idx = Math.min(Math.floor((p / 100) * scores.length), scores.length - 1)
    baselineThresholds.push(scores[idx])
  }
}

function scoreToBaselinePercentile(score: number): number {
  if (baselineThresholds.length === 0) return 50
  // Binary search for where this score falls in the baseline distribution
  let lo = 0, hi = 100
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (baselineThresholds[mid] <= score) lo = mid
    else hi = mid - 1
  }
  return lo
}

function tradePolicyModifier(score: number, policy: string): number {
  const isMfgLikely = score > 0.25 && score < 0.55
  const isKnowledgeLikely = score > 0.55
  switch (policy) {
    case 'escalating_tariffs':
      return isMfgLikely ? 1.25 : 1.08
    case 'free_trade':
      return isKnowledgeLikely ? 1.20 : (isMfgLikely ? 0.90 : 1.05)
    default:
      return 1.0
  }
}

function yearModifier(score: number, year: number): number {
  if (year <= 2025) return 1.0
  const yearsOut = year - 2025
  const agenticRamp = year > 2026 ? Math.min(1, (year - 2026) / 4) : 0
  const highScoreBoost = score > 0.5 ? agenticRamp * 0.25 : 0
  const roboticsRamp = Math.min(1, yearsOut / 10)
  const midScoreBoost = (score > 0.25 && score < 0.55) ? roboticsRamp * 0.20 : 0
  const timeBoost = yearsOut * 0.008
  return 1.0 + timeBoost + highScoreBoost + midScoreBoost
}

function corporateProfitModifier(profit: string): number {
  switch (profit) {
    case 'surge': return 0.85
    case 'decline': return 1.20
    default: return 1.0
  }
}

function equityLoopModifier(loop: string, year: number): number {
  if (loop === 'intact' || year <= 2027) return 1.0
  const t = Math.min(1, (year - 2027) / 6)
  return 1.0 + 0.25 * t
}

function govtResponseModifier(response: string, year: number): number {
  if (response === 'none') return 1.0
  const ramp = year >= 2027 ? Math.min(1, (year - 2025) / 3) : 0
  switch (response) {
    case 'retraining': return 1.0 - 0.12 * ramp
    case 'ubi': return 1.0 - 0.20 * ramp
    default: return 1.0
  }
}

function fedResponseModifier(fed: string, year: number): number {
  if (fed === 'hold') return 1.0
  const ramp = Math.min(1, Math.max(0, (year - 2026) / 3))
  switch (fed) {
    case 'cut': return 1.0 - 0.05 * ramp
    case 'zero': return 1.0 + 0.15 * ramp
    default: return 1.0
  }
}

/**
 * Apply scenario modifiers and map adjusted scores to BASELINE percentiles.
 *
 * This is the key fix: percentiles come from the original unmodified distribution,
 * so a +25% modifier actually moves counties into higher percentile bands.
 */
export function applyScenarioModifiers(
  counties: CountyScore[],
  scenario: ScenarioState,
): CountyScore[] {
  if (!counties.length) return counties

  // Compute baseline thresholds once (from the original data at year=2025, no modifiers)
  if (baselineThresholds.length === 0) {
    computeBaselineThresholds(counties)
  }

  return counties.map(county => {
    const base = county.ai_exposure_score

    let modifier = 1.0
    modifier *= yearModifier(base, scenario.year)
    modifier *= tradePolicyModifier(base, scenario.tradePolicy)
    modifier *= corporateProfitModifier(scenario.corporateProfit)
    modifier *= equityLoopModifier(scenario.equityLoop, scenario.year)
    modifier *= govtResponseModifier(scenario.govtResponse, scenario.year)
    modifier *= fedResponseModifier(scenario.fedResponse, scenario.year)

    const adjustedScore = Math.min(1, Math.max(0, base * modifier))

    // Map adjusted score to the BASELINE percentile distribution
    // A +25% modifier pushes the score into a higher baseline percentile = different color
    const adjustedPercentile = scoreToBaselinePercentile(adjustedScore)

    return {
      ...county,
      ai_exposure_score: adjustedScore,
      exposure_percentile: adjustedPercentile,
    }
  })
}
