/**
 * Visual uncertainty system for time-dependent projections.
 *
 * As the year slider moves forward, uncertainty increases:
 * - Map opacity decreases
 * - Hatch pattern density increases
 * - Confidence intervals widen
 * - Banners appear with appropriate warnings
 */

export interface UncertaintyState {
  year: number
  opacity: number          // 0-1 map color opacity
  hatchDensity: number     // 0-1 hatch overlay density
  confidencePct: number    // 0-100 confidence percentage
  ciMultiplier: number     // Confidence interval width multiplier
  band: 'near' | 'medium' | 'long' | 'speculative'
  bannerText: string | null
  bannerColor: string
}

export function getUncertaintyState(year: number): UncertaintyState {
  if (year <= 2027) {
    return {
      year,
      opacity: 1.0,
      hatchDensity: 0,
      confidencePct: 90,
      ciMultiplier: 1.0,
      band: 'near',
      bannerText: null,
      bannerColor: 'transparent',
    }
  }

  if (year <= 2030) {
    // Linear interpolation 2027-2030
    const t = (year - 2027) / 3
    return {
      year,
      opacity: 1.0 - t * 0.15,     // 100% → 85%
      hatchDensity: t * 0.3,         // 0% → 30%
      confidencePct: 90 - t * 20,    // 90% → 70%
      ciMultiplier: 1.0 + t * 0.8,   // 1.0x → 1.8x
      band: 'medium',
      bannerText: 'Medium-term projections — confidence intervals widening',
      bannerColor: '#2a4a6a',
    }
  }

  if (year <= 2035) {
    const t = (year - 2030) / 5
    return {
      year,
      opacity: 0.85 - t * 0.15,     // 85% → 70%
      hatchDensity: 0.3 + t * 0.3,   // 30% → 60%
      confidencePct: 70 - t * 20,    // 70% → 50%
      ciMultiplier: 1.8 + t * 1.2,   // 1.8x → 3.0x
      band: 'long',
      bannerText: 'Long-term projections — treat as directional scenarios, not point predictions',
      bannerColor: '#4a3a1a',
    }
  }

  // 2035-2040: speculative
  const t = Math.min(1, (year - 2035) / 5)
  return {
    year,
    opacity: 0.70 - t * 0.20,       // 70% → 50%
    hatchDensity: 0.6 + t * 0.3,     // 60% → 90%
    confidencePct: 50 - t * 20,      // 50% → 30%
    ciMultiplier: 3.0 + t * 2.0,     // 3.0x → 5.0x
    band: 'speculative',
    bannerText: 'Speculative horizon — high uncertainty. These are scenario explorations, not forecasts',
    bannerColor: '#5a2a1a',
  }
}

/**
 * Get hatch pattern SVG definition for the given density.
 */
export function getHatchPatternDef(density: number): string {
  if (density <= 0) return ''

  const spacing = Math.max(3, Math.round(20 - density * 17))  // 20px → 3px
  const strokeWidth = 0.5 + density * 1.0  // 0.5 → 1.5
  const opacity = Math.min(0.5, density * 0.5)

  return `
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="${spacing}" height="${spacing}"
             patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="${spacing}"
            stroke="rgba(0,0,0,${opacity})" stroke-width="${strokeWidth}" />
    </pattern>
  `
}

/**
 * Band label and color for display.
 */
export const BAND_LABELS = {
  near: { label: 'Near-term (evidence-based)', color: '#4aff8a' },
  medium: { label: 'Medium-term', color: '#4a9eff' },
  long: { label: 'Long-term (directional)', color: '#ffa84a' },
  speculative: { label: 'Speculative', color: '#ff4a4a' },
}
