import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { getExposureColor, formatExposure, formatNumber } from '../utils/colors'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
}

interface USMapProps {
  counties: CountyScore[]
  onCountyClick: (fips: string) => void
  selectedCounty: string | null
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  data: CountyScore | null
}

const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

export default function USMap({ counties, onCountyClick, selectedCounty }: USMapProps) {
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

    const width = 960
    const height = 600
    const projection = d3.geoAlbersUsa().fitSize([width, height],
      topojson.feature(topoData, topoData.objects.nation) as unknown as d3.GeoPermissibleObjects
    )
    const path = d3.geoPath().projection(projection)

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
        return county ? getExposureColor(county.exposure_percentile) : '#1a1a25'
      })
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

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoom)

  }, [topoData, counties, selectedCounty, onCountyClick])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
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
            background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444, #991b1b)',
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
          <div style={{ fontWeight: 600 }}>{tooltip.data.county_name}</div>
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
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
            Click for details
          </div>
        </div>
      )}
    </div>
  )
}
