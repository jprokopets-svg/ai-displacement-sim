import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { searchOccupations, fetchCounties, fetchCompanyDisplacement } from '../utils/api'
import { getExposureColor } from '../utils/colors'

const TOOL_URL = '/'
const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

// DC metro FIPS for slide 3 highlight
const DC_METRO_FIPS = new Set([
  '51107', '51059', '51013', '11001', '24031', '24021', '24033',
  '51510', '51600', '51610', '51685',
])

// States to render on slide 3 zoomed map (VA, MD, DC, DE, PA, WV)
const DC_REGION_STATES = new Set(['51', '24', '11', '10', '42', '54'])

// FIPS state code → abbreviation (only the ones we need for top rankings)
const STATE_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

function countyDisplayName(c: CountyData): string {
  if (c.county_fips === '11001') return 'District of Columbia'
  const stateCode = c.county_fips.slice(0, 2)
  const abbr = STATE_ABBR[stateCode]
  return abbr ? `${c.county_name}, ${abbr}` : c.county_name
}

interface CountyData {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposure_percentile: number
}

interface CompanyEvent {
  name: string
  total_headcount_impacted: number | null
}

export default function StoryPage() {
  const [counties, setCounties] = useState<CountyData[]>([])
  const [companies, setCompanies] = useState<CompanyEvent[]>([])

  useEffect(() => {
    fetchCounties()
      .then(d => setCounties((d.counties || []) as CountyData[]))
      .catch(() => {})
    fetchCompanyDisplacement()
      .then(d => {
        const cs = (d.companies || []) as Array<Record<string, unknown>>
        setCompanies(cs.map(c => ({
          name: (c.name as string) || '',
          total_headcount_impacted: (c.total_headcount_impacted as number) ?? null,
        })))
      })
      .catch(() => {})
  }, [])

  // Top 5 counties by composite score — filtered to 100K+ employment
  // to exclude tiny counties with volatile scores. Same threshold as
  // the right panel's "Most Exposed Counties" list.
  const MIN_RANKING_EMPLOYMENT = 100_000
  const top5Counties = counties
    .filter(c => c.ai_exposure_score > 0 && c.total_employment >= MIN_RANKING_EMPLOYMENT)
    .sort((a, b) => b.ai_exposure_score - a.ai_exposure_score)
    .slice(0, 5)

  // Top 10 companies by headcount
  const top10Companies = companies
    .filter(c => c.total_headcount_impacted && c.total_headcount_impacted > 0)
    .sort((a, b) => (b.total_headcount_impacted || 0) - (a.total_headcount_impacted || 0))
    .slice(0, 10)

  return (
    <div style={pageStyle}>
      <nav style={stickyNavStyle}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          AI Displacement Simulator
        </span>
        <a href={TOOL_URL} style={ghostBtnStyle}>
          Enter the tool →
        </a>
      </nav>

      <Section1 top10={top10Companies} />
      <Section2 counties={counties} />
      <Section3 counties={counties} top5={top5Counties} />
      <Section4 />
      <Section5 />
    </div>
  )
}

// ---------- Section 1: The Opening ----------

