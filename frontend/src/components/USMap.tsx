import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { getExposureColor, formatExposure, formatNumber } from '../utils/colors'
import { getUncertaintyState, getHatchPatternDef, BAND_LABELS } from '../utils/uncertainty'
import type { ScenarioState } from './ControlPanel'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
  is_estimated?: boolean
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

    g.selectAll('path')
      .data(countyFeatures.features)
      .join('path')
      .attr('d', d => path(d) || '')
      .attr('fill', d => {
        const fips = String(d.id).padStart(5, '0')
        const county = countyMap.get(fips)
        if (!county) return '#1a1a25'

        // Map layer dropdown: recolor by selected metric
        const layer = scenario?.mapLayer || 'composite'
        if (layer === 'govt_floor' && overlays?.govt_floor?.[fips]) {
          const score = (overlays.govt_floor[fips].govt_floor_score as number) || 0
          return getExposureColor(score * 100)
        }
        if (layer === 'cascade' && overlays?.dynamics?.[fips]) {
          const score = (overlays.dynamics[fips].cascade_score as number) || 0
          return getExposureColor(score * 100)
        }

        // Default: displacement percentile
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
        setTooltip(prev => ({ ...prev, visible: false }))
        onCountyClick(fips)
      })

    // State borders
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
      .attr('stroke-width', 0.8)

    // Transfer payment tint layer (separate SVG group on top of base colors)
    if (scenario?.showTransferDependency && overlays?.govt_floor) {
      const tintGroup = g.append('g').attr('class', 'transfer-tint').attr('pointer-events', 'none')
      tintGroup.selectAll('path')
        .data(countyFeatures.features)
        .join('path')
        .attr('d', d => path(d) || '')
        .attr('fill', '#4169E1')  // Royal blue
        .attr('fill-opacity', d => {
          const fips = String(d.id).padStart(5, '0')
          const data = overlays.govt_floor[fips]
          if (!data) return 0
          const tp = (data.transfer_pct as number) || 0
          // 0.05 to 0.35 opacity range
          if (tp < 0.15) return 0.05
          if (tp < 0.30) return 0.12
          if (tp < 0.45) return 0.18
          if (tp < 0.60) return 0.25
          return 0.35
        })
        .attr('stroke', 'none')
    }

    // K-shape tint layer
    if (scenario?.showKshapeDivergence && overlays?.kshape) {
      const tintGroup = g.append('g').attr('class', 'kshape-tint').attr('pointer-events', 'none')
      tintGroup.selectAll('path')
        .data(countyFeatures.features)
        .join('path')
        .attr('d', d => path(d) || '')
        .attr('fill', '#FF1493')  // Deep pink
        .attr('fill-opacity', d => {
          const fips = String(d.id).padStart(5, '0')
          const data = overlays.kshape[fips]
          if (!data) return 0
          const ratio = (data.equity_wage_ratio as number) || 0
          // 0.05 to 0.35 opacity range
          if (ratio < 0.15) return 0.05
          if (ratio < 0.35) return 0.12
          if (ratio < 0.60) return 0.18
          if (ratio < 0.90) return 0.25
          return 0.35
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
      let dotCount = 0
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
          // geoAlbersUsa only projects US coordinates — skip non-US offices
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
          // Company label for larger dots
          if (radius >= 6) {
            dotsGroup.append('text')
              .attr('x', coords[0])
              .attr('y', coords[1] - radius - 3)
              .attr('text-anchor', 'middle')
              .attr('font-size', 5)
              .attr('fill', '#fff')
              .attr('pointer-events', 'none')
              .text(companyName.split(' ')[0])  // First word of company name
          }
          dotCount++
        }
      }
      console.log(`[Company dots] Rendered ${dotCount} dots from ${companyData.length} companies`)
    }

    // Reshoring paradox indicators — large visible markers
    if (scenario?.showReshoringParadox && overlays?.dynamics) {
      const mfgGroup = g.append('g').attr('class', 'reshoring')
      for (const [fips, data] of Object.entries(overlays.dynamics)) {
        const mfgPct = (data.manufacturing_emp_pct as number) || 0
        const paradox = (data.reshoring_paradox_score as number) || 0
        if (mfgPct < 0.10 || paradox < 0.1) continue
        const feature = countyFeatures.features.find(f => String(f.id).padStart(5, '0') === fips)
        if (!feature) continue
        const centroid = path.centroid(feature)
        if (!centroid || isNaN(centroid[0])) continue
        // Bright orange circle with R label — visible at default zoom
        mfgGroup.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 5)
          .attr('fill', '#f97316')
          .attr('fill-opacity', 0.9)
          .attr('stroke', '#fff')
          .attr('stroke-width', 0.8)
          .attr('pointer-events', 'none')
        mfgGroup.append('text')
          .attr('x', centroid[0])
          .attr('y', centroid[1])
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', 7)
          .attr('font-weight', 'bold')
          .attr('fill', '#fff')
          .attr('pointer-events', 'none')
          .text('R')
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

  return (
    <div style={{ position: 'relative', width: '100%' }}>
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
          {uncertainty.confidencePct}%
        </div>
        <div style={{ color: bandInfo.color, fontSize: 10 }}>{bandInfo.label}</div>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 960 600"
        style={{ width: '100%', height: 'auto', background: 'var(--bg-secondary)' }}
      />

      {/* Color legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'var(--bg-panel)', padding: '8px 12px',
        borderRadius: 6, border: '1px solid var(--border)',
        fontSize: 12,
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>AI Exposure</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>Low</span>
          <div style={{
            width: 120, height: 10, borderRadius: 2,
            background: 'linear-gradient(to right, #2ecc71, #a3d977, #f1c40f, #e67e22, #e74c3c, #c0392b, #7b241c)',
          }} />
          <span style={{ color: 'var(--text-muted)' }}>High</span>
        </div>
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
            {tooltip.data.county_name}
            {tooltip.data.is_estimated && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6, fontWeight: 400 }}>
                ESTIMATED
              </span>
            )}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            Exposure: <span style={{ color: getExposureColor(tooltip.data.exposure_percentile) }}>
              {formatExposure(tooltip.data.ai_exposure_score)}
            </span>
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
