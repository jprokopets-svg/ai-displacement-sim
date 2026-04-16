/**
 * Monte Carlo model for displacement trajectories.
 *
 * Pure, deterministic given params + seed: each parameter controls a specific
 * aspect of the S-curve adoption, agentic emergence, policy response, or
 * feedback cascade. Runs entirely client-side so parameter changes feel
 * instantaneous — no backend roundtrip.
 */

export type GovtResponse = 'none' | 'retraining' | 'ubi'
export type FedResponse = 'hold' | 'cut' | 'zero'
export type CorporateProfit = 'baseline' | 'surge' | 'decline'

export interface SimParams {
  aiAdoptionPace: number         // 0-100: 0 = 20y S-curve, 100 = 5y S-curve
  agenticYear: number            // 2026-2032: year agentic AI mainstreams
  corporateProfit: CorporateProfit
  wealthConcentration: number    // 0-100: GDP buffer effect
  businessPressure: number       // 0-100: competitive automation pressure
  govtResponse: GovtResponse
  ubiYear: number                // 2027-2038: when UBI kicks in (if ubi)
  fedResponse: FedResponse
  feedbackAggressiveness: number // 0-100: self-reinforcing cascade strength
  stabilityThreshold: number     // 5-20: % unemployment triggering instability
}

export const DEFAULT_PARAMS: SimParams = {
  aiAdoptionPace: 55,
  agenticYear: 2028,
  corporateProfit: 'baseline',
  wealthConcentration: 35,
  businessPressure: 55,
  govtResponse: 'none',
  ubiYear: 2030,
  fedResponse: 'hold',
  feedbackAggressiveness: 40,
  stabilityThreshold: 12,
}

export const YEAR_START = 2025
export const YEAR_END = 2040
export const N_YEARS = YEAR_END - YEAR_START + 1   // 16
export const N_SIMS = 50_000

/** Mulberry32 — tiny fast seedable PRNG. */
function mulberry32(a: number): () => number {
  return function () {
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller on a seeded uniform. */
function makeRandn(rng: () => number): () => number {
  let spare: number | null = null
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v }
    let u1 = 0, u2 = 0
    while (u1 === 0) u1 = rng()
    while (u2 === 0) u2 = rng()
    const mag = Math.sqrt(-2 * Math.log(u1))
    const a = mag * Math.cos(2 * Math.PI * u2)
    spare = mag * Math.sin(2 * Math.PI * u2)
    return a
  }
}

export interface SimulationResult {
  /** Flat Float32Array of all paths: row-major, N_SIMS rows × N_YEARS cols. */
  paths: Float32Array
  /** For each year: [p05, p25, p50, p75, p95]. */
  percentiles: { p05: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[]; mean: number[] }
  /** Bucket distribution at the final year (2040). */
  bucketProbs: {
    minimal: number    // <10%
    gradual: number    // 10-25%
    significant: number // 25-40%
    mass: number       // 40-60%
    instability: number // >60%
  }
  /** Median year (per-sim) where path first crosses the stability threshold. */
  yearsToThresholdMedian: number | null
  /** Median final-year displacement %. */
  medianFinal: number
  /** 90th percentile final-year displacement %. */
  p90Final: number
  /** Formulas + assumption snapshots, for the assumptions panel. */
  assumptions: Array<{ label: string; expr: string }>
}

/**
 * Run the full Monte Carlo. Returns flat buffers + aggregate statistics.
 */
