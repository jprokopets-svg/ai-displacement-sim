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

const MIN_SCALE = 1
const MAX_SCALE = 8
const VIEW_W = 960
const VIEW_H = 600

/** County choropleth of AI exposure. Scroll/pinch to zoom, drag to pan, hover for detail. */
export default function USMap({ counties }: { counties: CountyScore[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [topoData, setTopoData] = useState<Topology | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [zoomed, setZoomed] = useState(false)

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).call(zoomRef.current.transform, d3.zoomIdentity)
  }

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

    const projection = d3.geoAlbersUsa().fitSize([VIEW_W, VIEW_H],
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
      // Keep borders hairline-thin at every zoom level.
      .attr('vector-effect', 'non-scaling-stroke')
      // Both handlers resolve the county from the hovered path's own datum, so
      // the tooltip stays correct when a zoom slides a different county under
      // a stationary cursor.
      .on('mouseenter mousemove', (event, d) => {
        const county = countyMap.get(String(d.id).padStart(5, '0'))
        if (county) setTooltip({ x: event.clientX, y: event.clientY, data: county })
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
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      // Panning can't push the map off its own frame.
      .translateExtent([[0, 0], [VIEW_W, VIEW_H]])
      .on('start', () => {
        svg.classed('dragging', true)
        setTooltip(null)
      })
      .on('zoom', event => {
        g.attr('transform', event.transform.toString())
        setZoomed(event.transform.k > MIN_SCALE)
      })
      .on('end', () => svg.classed('dragging', false))

    svg.call(zoom)
    zoomRef.current = zoom

    // Re-render (e.g. county data arriving) rebuilds `g` without a transform,
    // while d3 keeps the current one on the svg node. Reapply it so the view
    // doesn't silently jump back to 1x.
    const current = d3.zoomTransform(svg.node()!)
    g.attr('transform', current.toString())
    setZoomed(current.k > MIN_SCALE)
  }, [topoData, counties])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        className="us-map"
        viewBox="0 0 960 600"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />

      {zoomed && (
        <button type="button" onClick={resetZoom} style={resetStyle}>
          Reset
        </button>
      )}

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

const resetStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  padding: '3px 8px',
  fontSize: 12,
  color: '#333',
  background: '#fff',
  border: '1px solid #ccc',
  cursor: 'pointer',
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
