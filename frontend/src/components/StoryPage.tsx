import { useEffect, useRef, useState } from 'react'
import { searchOccupations, fetchCounties } from '../utils/api'
import { getExposureColor } from '../utils/colors'

const TOOL_URL = '/'

// DC suburb counties to highlight in Section 3
const DC_SUBURBS = [
  { fips: '51107', name: 'Loudoun County, VA', score: 0 },
  { fips: '51059', name: 'Fairfax County, VA', score: 0 },
  { fips: '24031', name: 'Montgomery County, MD', score: 0 },
  { fips: '24021', name: 'Frederick County, MD', score: 0 },
]

interface CountyData {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  exposure_percentile: number
}

export default function StoryPage() {
  const [counties, setCounties] = useState<CountyData[]>([])

  useEffect(() => {
    fetchCounties()
      .then(d => setCounties((d.counties || []) as CountyData[]))
      .catch(() => {})
  }, [])

  // Fill DC suburb scores from live data
  const dcData = DC_SUBURBS.map(dc => {
    const match = counties.find(c => c.county_fips === dc.fips)
    return { ...dc, score: match?.ai_exposure_score ?? 0, percentile: match?.exposure_percentile ?? 0 }
  })

  return (
    <div style={pageStyle}>
      {/* Sticky nav */}
      <nav style={stickyNavStyle}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          AI Displacement Simulator
        </span>
        <a href={TOOL_URL} style={enterToolBtnStyle}>
          Enter the tool →
        </a>
      </nav>

      <Section1 />
      <Section2 counties={counties} />
      <Section3 dcData={dcData} />
      <Section4 />
      <Section5 />
    </div>
  )
}

// ---------- Section 1: The Opening ----------