export function runMonteCarlo(p: SimParams, seed = 20260101): SimulationResult {
  const rng = mulberry32(seed)
  const randn = makeRandn(rng)

  const paths = new Float32Array(N_SIMS * N_YEARS)

  // Translate params into model coefficients.
  // S-curve — adoption pace controls midpoint and steepness.
  const curveMid = 2030 + (1 - p.aiAdoptionPace / 100) * 5  // 2030-2035
  const curveSteepness = 0.5 + (p.aiAdoptionPace / 100) * 1.1  // shallower → steeper
  const pressureMult = 1 + (p.businessPressure / 100 - 0.5) * 0.45
  const wealthEffect = (p.wealthConcentration / 100 - 0.3) * 0.10
  const profitMod = p.corporateProfit === 'surge' ? 0.90
    : p.corporateProfit === 'decline' ? 1.18 : 1.0
  const fedOffset = p.fedResponse === 'cut' ? -0.025
    : p.fedResponse === 'zero' ? 0.055 : 0

  // Run every simulation.
  const instabilityFirstYear: number[] = []
  const thresholdFrac = p.stabilityThreshold / 100

  for (let s = 0; s < N_SIMS; s++) {
    // Per-sim random offsets — creates the fiber-bundle spread.
    const adoptionOffset = randn() * 1.2
    const feedbackNoise = randn() * 0.22
    const hadShock = rng() < 0.12
    const shockMagnitude = hadShock ? Math.abs(randn()) * 0.18 : 0
    const shockYear = hadShock ? 2027 + Math.floor(rng() * 10) : -1
    let firstCrossed = -1

    for (let i = 0; i < N_YEARS; i++) {
      const year = YEAR_START + i
      const t = year - YEAR_START

      // S-curve adoption
      const logistic = 1 / (1 + Math.exp(-(year - curveMid - adoptionOffset) * curveSteepness))

      // Agentic emergence boost
      const agentic = year >= p.agenticYear ? Math.min(0.35, (year - p.agenticYear) * 0.065) : 0

      // Base displacement
      let disp = logistic * 0.75 * pressureMult * profitMod + agentic + wealthEffect

      // Government response damping
      if (p.govtResponse === 'retraining' && year > 2026) {
        disp -= Math.min(0.16, (year - 2026) * 0.025)
      } else if (p.govtResponse === 'ubi' && year >= p.ubiYear) {
        disp -= Math.min(0.28, (year - p.ubiYear + 1) * 0.045)
      }

      // Fed offset
      disp += fedOffset * Math.min(1, t / 3)

      // Feedback cascade — ramps post-2026
      if (year > 2026) {
        const ramp = Math.min(1, (year - 2026) / 5)
        disp += (p.feedbackAggressiveness / 100) * 0.40 * ramp * (1 + feedbackNoise)
      }

      // Rare shock
      if (hadShock && year >= shockYear) {
        disp += shockMagnitude * Math.min(1, (year - shockYear + 1) / 2)
      }

      // Year-to-year noise
      disp += randn() * 0.025

      // Clamp
      if (disp < 0) disp = 0
      if (disp > 1) disp = 1

      paths[s * N_YEARS + i] = disp

      if (firstCrossed < 0 && disp >= thresholdFrac) firstCrossed = year
    }

    if (firstCrossed > 0) instabilityFirstYear.push(firstCrossed)
  }

  // Percentiles per year — sort one column at a time.
  const p05: number[] = [], p25: number[] = [], p50: number[] = [],
    p75: number[] = [], p95: number[] = [], mean: number[] = []
  const colBuf = new Float64Array(N_SIMS)
  for (let i = 0; i < N_YEARS; i++) {
    let sum = 0
    for (let s = 0; s < N_SIMS; s++) {
      const v = paths[s * N_YEARS + i]
      colBuf[s] = v
      sum += v
    }
    mean.push(sum / N_SIMS)
    // Array.prototype.sort on a typed-array copy
    const sorted = Array.from(colBuf).sort((a, b) => a - b)
    p05.push(sorted[Math.floor(0.05 * N_SIMS)])
    p25.push(sorted[Math.floor(0.25 * N_SIMS)])
    p50.push(sorted[Math.floor(0.50 * N_SIMS)])
    p75.push(sorted[Math.floor(0.75 * N_SIMS)])
    p95.push(sorted[Math.floor(0.95 * N_SIMS)])
  }

  // Outcome bucket probabilities at final year.
  const finalIdx = N_YEARS - 1
  let minimal = 0, gradual = 0, significant = 0, mass = 0, instability = 0
  for (let s = 0; s < N_SIMS; s++) {
    const v = paths[s * N_YEARS + finalIdx]
    if (v < 0.10) minimal++
    else if (v < 0.25) gradual++
    else if (v < 0.40) significant++
    else if (v < 0.60) mass++
    else instability++
  }
  const bucketProbs = {
    minimal: minimal / N_SIMS,
    gradual: gradual / N_SIMS,
    significant: significant / N_SIMS,
    mass: mass / N_SIMS,
    instability: instability / N_SIMS,
  }

  // Years-to-threshold median
  let yearsToThresholdMedian: number | null = null
  if (instabilityFirstYear.length >= N_SIMS * 0.5) {
    const sorted = instabilityFirstYear.slice().sort((a, b) => a - b)
    yearsToThresholdMedian = sorted[Math.floor(sorted.length / 2)] - YEAR_START
  }

  // Assumptions snapshot — for the collapsible panel.
  const assumptions: Array<{ label: string; expr: string }> = [
    { label: 'S-curve midpoint', expr: `2030 + (1 − ${p.aiAdoptionPace / 100}) × 5 = ${curveMid.toFixed(2)}` },
    { label: 'S-curve steepness', expr: `0.5 + ${p.aiAdoptionPace / 100} × 1.1 = ${curveSteepness.toFixed(2)}` },
    { label: 'Business-pressure multiplier', expr: `1 + (${p.businessPressure / 100} − 0.5) × 0.45 = ${pressureMult.toFixed(3)}` },
    { label: 'Corporate-profit modifier', expr: `${profitMod.toFixed(2)}× (${p.corporateProfit})` },
    { label: 'Wealth-concentration effect', expr: `(${p.wealthConcentration / 100} − 0.3) × 0.10 = ${wealthEffect.toFixed(3)}` },
    { label: 'Agentic ramp', expr: `from ${p.agenticYear}, max +0.35 over 5.4y` },
    {
      label: 'Govt response',
      expr: p.govtResponse === 'retraining'
        ? 'from 2027: −min(0.16, (y−2026)·0.025)'
        : p.govtResponse === 'ubi'
          ? `from ${p.ubiYear}: −min(0.28, (y−${p.ubiYear}+1)·0.045)`
          : 'none',
    },
    { label: 'Fed response offset', expr: `${fedOffset >= 0 ? '+' : ''}${fedOffset.toFixed(3)} (${p.fedResponse})` },
    {
      label: 'Feedback cascade',
      expr: `(${p.feedbackAggressiveness / 100}) × 0.40 × min(1, (y−2026)/5), post-2026`,
    },
    { label: 'Shock process', expr: 'Bernoulli(0.12) per path, |Normal|·0.18, onset 2027–2036' },
    { label: 'Year-to-year noise', expr: 'Normal(0, 0.025) added each year' },
    { label: 'Stability threshold', expr: `${p.stabilityThreshold}% — marks the band where social instability begins` },
  ]

  return {
    paths,
    percentiles: { p05, p25, p50, p75, p95, mean },
    bucketProbs,
    yearsToThresholdMedian,
    medianFinal: p50[N_YEARS - 1],
    p90Final: p95[N_YEARS - 1], // displayed as "90th percentile scenario"
    assumptions,
  }
}