function Section1({ top10 }: { top10: CompanyEvent[] }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useObserver(ref, setVisible)

  useEffect(() => {
    if (!visible) return
    const t0 = performance.now()
    const target = 405378
    const duration = 3000
    const id = setInterval(() => {
      const elapsed = performance.now() - t0
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress >= 1) clearInterval(id)
    }, 30)
    return () => clearInterval(id)
  }, [visible])

  const maxHc = Math.max(...top10.map(c => c.total_headcount_impacted || 0), 1)

  return (
    <section ref={ref} style={sectionStyle}>
      <div style={{ ...fadeStyle(visible), maxWidth: 800, width: '100%', textAlign: 'center' }}>
        <h1 style={heroTitleStyle}>
          {count > 0 ? count.toLocaleString() : '405,378'} jobs. 72 companies. 3 years.
        </h1>
        <p style={heroSubStyle}>
          AI displacement isn't a future event. It's happening now, county by county, job by job.
        </p>

        {/* Top 10 bar chart */}
        {top10.length > 0 && (
          <div style={{ marginTop: 36, textAlign: 'left' }}>
            {top10.map(c => {
              const hc = c.total_headcount_impacted || 0
              const pct = (hc / maxHc) * 100
              return (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 10 }}>
                  <div style={{ width: 130, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
                    {c.name}
                  </div>
                  <div style={{ flex: 1, height: 14, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: 'var(--amber)',
                      borderRadius: 2,
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  <div className="data-value" style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--text-muted)', width: 55, textAlign: 'right', flexShrink: 0,
                  }}>
                    {hc.toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ScrollHint />
    </section>
  )
}

// ---------- Section 2: The Map (real D3 choropleth) ----------

function Section2({ counties }: { counties: CountyData[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [visible, setVisible] = useState(false)
  const [topoData, setTopoData] = useState<Topology | null>(null)
  useObserver(ref, setVisible)

  useEffect(() => {
    d3.json<Topology>(TOPOJSON_URL).then(data => { if (data) setTopoData(data) })
  }, [])

  const renderMap = useCallback(() => {
    if (!svgRef.current || !topoData || counties.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const W = 560, H = 360
    const projection = d3.geoAlbersUsa().fitSize([W, H],
      topojson.feature(topoData, topoData.objects.nation) as unknown as d3.GeoPermissibleObjects)
    const path = d3.geoPath().projection(projection)
    const byFips = new Map(counties.map(c => [c.county_fips, c]))
    const features = topojson.feature(topoData, topoData.objects.counties) as unknown as GeoJSON.FeatureCollection
    svg.append('g').selectAll('path')
      .data(features.features).join('path')
      .attr('d', d => path(d) || '')
      .attr('fill', d => {
        const fips = String(d.id).padStart(5, '0')
        const c = byFips.get(fips)
        return c ? getExposureColor(c.exposure_percentile) : '#1a1a25'
      })
      .attr('stroke', '#1a1a25').attr('stroke-width', 0.15)
  }, [topoData, counties])

  useEffect(() => { renderMap() }, [renderMap])

  return (
    <section ref={ref} style={{ ...sectionStyle, justifyContent: 'center' }}>
      <div style={{ ...fadeStyle(visible), display: 'flex', gap: 40, alignItems: 'center', maxWidth: 1100, width: '100%', padding: '0 40px' }}>
        <div style={{ flex: '0 0 340px' }}>
          <h2 style={sectionTitleStyle}>
            3,204 counties.<br />48 million workers at elevated risk.
          </h2>
          <p style={sectionBodyStyle}>
            The geography of displacement is not what you think.
          </p>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)', padding: 12, position: 'relative' }}>
            <svg ref={svgRef} viewBox="0 0 560 360" style={{ width: '100%', height: 'auto', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <span>Low</span>
              <div style={{ width: 80, height: 6, borderRadius: 2, background: 'linear-gradient(to right, #2ecc71, #f1c40f, #e67e22, #e74c3c, #c0392b, #7b241c)' }} />
              <span>High</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Section 3: DC metro zoom ----------

function Section3({ counties, top5 }: { counties: CountyData[]; top5: CountyData[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [visible, setVisible] = useState(false)
  const [topoData, setTopoData] = useState<Topology | null>(null)
  useObserver(ref, setVisible)

  useEffect(() => {
    d3.json<Topology>(TOPOJSON_URL).then(data => { if (data) setTopoData(data) })
  }, [])

  const renderMap = useCallback(() => {
    if (!svgRef.current || !topoData || counties.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const W = 500, H = 300
    const byFips = new Map(counties.map(c => [c.county_fips, c]))
    const allFeatures = topojson.feature(topoData, topoData.objects.counties) as unknown as GeoJSON.FeatureCollection
    const regionFeatures = {
      type: 'FeatureCollection' as const,
      features: allFeatures.features.filter(f => {
        const fips = String(f.id).padStart(5, '0')
        return DC_REGION_STATES.has(fips.slice(0, 2))
      }),
    }
    const projection = d3.geoMercator().fitSize([W, H], regionFeatures)
    const path = d3.geoPath().projection(projection)
    const g = svg.append('g')
    g.selectAll('path')
      .data(regionFeatures.features).join('path')
      .attr('d', d => path(d) || '')
      .attr('fill', d => {
        const fips = String(d.id).padStart(5, '0')
        const c = byFips.get(fips)
        return c ? getExposureColor(c.exposure_percentile) : '#1a1a25'
      })
      .attr('stroke', d => {
        const fips = String(d.id).padStart(5, '0')
        return DC_METRO_FIPS.has(fips) ? '#fff' : '#2a2a3a'
      })
      .attr('stroke-width', d => {
        const fips = String(d.id).padStart(5, '0')
        return DC_METRO_FIPS.has(fips) ? 1.5 : 0.3
      })
  }, [topoData, counties])

  useEffect(() => { renderMap() }, [renderMap])

  return (
    <section ref={ref} style={sectionStyle}>
      <div style={{ ...fadeStyle(visible), maxWidth: 800, textAlign: 'center' }}>
        <h2 style={sectionTitleStyle}>
          The most AI-exposed counties in America are not in the Rust Belt.
        </h2>
        <p style={{ ...sectionBodyStyle, marginBottom: 24 }}>
          They're in the suburbs of Washington DC — where defense contractors and knowledge workers concentrate.
        </p>

        <div style={{ background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)', padding: 12, marginBottom: 20 }}>
          <svg ref={svgRef} viewBox="0 0 500 300" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>

        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          {top5.map(c => (
            <div key={c.county_fips} style={dcRowStyle}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{countyDisplayName(c)}</span>
              <span className="data-value" style={{
                fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 500,
                color: getExposureColor(c.exposure_percentile),
              }}>
                {(c.ai_exposure_score * 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Section 4: Personal Moment ----------

const PLACEHOLDER_EXAMPLES = ['Try: Paralegal', 'Try: Financial Analyst', 'Try: Electrician', 'Try: Software Developer']

function Section4() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useObserver(ref, setVisible)

  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ title: string; score: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const debounced = useDebounce(query, 350)

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_EXAMPLES.length), 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (debounced.length < 2) { setResult(null); return }
    let cancelled = false
    setLoading(true)
    searchOccupations(debounced)
      .then(d => {
        if (cancelled) return
        const occs = (d.occupations || []) as Array<{ occupation_title: string; ai_exposure: number }>
        if (occs.length > 0) setResult({ title: occs[0].occupation_title, score: occs[0].ai_exposure })
        else setResult(null)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debounced])

  return (
    <section ref={ref} style={sectionStyle}>
      <div style={{ ...fadeStyle(visible), maxWidth: 560, textAlign: 'center', width: '100%' }}>
        <h2 style={sectionTitleStyle}>Where do you fit?</h2>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={PLACEHOLDER_EXAMPLES[placeholderIdx]}
          style={jobInputStyle}
        />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          We'll show your occupation's exposure score and what happens over the next 15 years.
        </div>

        {loading && <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>}

        {result && (
          <div style={{ marginTop: 24, animation: 'fadeSlideUp 0.4s ease' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{result.title}</div>
            <div className="data-value" style={{
              fontFamily: 'var(--font-mono)', fontSize: 64, fontWeight: 500, lineHeight: 1,
              color: getExposureColor(result.score * 100),
            }}>
              {(result.score * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              AI displacement exposure score
            </div>
            <a href="/#my-risk" style={ctaBtnStyle}>
              Explore your full risk profile →
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- Section 5: CTA ----------

function Section5() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useObserver(ref, setVisible)

  return (
    <section ref={ref} style={{ ...sectionStyle, minHeight: '70vh' }}>
      <div style={{ ...fadeStyle(visible), maxWidth: 600, textAlign: 'center' }}>
        <h2 style={sectionTitleStyle}>This is just the beginning of the story.</h2>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 28 }}>
          <a href={TOOL_URL} style={ctaPrimaryStyle}>Explore your county →</a>
          <a href="/#my-risk" style={ctaOutlineStyle}>
            Check your full risk profile →
          </a>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 32, lineHeight: 1.6 }}>
          Built on BLS OEWS 2024, O*NET 29.1, Felten-Raj-Rock 2021 AI Exposure Index, IFR robotics data.
        </p>
      </div>
    </section>
  )
}

// ---------- Utilities ----------

function useObserver(ref: React.RefObject<HTMLElement | null>, onVisible: (v: boolean) => void) {
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(true) },
      { threshold: 0.2 },
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, onVisible])
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(h)
  }, [value, delay])
  return debounced
}

function ScrollHint() {
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em',
      animation: 'pulse 2s infinite',
    }}>
      SCROLL ↓
    </div>
  )
}

// ---------- Styles ----------

const pageStyle: React.CSSProperties = {
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
  minHeight: '100vh', overflowX: 'hidden',
}

const stickyNavStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 24px',
  background: 'rgba(10, 14, 26, 0.85)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid var(--border)',
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
}

const sectionStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  position: 'relative', padding: '80px 24px 40px',
}

function fadeStyle(visible: boolean): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(30px)',
    transition: 'opacity 0.8s ease, transform 0.8s ease',
  }
}

const heroTitleStyle: React.CSSProperties = {
  fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em',
  lineHeight: 1.15, margin: 0, color: '#fff',
}

const heroSubStyle: React.CSSProperties = {
  fontSize: 18, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.6,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, margin: 0,
}

const sectionBodyStyle: React.CSSProperties = {
  fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 12,
}

const dcRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  padding: '8px 16px', borderBottom: '1px solid var(--border)',
}

const jobInputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 18px', fontSize: 18,
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  border: '2px solid var(--border-strong)', borderRadius: 8,
  outline: 'none', textAlign: 'center', fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
}

const ctaBtnStyle: React.CSSProperties = {
  display: 'inline-block', marginTop: 20, padding: '12px 24px',
  background: '#3b82f6', color: '#fff', borderRadius: 6,
  fontSize: 14, fontWeight: 600, textDecoration: 'none',
}

const ctaPrimaryStyle: React.CSSProperties = {
  display: 'inline-block', padding: '14px 28px',
  background: '#3b82f6', color: '#fff', borderRadius: 6,
  fontSize: 15, fontWeight: 600, textDecoration: 'none',
}

const ctaOutlineStyle: React.CSSProperties = {
  display: 'inline-block', padding: '14px 28px',
  background: 'transparent', color: '#fff',
  border: '2px solid rgba(255, 255, 255, 0.6)',
  borderRadius: 6, fontSize: 15, fontWeight: 600, textDecoration: 'none',
}
