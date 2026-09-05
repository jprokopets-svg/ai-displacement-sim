import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { bucketColor, bucketLabel, formatExposure, NO_DATA_COLOR } from '../utils/buckets'
import { countyLabel } from '../utils/countyLabel'

export interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  bucket?: number
}

interface TooltipState {
  x: number
  y: number
  data: CountyScore | null
}

const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

/** Static county choropleth of AI exposure. Hover for county name, bucket, score. */
export default function USMap({ counties }: { counties: CountyScore[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [topoData, setTopoData] = useState<Topology | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    d3.json<Topology>(TOPOJSON_URL).then(data => {
      if (data) setTopoData(data)
    })
  }, [])

  useEffect(() => {
    if (!svgRef.current || !topoData || counties.length === 0) return

    const countyMap = new Map(counties.map(c => [c.county_fips, c]))
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const projection = d3.geoAlbersUsa().fitSize([960, 600],
      topojson.feature(topoData, topoData.objects.nation) as unknown as d3.GeoPermissibleObjects
    )
    const path = d3.geoPath().projection(projection)
    const countyFeatures = topojson.feature(
      topoData, topoData.objects.counties
    ) as unknown as GeoJSON.FeatureCollection

    const g = svg.append('g')

    g.selectAll('path')
      .data(countyFeatures.features)
      .join('path')
      .attr('d', d => path(d) || '')
      .attr('fill', d => {
        const county = countyMap.get(String(d.id).padStart(5, '0'))
        return county ? bucketColor(county.bucket) : NO_DATA_COLOR
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0.3)
      .on('mouseenter', (event, d) => {
        const county = countyMap.get(String(d.id).padStart(5, '0'))
        if (county) setTooltip({ x: event.clientX, y: event.clientY, data: county })
      })
      .on('mousemove', event => {
        setTooltip(prev => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))
      })
      .on('mouseleave', () => setTooltip(null))

    // State borders
    g.append('path')
      .datum(topojson.mesh(
        topoData,
        topoData.objects.states as Parameters<typeof topojson.mesh>[1],
        (a, b) => a !== b,
      ))
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#9aa4b2')
      .attr('stroke-width', 0.7)
      .attr('pointer-events', 'none')
  }, [topoData, counties])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 960 600"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />

      <div style={legendStyle}>
        <span style={{ color: '#555' }}>AI exposure</span>
        {[1, 2, 3, 4].map(b => (
          <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 14, height: 10, background: bucketColor(b),
              border: '1px solid #ccc', display: 'inline-block',
            }} />
            {bucketLabel(b)}
          </span>
        ))}
      </div>

      {tooltip?.data && (
        <div style={{ ...tooltipStyle, left: tooltip.x + 14, top: tooltip.y + 14 }}>
          <div style={{ fontWeight: 600 }}>{countyLabel(tooltip.data)}</div>
          <div>{bucketLabel(tooltip.data.bucket)} exposure &middot; {formatExposure(tooltip.data.ai_exposure_score)}</div>
        </div>
      )}
    </div>
  )
}

const legendStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12,
  fontSize: 12,
  color: '#333',
  marginTop: 4,
}

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  background: '#fff',
  border: '1px solid #ccc',
  padding: '6px 10px',
  fontSize: 13,
  color: '#111',
  pointerEvents: 'none',
  zIndex: 10,
  whiteSpace: 'nowrap',
}
