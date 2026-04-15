import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { getExposureColor, formatExposure, formatNumber } from '../utils/colors'

interface CountryOccupation {
  name: string
  share: number
  ai_exposure: number
}

interface CountryScore {
  iso3: string
  numeric_id: string
  name: string
  ai_exposure_score: number | null
  total_employment: number
  exposure_percentile: number | null
  data_tier: 'tier1' | 'tier2' | 'tier3'
  source: string
  year: number | null
  top_occupations: CountryOccupation[]
}

interface ScenarioState {
  year: number
  feedbackAggressiveness: number
  tradePolicy: string
  govtResponse: string
  corporateProfit: string
  equityLoop: string
  fedResponse: string
}

interface WorldMapProps {
  countries: CountryScore[]
  scenario?: ScenarioState
}

const WORLD_TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface TooltipState {
  visible: boolean
  x: number
  y: number
  data: CountryScore | null
}

const TIER_LABELS = {
  tier1: 'OECD occupation data',
  tier2: 'Estimated -- based on labor sector composition',
  tier3: 'Insufficient data',
}

function scoreToPercentile(score: number, sorted: number[]): number {
  if (sorted.length === 0) return 50
  let lo = 0, hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= score) lo = mid + 1
    else hi = mid
  }
  return (lo / sorted.length) * 100
}

