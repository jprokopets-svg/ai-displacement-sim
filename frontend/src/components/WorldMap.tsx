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

interface WorldMapProps {
  countries: CountryScore[]
  year?: number
  tradePolicy?: string
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
  tier2: 'Estimated — based on labor sector composition',
  tier3: 'Insufficient data',
}

export default function WorldMap({ countries, year = 2025, tradePolicy = 'current' }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [topoData, setTopoData] = useState<Topology | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, data: null,
  })
  const [selectedCountry, setSelectedCountry] = useState<CountryScore | null>(null)

  // Build lookup by numeric ID (what TopoJSON uses)
  // Apply scenario modifiers to country scores
  const yearMod = year <= 2025 ? 1.0 : 1.0 + (year - 2025) * 0.008
  const tradeMod = tradePolicy === 'free_trade' ? 1.10 : tradePolicy === 'escalating_tariffs' ? 0.95 : 1.0

  const countryByNumeric = new Map<string, CountryScore>()
  for (const c of countries) {
    if (c.numeric_id) {
      if (c.ai_exposure_score !== null) {
        const adjusted = Math.min(1, c.ai_exposure_score * yearMod * tradeMod)
        countryByNumeric.set(c.numeric_id, { ...c, ai_exposure_score: adjusted })
      } else {
        countryByNumeric.set(c.numeric_id, c)
      }
    }
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
          return '#1a1a25'  // Tier 3 / no data: neutral dark
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

  }, [topoData, countries, year, tradePolicy])

  const scoredCount = countries.filter(c => c.ai_exposure_score !== null).length

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 960 500"
        style={{ width: '100%', height: 'auto', background: 'var(--bg-secondary)' }}
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
            background: 'linear-gradient(to right, #15803d, #4ade80, #eab308, #f97316, #ef4444, #7f1d1d)',
          }} />
          <span style={{ color: 'var(--text-muted)' }}>High</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ width: 10, height: 10, background: '#1a1a25', borderRadius: 2, border: '1px solid #3a3a4a' }} />
          <span style={{ color: 'var(--text-muted)' }}>No data</span>
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
              ✕
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
