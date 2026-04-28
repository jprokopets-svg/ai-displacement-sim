import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { getExposureColor, formatNumber } from '../utils/colors'
import { bucketColor, bucketLabel, formatExposureWhole } from '../utils/buckets'
import { getUncertaintyState, getHatchPatternDef, BAND_LABELS } from '../utils/uncertainty'
import { countyLabel } from '../utils/countyLabel'
import type { ScenarioState } from './ControlPanel'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
  is_estimated?: boolean
  bucket?: number
}

interface USMapProps {
  counties: CountyScore[]
  onCountyClick: (fips: string) => void
  selectedCounty: string | null
  year?: number
  overlays?: Record<string, Record<string, Record<string, unknown>>>
  companyData?: Record<string, unknown>[]
  scenario?: ScenarioState
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  data: CountyScore | null
}

const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

/**
 * Rank an overlay dict by a numeric field and return fips → percentile (0-100).
 * Used to spread overlay-driven opacity across the full visible range so
 * cross-county variance is immediately obvious regardless of the field's
 * absolute distribution.
 */
function rankOverlay(
  data: Record<string, Record<string, unknown>>,
  field: string,
): Map<string, number> {
  const pairs: Array<[string, number]> = []
  for (const [fips, row] of Object.entries(data)) {
    const v = row[field]
    if (typeof v === 'number' && Number.isFinite(v)) pairs.push([fips, v])
  }
  const sorted = pairs.map(p => p[1]).sort((a, b) => a - b)
  const out = new Map<string, number>()
  for (const [fips, v] of pairs) {
    let lo = 0, hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] <= v) lo = mid + 1
      else hi = mid
    }
    out.set(fips, (lo / sorted.length) * 100)
  }
  return out
}