export default function WorldMap({ countries, scenario }: WorldMapProps) {
  const year = scenario?.year ?? 2025
  const tradePolicy = scenario?.tradePolicy ?? 'current'
  const feedbackAgg = scenario?.feedbackAggressiveness ?? 0.5
  const corporateProfit = scenario?.corporateProfit ?? 'baseline'
  const equityLoop = scenario?.equityLoop ?? 'intact'
  const govtResponse = scenario?.govtResponse ?? 'none'
  const fedResponse = scenario?.fedResponse ?? 'hold'
  const svgRef = useRef<SVGSVGElement>(null)
  const [topoData, setTopoData] = useState<Topology | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, data: null,
  })
  const [selectedCountry, setSelectedCountry] = useState<CountryScore | null>(null)

  // Apply scenario modifiers to every scored country, then rank all adjusted
  // scores and assign each country a percentile within that post-modifier
  // distribution. Ranking every render (rather than against a frozen baseline)
  // guarantees that any scenario change produces a visible reshuffling of
  // colors — which is what the user expects from dragging sliders.
  const countryByNumeric = new Map<string, CountryScore>()
  const adjusted: Array<{ c: CountryScore; score: number }> = []

  for (const c of countries) {
    if (!c.numeric_id) continue
    if (c.ai_exposure_score === null) {
      countryByNumeric.set(c.numeric_id, c)
      continue
    }

    const base = c.ai_exposure_score
    let mod = 1.0

    // Time. Baseline growth per year + agentic ramp for knowledge-heavy
    // countries (high base scores) kicking in post-2026. Stronger magnitudes
    // than before so dragging from 2025 → 2040 produces clearly different
    // maps, not just subtle shading shifts.
    if (year > 2025) {
      const yearsOut = year - 2025
      const agenticRamp = year > 2026 ? Math.min(1, (year - 2026) / 3) : 0
      mod *= 1.0 + yearsOut * 0.020 + (base > 0.40 ? agenticRamp * 0.35 : agenticRamp * 0.10)
    }

    // Trade policy. Escalating tariffs hit manufacturing-heavy (low-score)
    // countries harder via reshoring + robotics; free trade intensifies
    // offshoring pressure on knowledge-heavy economies.
    if (tradePolicy === 'escalating_tariffs') mod *= base < 0.45 ? 1.35 : 1.08
    else if (tradePolicy === 'free_trade') mod *= base > 0.45 ? 1.25 : 0.88

    // Corporate profit regime — global sentiment effect.
    if (corporateProfit === 'surge') mod *= 0.82
    else if (corporateProfit === 'decline') mod *= 1.28

    // AI equity loop break cascades after 2027.
    if (equityLoop === 'breaks' && year > 2027) {
      mod *= 1.0 + 0.32 * Math.min(1, (year - 2027) / 5)
    }

    // Government intervention reduces displacement over a multi-year ramp.
    if (govtResponse !== 'none' && year >= 2027) {
      const ramp = Math.min(1, (year - 2025) / 3)
      if (govtResponse === 'retraining') mod *= 1.0 - 0.18 * ramp
      else if (govtResponse === 'ubi') mod *= 1.0 - 0.28 * ramp
    }

    // Fed response — effect fades after ~5 years as policy normalizes.
    if (fedResponse !== 'hold') {
      const yearsOut = year - 2025
      let policyStrength: number
      if (yearsOut <= 2) policyStrength = 1.0
      else if (yearsOut <= 5) policyStrength = 1.0 - (yearsOut - 2) / 3 * 0.7
      else policyStrength = 0.15
      if (fedResponse === 'cut') mod *= 1.0 - 0.08 * policyStrength
      else if (fedResponse === 'zero') mod *= 1.0 + 0.22 * policyStrength
    }

    // Feedback-aggressiveness compounds post-2026.
    if (year > 2026) {
      const timeRamp = Math.min(1, (year - 2026) / 5)
      mod *= 1.0 + feedbackAgg * 0.42 * timeRamp
    }

    const adj = Math.min(1, Math.max(0, base * mod))
    adjusted.push({ c, score: adj })
  }

  // Percentile rank across adjusted scores and commit to the lookup map.
  const sortedAdjusted = adjusted.map(a => a.score).sort((a, b) => a - b)
  for (const { c, score } of adjusted) {
    countryByNumeric.set(c.numeric_id, {
      ...c,
      ai_exposure_score: score,
      exposure_percentile: scoreToPercentile(score, sortedAdjusted),
    })
  }

  useEffect(() => {
    d3.json<Topology>(WORLD_TOPOJSON_URL).then(data => {
      if (data) setTopoData(data)
    })
  }, [])

  useEffect(() => {
    if (!svgRef.current || !topoData || countries.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 960
    const height = 500
    const projection = d3.geoNaturalEarth1()
      .scale(155)
      .translate([width / 2, height / 2])
    const path = d3.geoPath().projection(projection)

    // Add defs for tier 3 hatch pattern
    const defs = svg.append('defs')
    defs.html(`
      <pattern id="nodata-hatch" patternUnits="userSpaceOnUse" width="6" height="6"
               patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6"
              stroke="rgba(90,90,110,0.4)" stroke-width="1" />
      </pattern>
    `)

    const countryFeatures = topojson.feature(
      topoData,
      topoData.objects.countries
    ) as unknown as GeoJSON.FeatureCollection

    const g = svg.append('g')

    g.selectAll('path')
      .data(countryFeatures.features)
      .join('path')
      .attr('d', d => path(d) || '')
      .attr('fill', d => {
        const numericId = String(d.id).padStart(3, '0')
        const country = countryByNumeric.get(numericId)
        if (!country || country.ai_exposure_score === null) {
          return '#1a1a25'
        }
        if (country.data_tier === 'tier3') {
          return '#1e1e2a'  // Slightly different for tier 3 with data
        }
        return getExposureColor(country.exposure_percentile ?? 50)
      })
      .attr('stroke', '#2a2a3a')
      .attr('stroke-width', 0.4)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const numericId = String(d.id).padStart(3, '0')
        const country = countryByNumeric.get(numericId)
        if (country) {
          setTooltip({ visible: true, x: event.clientX, y: event.clientY, data: country })
        }
      })
      .on('mousemove', (event) => {
        setTooltip(prev => ({ ...prev, x: event.clientX, y: event.clientY }))
      })
      .on('mouseleave', () => {
        setTooltip(prev => ({ ...prev, visible: false }))
      })
      .on('click', (_event, d) => {
        const numericId = String(d.id).padStart(3, '0')
        const country = countryByNumeric.get(numericId)
        if (country && country.ai_exposure_score !== null) {
          setSelectedCountry(prev => prev?.iso3 === country.iso3 ? null : country)
        }
      })

    // Tier 3 countries: overlay hatch pattern to visually distinguish "estimated/no-data"
    g.selectAll('.tier3-hatch')
      .data(countryFeatures.features.filter(d => {
        const numericId = String(d.id).padStart(3, '0')
        const country = countryByNumeric.get(numericId)
        return country && (country.data_tier === 'tier3' || country.ai_exposure_score === null)
      }))
      .join('path')
      .attr('class', 'tier3-hatch')
      .attr('d', d => path(d) || '')
      .attr('fill', 'url(#nodata-hatch)')
      .attr('pointer-events', 'none')

    // Country borders (mesh)
    const borders = topojson.mesh(
      topoData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      topoData.objects.countries as any,
      (a, b) => a !== b
    )
    g.append('path')
      .datum(borders)
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#3a3a4a')
      .attr('stroke-width', 0.3)

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })
    svg.call(zoom)

  }, [topoData, countries, year, tradePolicy, feedbackAgg, corporateProfit, equityLoop, govtResponse, fedResponse])

  const scoredCount = countries.filter(c => c.ai_exposure_score !== null).length

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 960 500"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: 'var(--bg-primary)',
        }}
      />

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'var(--bg-panel)', padding: '8px 12px',
        borderRadius: 6, border: '1px solid var(--border)', fontSize: 12,
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
          AI Exposure ({scoredCount} countries)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>Low</span>
          <div style={{
            width: 120, height: 10, borderRadius: 2,
            background: 'linear-gradient(to right, #2ecc71, #f1c40f, #e67e22, #e74c3c, #c0392b, #7b241c)',
          }} />
          <span style={{ color: 'var(--text-muted)' }}>High</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ width: 10, height: 10, background: '#1a1a25', borderRadius: 2, border: '1px solid #3a3a4a' }} />
          <span style={{ color: 'var(--text-muted)' }}>No data</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2, border: '1px solid #3a3a4a',
            background: 'repeating-linear-gradient(45deg, #1e1e2a, #1e1e2a 2px, #2a2a3a 2px, #2a2a3a 4px)',
          }} />
          <span style={{ color: 'var(--text-muted)' }}>Estimated (low confidence)</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10,
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '8px 12px', fontSize: 13,
          pointerEvents: 'none', zIndex: 1000, minWidth: 220, maxWidth: 320,
        }}>
          <div style={{ fontWeight: 600 }}>{tooltip.data.name}</div>

          {tooltip.data.ai_exposure_score !== null ? (
            <>
              <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                Exposure: <span style={{
                  color: getExposureColor(tooltip.data.exposure_percentile ?? 50),
                  fontWeight: 600,
                }}>
                  {formatExposure(tooltip.data.ai_exposure_score)}
                </span>
              </div>
              {tooltip.data.total_employment > 0 && (
                <div style={{ color: 'var(--text-secondary)' }}>
                  Labor force: {formatNumber(tooltip.data.total_employment)}
                </div>
              )}
              {tooltip.data.top_occupations.length > 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                  Most exposed: {tooltip.data.top_occupations[0].name}
                </div>
              )}
              <div style={{
                fontSize: 10, marginTop: 4,
                color: tooltip.data.data_tier === 'tier1' ? 'var(--success)' : 'var(--warning)',
              }}>
                {TIER_LABELS[tooltip.data.data_tier]}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 12 }}>
              Insufficient data
            </div>
          )}
        </div>
      )}

      {/* Country detail panel */}
      {selectedCountry && (
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 380, height: '100%',
          background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
          padding: 20, overflowY: 'auto', zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>{selectedCountry.name}</h2>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {selectedCountry.source} ({selectedCountry.year})
              </div>
              <div style={{
                fontSize: 11, marginTop: 4, padding: '2px 6px', borderRadius: 3,
                display: 'inline-block',
                background: selectedCountry.data_tier === 'tier1' ? 'rgba(74,255,138,0.1)' : 'rgba(255,168,74,0.1)',
                color: selectedCountry.data_tier === 'tier1' ? 'var(--success)' : 'var(--warning)',
              }}>
                {TIER_LABELS[selectedCountry.data_tier]}
              </div>
            </div>
            <button
              onClick={() => setSelectedCountry(null)}
              style={{
                background: 'none', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', borderRadius: 4,
                padding: '4px 8px', cursor: 'pointer', fontSize: 14,
              }}
            >
              x
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>AI Exposure</div>
              <div style={{
                fontSize: 18, fontWeight: 700,
                color: getExposureColor(selectedCountry.exposure_percentile ?? 50),
              }}>
                {formatExposure(selectedCountry.ai_exposure_score!)}
              </div>
            </div>
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Labor Force</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {selectedCountry.total_employment > 1_000_000
                  ? `${(selectedCountry.total_employment / 1_000_000).toFixed(1)}M`
                  : formatNumber(selectedCountry.total_employment)}
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>
            {selectedCountry.data_tier === 'tier1' ? 'Occupation Groups' : 'Sector Composition'}
          </h3>
          {selectedCountry.top_occupations.map((occ, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12,
            }}>
              <div style={{ flex: 1 }}>{occ.name}</div>
              <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                <span style={{ color: getExposureColor(occ.ai_exposure * 100), fontWeight: 600 }}>
                  {formatExposure(occ.ai_exposure)}
                </span>
                <span style={{ color: 'var(--text-muted)', width: 50, textAlign: 'right' }}>
                  {(occ.share * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