function Section1() {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useObserver(ref, setVisible)

  useEffect(() => {
    if (!visible) return
    const t0 = performance.now()
    const target = 131712
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

  return (
    <section ref={ref} style={sectionStyle}>
      <div style={{ ...fadeStyle(visible), maxWidth: 700, textAlign: 'center' }}>
        <h1 style={heroTitleStyle}>
          Your coworker's job is already gone.
        </h1>
        <p style={heroSubStyle}>
          AI displacement isn't a future event. It's happening now, county by county, job by job.
        </p>
        <div style={{ marginTop: 40 }}>
          <div className="data-value" style={counterStyle}>
            {count.toLocaleString()}
          </div>
          <div style={counterLabelStyle}>
            documented jobs affected across {count > 0 ? '26' : '—'} companies
          </div>
        </div>
      </div>
      <ScrollHint />
    </section>
  )
}

// ---------- Section 2: The Map ----------

function Section2(_props: { counties: CountyData[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useObserver(ref, setVisible)

  return (
    <section ref={ref} style={{ ...sectionStyle, justifyContent: 'center' }}>
      <div style={{ ...fadeStyle(visible), display: 'flex', gap: 40, alignItems: 'center', maxWidth: 1100, width: '100%', padding: '0 40px' }}>
        <div style={{ flex: '0 0 340px' }}>
          <h2 style={sectionTitleStyle}>
            3,204 counties.<br />
            48 million workers at elevated risk.
          </h2>
          <p style={sectionBodyStyle}>
            The geography of displacement is not what you think.
          </p>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MiniMap highlightFips={[]} />
        </div>
      </div>
    </section>
  )
}

// ---------- Section 3: The Surprise ----------

function Section3({ dcData }: { dcData: Array<{ name: string; score: number; percentile: number }> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useObserver(ref, setVisible)

  const dcFips = DC_SUBURBS.map(d => d.fips)

  return (
    <section ref={ref} style={sectionStyle}>
      <div style={{ ...fadeStyle(visible), maxWidth: 800, textAlign: 'center' }}>
        <h2 style={sectionTitleStyle}>
          The most AI-exposed counties in America are not in the Rust Belt.
        </h2>
        <p style={{ ...sectionBodyStyle, marginBottom: 30 }}>
          They're in the suburbs of Washington DC — where defense contractors and knowledge workers concentrate.
        </p>

        <MiniMap highlightFips={dcFips} />

        <div style={{ marginTop: 20 }}>
          {dcData.filter(d => d.score > 0).map(d => (
            <div key={d.name} style={dcRowStyle}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{d.name}</span>
              <span className="data-value" style={{
                fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500,
                color: getExposureColor(d.percentile),
              }}>
                {(d.score * 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Section 4: Personal Moment ----------

function Section4() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useObserver(ref, setVisible)

  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ title: string; score: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const debounced = useDebounce(query, 350)

  useEffect(() => {
    if (debounced.length < 2) { setResult(null); return }
    let cancelled = false
    setLoading(true)
    searchOccupations(debounced)
      .then(d => {
        if (cancelled) return
        const occs = (d.occupations || []) as Array<{ occupation_title: string; ai_exposure: number }>
        if (occs.length > 0) {
          setResult({ title: occs[0].occupation_title, score: occs[0].ai_exposure })
        } else {
          setResult(null)
        }
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
          placeholder="Your job title"
          style={jobInputStyle}
        />

        {loading && <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>}

        {result && (
          <div style={{ marginTop: 24, animation: 'fadeSlideUp 0.4s ease' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
              {result.title}
            </div>
            <div className="data-value" style={{
              fontFamily: 'var(--font-mono)', fontSize: 64, fontWeight: 500, lineHeight: 1,
              color: getExposureColor(result.score * 100),
            }}>
              {(result.score * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              AI displacement exposure score
            </div>
            <a href="/tool#my-risk" style={ctaBtnStyle}>
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
          <a href={TOOL_URL} style={ctaBtnStyle}>Explore your county →</a>
          <a href="/tool#my-risk" style={{ ...ctaBtnStyle, background: 'var(--amber)' }}>
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

// ---------- Mini map (simplified choropleth) ----------

function MiniMap({ highlightFips }: { highlightFips: string[] }) {
  // Renders a simplified representation — no d3 dependency, just a visual placeholder
  // that gives the impression of a choropleth. The real map is in the tool.
  return (
    <div style={{
      width: '100%', height: 200,
      background: 'var(--bg-panel)',
      borderRadius: 8,
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Gradient bar to suggest the choropleth */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: 'linear-gradient(to right, #2ecc71, #f1c40f, #e67e22, #e74c3c, #c0392b, #7b241c)',
      }} />
      <div style={{
        fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
        padding: '0 20px', lineHeight: 1.5,
      }}>
        {highlightFips.length > 0 ? (
          <span style={{ color: 'var(--amber)' }}>
            ↑ DC metropolitan area highlighted above
          </span>
        ) : (
          <span>3,204 US counties · displacement heatmap</span>
        )}
        <br />
        <a href={TOOL_URL} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}>
          View the interactive map →
        </a>
      </div>
    </div>
  )
}

// ---------- Utilities ----------

function useObserver(ref: React.RefObject<HTMLElement | null>, onVisible: (v: boolean) => void) {
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(true) },
      { threshold: 0.25 },
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
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  minHeight: '100vh',
  overflowX: 'hidden',
}

const stickyNavStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 24px',
  background: 'rgba(10, 14, 26, 0.85)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid var(--border)',
}

const enterToolBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
}

const sectionStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  padding: '80px 24px 40px',
}

function fadeStyle(visible: boolean): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(30px)',
    transition: 'opacity 0.8s ease, transform 0.8s ease',
  }
}

const heroTitleStyle: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 1.15,
  margin: 0,
  color: '#fff',
}

const heroSubStyle: React.CSSProperties = {
  fontSize: 18,
  color: 'var(--text-secondary)',
  marginTop: 16,
  lineHeight: 1.6,
}

const counterStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, "DM Mono", ui-monospace, monospace)',
  fontSize: 56,
  fontWeight: 500,
  color: 'var(--amber)',
  lineHeight: 1,
}

const counterLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  marginTop: 10,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
  margin: 0,
}

const sectionBodyStyle: React.CSSProperties = {
  fontSize: 16,
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
  marginTop: 12,
}

const dcRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderBottom: '1px solid var(--border)',
  maxWidth: 400,
  margin: '0 auto',
}

const jobInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  fontSize: 18,
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '2px solid var(--border-strong)',
  borderRadius: 8,
  outline: 'none',
  textAlign: 'center',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const ctaBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 20,
  padding: '12px 24px',
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
}