export default function USMap({ counties, onCountyClick, selectedCounty, year = 2025, overlays, companyData, scenario }: USMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, data: null,
  })
  const [topoData, setTopoData] = useState<Topology | null>(null)

  // Load TopoJSON
  useEffect(() => {
    d3.json<Topology>(TOPOJSON_URL).then(data => {
      if (data) setTopoData(data)
    })
  }, [])

  // Build lookup map
  const countyMap = new Map(counties.map(c => [c.county_fips, c]))

  // Raw layer score lookup — returns the unranked value (0-1 typically) so
  // we can rank across all counties and color by percentile.
  function getRawLayerScore(fips: string, layer: string): number | null {
    if (layer === 'composite') return null // use default percentile
    if (layer === 'govt_floor' && overlays?.govt_floor?.[fips]) {
      return (overlays.govt_floor[fips].govt_floor_score as number) ?? null
    }
    if (layer === 'cascade' && overlays?.dynamics?.[fips]) {
      return (overlays.dynamics[fips].cascade_score as number) ?? null
    }
    if (layer === 'fragility' && overlays?.dynamics?.[fips]) {
      const d = overlays.dynamics[fips]
      const cascade = (d.cascade_score as number) || 0
      const smallBiz = (d.small_biz_concentration as number) || 0
      return cascade * 0.5 + smallBiz * 0.5
    }
    return null
  }

  // Precompute a fips → percentile (0-100) map for the active layer so we
  // can color counties by their rank within the layer's distribution.
  // `null` return means use the default (composite) coloring path.
  function getLayerPercentiles(layer: string): Map<string, number> | null {
    if (layer === 'composite') return null
    const rawByFips: Array<[string, number]> = []
    for (const c of counties) {
      const raw = getRawLayerScore(c.county_fips, layer)
      if (raw === null || !Number.isFinite(raw)) continue
      rawByFips.push([c.county_fips, raw])
    }
    if (rawByFips.length === 0) return null
    const sortedRaws = rawByFips.map(([, v]) => v).sort((a, b) => a - b)
    // Binary-search each raw to its percentile rank.
    const pctByFips = new Map<string, number>()
    for (const [fips, raw] of rawByFips) {
      let lo = 0, hi = sortedRaws.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (sortedRaws[mid] <= raw) lo = mid + 1
        else hi = mid
      }
      pctByFips.set(fips, (lo / sortedRaws.length) * 100)
    }
    return pctByFips
  }

  // Render map
  useEffect(() => {
    if (!svgRef.current || !topoData || counties.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const uncertainty = getUncertaintyState(year)

    const width = 960
    const height = 600
    const projection = d3.geoAlbersUsa().fitSize([width, height],
      topojson.feature(topoData, topoData.objects.nation) as unknown as d3.GeoPermissibleObjects
    )
    const path = d3.geoPath().projection(projection)

    // Add hatch pattern definition if needed
    const defs = svg.append('defs')
    if (uncertainty.hatchDensity > 0) {
      defs.html(getHatchPatternDef(uncertainty.hatchDensity))
    }

    // County shapes
    const countyFeatures = topojson.feature(
      topoData,
      topoData.objects.counties
    ) as unknown as GeoJSON.FeatureCollection

    const g = svg.append('g')

    const layer = scenario?.mapLayer || 'composite'
    const displayMode = scenario?.displayMode || 'bucket'
    const layerPercentiles = getLayerPercentiles(layer)

    g.selectAll('path')
      .data(countyFeatures.features)
      .join('path')
      .attr('d', d => path(d) || '')
      .attr('fill', d => {
        const fips = String(d.id).padStart(5, '0')
        const county = countyMap.get(fips)
        if (!county) return '#1a1a25'

        // Bucket mode: 4 discrete colors
        if (displayMode === 'bucket' && layer === 'composite') {
          return bucketColor(county.bucket)
        }

        // Non-composite layer: color by percentile rank within the layer's
        // distribution so every layer uses the full low→high color range.
        if (layerPercentiles) {
          const pct = layerPercentiles.get(fips)
          if (pct != null) return getExposureColor(pct)
          return '#1a1a25' // county has no data for this layer
        }

        // Continuous mode: composite displacement percentile gradient
        return getExposureColor(county.exposure_percentile)
      })
      .attr('opacity', uncertainty.opacity)
      .attr('stroke', d => {
        const fips = String(d.id).padStart(5, '0')
        return fips === selectedCounty ? '#fff' : '#2a2a3a'
      })
      .attr('stroke-width', d => {
        const fips = String(d.id).padStart(5, '0')
        return fips === selectedCounty ? 2 : 0.3
      })
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const fips = String(d.id).padStart(5, '0')
        const county = countyMap.get(fips)
        if (county) {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            data: county,
          })
        }
      })
      .on('mousemove', (event) => {
        setTooltip(prev => ({ ...prev, x: event.clientX, y: event.clientY }))
      })
      .on('mouseleave', () => {
        setTooltip(prev => ({ ...prev, visible: false }))
      })
      .on('click', (_event, d) => {
        const fips = String(d.id).padStart(5, '0')
        // Clear tooltip when county detail panel opens
        setTooltip({ visible: false, x: 0, y: 0, data: null })
        onCountyClick(fips)
      })

    // State borders — increased stroke weight
    const stateFeatures = topojson.mesh(
      topoData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      topoData.objects.states as any,
      (a, b) => a !== b
    )
    g.append('path')
      .datum(stateFeatures)
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#4a4a5a')
      .attr('stroke-width', 1.5)

    // Transfer payment tint layer — percentile-based opacity so variance is
    // visible regardless of absolute range. Owsley KY (~81%, top percentile)
    // renders at full 0.35, Fairfax VA (~27%, bottom quartile) near 0.
    if (scenario?.showTransferDependency && overlays?.govt_floor) {
      const pctByFips = rankOverlay(overlays.govt_floor, 'transfer_pct')
      const tintGroup = g.append('g').attr('class', 'transfer-tint').attr('pointer-events', 'none')
      tintGroup.selectAll('path')
        .data(countyFeatures.features)
        .join('path')
        .attr('d', d => path(d) || '')
        .attr('fill', '#4169E1')  // Royal blue
        .attr('fill-opacity', d => {
          const fips = String(d.id).padStart(5, '0')
          const pct = pctByFips.get(fips)
          if (pct == null) return 0
          return (pct / 100) * 0.35  // 0th percentile → 0 opacity, 100th → 0.35
        })
        .attr('stroke', 'none')
    }

    // K-shape tint layer — percentile-based opacity.
    if (scenario?.showKshapeDivergence && overlays?.kshape) {
      const pctByFips = rankOverlay(overlays.kshape, 'equity_wage_ratio')
      const tintGroup = g.append('g').attr('class', 'kshape-tint').attr('pointer-events', 'none')
      tintGroup.selectAll('path')
        .data(countyFeatures.features)
        .join('path')
        .attr('d', d => path(d) || '')
        .attr('fill', '#FF1493')  // Deep pink
        .attr('fill-opacity', d => {
          const fips = String(d.id).padStart(5, '0')
          const pct = pctByFips.get(fips)
          if (pct == null) return 0
          return (pct / 100) * 0.35
        })
        .attr('stroke', 'none')
    }

    // Hatch pattern overlay (uncertainty visualization)
    if (uncertainty.hatchDensity > 0) {
      const nationFeature = topojson.feature(
        topoData,
        topoData.objects.nation,
      ) as unknown as GeoJSON.FeatureCollection
      g.append('path')
        .datum(nationFeature.features[0])
        .attr('d', d => path(d) || '')
        .attr('fill', 'url(#hatch)')
        .attr('pointer-events', 'none')
    }

    // Company displacement dots
    if (scenario?.showCompanyDots && companyData && companyData.length > 0) {
      const dotsGroup = g.append('g').attr('class', 'company-dots')
      for (const company of companyData) {
        const c = company as Record<string, unknown>
        const offices = (c.offices as Record<string, unknown>[]) || []
        const events = (c.displacement_events as Record<string, unknown>[]) || []
        const totalHc = events.reduce((sum: number, e: Record<string, unknown>) =>
          sum + ((e.headcount_impact as number) || 0), 0)
        const maxConf = Math.max(0, ...events.map((e: Record<string, unknown>) => (e.confidence_score as number) || 0))
        const companyName = (c.name as string) || ''

        for (const office of offices) {
          const country = (office.country as string) || 'US'
          if (country !== 'US') continue
          const lat = office.lat as number
          const lng = office.lng as number
          if (!lat || !lng) continue
          const coords = projection([lng, lat])
          if (!coords) continue

          const radius = Math.max(4, Math.min(18, Math.sqrt(Math.max(totalHc, 100) / 50)))
          dotsGroup.append('circle')
            .attr('cx', coords[0])
            .attr('cy', coords[1])
            .attr('r', radius)
            .attr('fill', maxConf >= 4 ? '#ef4444' : '#f97316')
            .attr('fill-opacity', 0.8)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
          if (radius >= 6) {
            dotsGroup.append('text')
              .attr('x', coords[0])
              .attr('y', coords[1] - radius - 3)
              .attr('text-anchor', 'middle')
              .attr('font-size', 5)
              .attr('fill', '#fff')
              .attr('pointer-events', 'none')
              .text(companyName.split(' ')[0])
          }
        }
      }
    }

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoom)

  }, [topoData, counties, selectedCounty, onCountyClick, year, overlays, companyData, scenario])

  const uncertainty = getUncertaintyState(year)
  const bandInfo = BAND_LABELS[uncertainty.band]

  const layerName = scenario?.mapLayer || 'composite'
  const LAYER_NAMES: Record<string, string> = {
    composite: 'AI Exposure',
    fragility: 'Local Economy Fragility',
    govt_floor: 'Govt Floor Strength',
    cascade: 'Competitive Cascade',
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Uncertainty banner */}
      {uncertainty.bannerText && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60,
          background: uncertainty.bannerColor,
          padding: '6px 16px',
          textAlign: 'center',
          fontSize: 12,
          color: '#e8e8ed',
          borderBottom: '1px solid var(--border)',
        }}>
          {uncertainty.bannerText}
        </div>
      )}

      {/* Confidence indicator (top right) */}
      <div style={{
        position: 'absolute', top: uncertainty.bannerText ? 36 : 12, right: 12,
        zIndex: 55, background: 'var(--bg-panel)', padding: '6px 10px',
        borderRadius: 6, border: '1px solid var(--border)',
        fontSize: 11, textAlign: 'center', minWidth: 80,
      }}>
        <div style={{ color: 'var(--text-muted)' }}>Confidence</div>
        <div style={{
          fontSize: 18, fontWeight: 700,
          color: bandInfo.color,
        }}>
          {bandInfo.label}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 960 600"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: 'var(--bg-primary)',
        }}
      />

      {/* Color legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'var(--bg-panel)', padding: '8px 12px',
        borderRadius: 6, border: '1px solid var(--border)',
        fontSize: 12,
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
          {LAYER_NAMES[layerName] || 'AI Exposure'}
        </div>
        {scenario?.displayMode === 'bucket' && layerName === 'composite' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2, 3, 4].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 12, height: 10, borderRadius: 2, background: bucketColor(b) }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{bucketLabel(b)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>Low</span>
            <div style={{
              width: 120, height: 10, borderRadius: 2,
              background: 'linear-gradient(to right, #2ecc71, #f1c40f, #e67e22, #e74c3c, #c0392b, #7b241c)',
            }} />
            <span style={{ color: 'var(--text-muted)' }}>High</span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 10,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 13,
          pointerEvents: 'none',
          zIndex: 1000,
          minWidth: 180,
        }}>
          <div style={{ fontWeight: 600 }}>
            {countyLabel(tooltip.data)}
            {tooltip.data.is_estimated && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6, fontWeight: 400 }}>
                ESTIMATED
              </span>
            )}
          </div>
          {scenario?.displayMode === 'bucket' && tooltip.data.bucket ? (
            <div style={{ color: bucketColor(tooltip.data.bucket), marginTop: 4, fontWeight: 600, fontSize: 13 }}>
              {bucketLabel(tooltip.data.bucket)} exposure
            </div>
          ) : null}
          <div style={{ color: 'var(--text-secondary)', marginTop: scenario?.displayMode === 'bucket' ? 2 : 4 }}>
            Exposure: {formatExposureWhole(tooltip.data.ai_exposure_score)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Percentile: p{tooltip.data.exposure_percentile.toFixed(0)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Employment: {formatNumber(tooltip.data.total_employment)}
          </div>
          {tooltip.data.is_estimated && (
            <div style={{ color: 'var(--warning)', fontSize: 10, marginTop: 4 }}>
              Based on industry mix (no occupation-level data)
            </div>
          )}
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
            Click for details
          </div>
        </div>
      )}
    </div>
  )
}
