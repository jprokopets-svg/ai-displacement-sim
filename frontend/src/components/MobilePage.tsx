import { useEffect, useMemo, useState } from 'react'
import { fetchCounties, searchOccupations, fetchCountyDetail } from '../utils/api'
import { getExposureColor } from '../utils/colors'

const DC_COUNTIES = [
  { name: 'Loudoun County, VA', score: 59 },
  { name: 'District of Columbia', score: 59 },
  { name: 'Frederick County, MD', score: 59 },
  { name: 'Montgomery County, MD', score: 59 },
  { name: "Prince George's County, MD", score: 59 },
]

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

const US_STATES = Object.entries(STATE_ABBR).sort((a, b) => a[1].localeCompare(b[1]))

interface County {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  exposure_percentile: number
  total_employment: number
}

interface OccResult {
  soc_code: string
  occupation_title: string
  ai_exposure: number
}

function extractCountyOnly(name: string): string {
  return name.split(',')[0].trim()
}

export default function MobilePage() {
  const [counties, setCounties] = useState<County[]>([])

  useEffect(() => {
    // Override desktop dashboard layout constraints on html, body, and #root
    // so the mobile page can scroll naturally. The desktop App uses
    // overflow:hidden + fixed 100vh grid which traps MobilePage content.
    document.documentElement.style.height = 'auto'
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    const root = document.getElementById('root')
    if (root) {
      root.style.display = 'block'
      root.style.height = 'auto'
      root.style.overflow = 'visible'
      root.style.gridTemplateRows = 'none'
    }
  }, [])

  useEffect(() => {
    fetchCounties()
      .then(d => setCounties((d.counties || []) as County[]))
      .catch(() => {})
  }, [])

  return (
    <div style={pageStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={eyebrowStyle}>AI DISPLACEMENT SIMULATOR</div>
        <h1 style={titleStyle}>Your County, Your Job</h1>
        <p style={subStyle}>
          County-level AI workforce displacement model. The full tool is desktop-only — this is a mobile summary.
        </p>
      </header>

      {/* Headline finding */}
      <Section title="Key finding">
        <p style={bodyStyle}>
          The top 5 most AI-exposed counties in America are all in the DC metro — not the Rust Belt:
        </p>
        {DC_COUNTIES.map(c => (
          <div key={c.name} style={rowStyle}>
            <span style={{ color: '#e6ebf5', fontSize: 14 }}>{c.name}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', color: getExposureColor(100), fontWeight: 600 }}>
              {c.score}
            </span>
          </div>
        ))}
      </Section>

      {/* Check your county */}
      <Section title="Check your county">
        <CountyChecker counties={counties} />
      </Section>

      {/* Check your job */}
      <Section title="Check your job">
        <JobChecker />
      </Section>

      {/* Footer */}
      <footer style={footerStyle}>
        <p style={{ margin: '0 0 12px' }}>
          Full interactive tool (Monte Carlo, 50K simulations, every US county):{' '}
          <strong>yourjobrisk.com on desktop</strong>
        </p>
        <a href="https://jakeprokopets.substack.com/p/why-the-most-ai-exposed-counties"
          target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Read the full methodology →
        </a>
        <p style={{ margin: '12px 0 0', fontSize: 12 }}>
          Contact: jprokopets@gmail.com
        </p>
      </footer>
    </div>
  )
}

// ---------- County Checker ----------

function CountyChecker({ counties }: { counties: County[] }) {
  const [stateCode, setStateCode] = useState('')
  const [selectedFips, setSelectedFips] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)

  const countiesInState = useMemo(() => {
    if (!stateCode) return []
    return counties
      .filter(c => c.county_fips.startsWith(stateCode))
      .sort((a, b) => extractCountyOnly(a.county_name).localeCompare(extractCountyOnly(b.county_name)))
  }, [counties, stateCode])

  const selected = selectedFips ? counties.find(c => c.county_fips === selectedFips) : null

  useEffect(() => {
    if (!selectedFips) { setDetail(null); return }
    fetchCountyDetail(selectedFips).then(d => setDetail(d as Record<string, unknown>)).catch(() => {})
  }, [selectedFips])

  const topOccs = (detail?.top_exposed_occupations || []) as Array<{
    occupation_title: string; ai_exposure: number
  }>

  return (
    <>
      <select value={stateCode} onChange={e => { setStateCode(e.target.value); setSelectedFips(null) }} style={selectStyle}>
        <option value="">Select state…</option>
        {US_STATES.map(([code, abbr]) => <option key={code} value={code}>{abbr}</option>)}
      </select>
      {stateCode && (
        <select
          value={selectedFips || ''}
          onChange={e => setSelectedFips(e.target.value || null)}
          style={{ ...selectStyle, marginTop: 8 }}
        >
          <option value="">Select county…</option>
          {countiesInState.map(c => (
            <option key={c.county_fips} value={c.county_fips}>{extractCountyOnly(c.county_name)}</option>
          ))}
        </select>
      )}

      {selected && (
        <div style={resultCardStyle}>
          <div style={{ fontSize: 13, color: '#d0d8e4', marginBottom: 4 }}>
            {selected.county_name}
          </div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 40, fontWeight: 600,
            color: getExposureColor(selected.exposure_percentile), lineHeight: 1,
          }}>
            {(selected.ai_exposure_score * 100).toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#d0d8e4', marginTop: 4 }}>
            composite AI displacement score · p{Math.round(selected.exposure_percentile)}
          </div>
          <div style={{ fontSize: 12, color: '#d0d8e4', marginTop: 4 }}>
            {selected.total_employment > 0 ? `${Math.round(selected.total_employment).toLocaleString()} workers` : ''}
          </div>

          {topOccs.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid #1f2942', paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: '#d0d8e4', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                Most exposed occupations
              </div>
              {topOccs.slice(0, 3).map((o, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: '1px solid #1f2942' }}>
                  <span style={{ color: '#d0d8e4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.occupation_title}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: getExposureColor(o.ai_exposure * 100), marginLeft: 8, flexShrink: 0 }}>
                    {(o.ai_exposure * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ---------- Job Checker ----------

function JobChecker() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OccResult[]>([])
  const [selected, setSelected] = useState<OccResult | null>(null)
  const [loading, setLoading] = useState(false)

  const search = () => {
    if (query.length < 2) return
    setLoading(true)
    searchOccupations(query)
      .then(d => {
        const occs = (d.occupations || []) as OccResult[]
        setResults(occs.slice(0, 8))
        if (occs.length === 1) setSelected(occs[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const score = selected?.ai_exposure ?? null
  const score2028 = score != null ? Math.min(1, score * 1.08) : null
  const score2032 = score != null ? Math.min(1, score * 1.22) : null
  const score2035 = score != null ? Math.min(1, score * 1.35) : null

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); setResults([]) }}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. paralegal, nurse, developer"
          style={inputStyle}
        />
        <button onClick={search} disabled={loading} style={btnStyle}>
          {loading ? '…' : 'Go'}
        </button>
      </div>

      {results.length > 0 && !selected && (
        <div style={{ marginTop: 8 }}>
          {results.map(o => (
            <div key={o.soc_code} onClick={() => setSelected(o)} style={resultRowStyle}>
              <span style={{ color: '#e6ebf5', fontSize: 13 }}>{o.occupation_title}</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#d0d8e4' }}>{o.soc_code}</span>
            </div>
          ))}
        </div>
      )}

      {selected && score != null && (
        <div style={resultCardStyle}>
          <div style={{ fontSize: 13, color: '#d0d8e4', marginBottom: 4 }}>{selected.occupation_title}</div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 40, fontWeight: 600,
            color: getExposureColor(score * 100), lineHeight: 1,
          }}>
            {(score * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 11, color: '#d0d8e4', marginTop: 4 }}>
            current AI displacement exposure
          </div>

          <div style={{ marginTop: 14, borderTop: '1px solid #1f2942', paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: '#d0d8e4', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
              Projected trajectory
            </div>
            {[
              { year: 2025, val: score },
              { year: 2028, val: score2028! },
              { year: 2032, val: score2032! },
              { year: 2035, val: score2035! },
            ].map(p => (
              <div key={p.year} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                <span style={{ fontSize: 13, color: '#d0d8e4' }}>{p.year}</span>
                <div style={{ flex: 1, height: 6, margin: '0 10px', background: '#141b30', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${p.val * 100}%`, height: '100%', background: getExposureColor(p.val * 100), borderRadius: 3 }} />
                </div>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: getExposureColor(p.val * 100), width: 40, textAlign: 'right' as const }}>
                  {(p.val * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          <button onClick={() => { setSelected(null); setResults([]); setQuery('') }} style={{ ...btnStyle, marginTop: 12, width: '100%' }}>
            Check another job
          </button>
        </div>
      )}
    </>
  )
}

// ---------- Shared ----------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#d0d8e4', textTransform: 'uppercase' as const, fontWeight: 600, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </section>
  )
}

// ---------- Styles ----------

const pageStyle: React.CSSProperties = {
  minHeight: '100dvh', background: '#0a0e1a', color: '#e6ebf5',
  fontFamily: 'Inter, -apple-system, sans-serif',
  padding: '0 0 40px',
  // Ensure touch scrolling works on iOS
  WebkitOverflowScrolling: 'touch' as never,
  overflowY: 'auto',
}

const headerStyle: React.CSSProperties = {
  padding: '48px 20px 24px', textAlign: 'center',
  borderBottom: '1px solid #1f2942',
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.12em', color: '#f59e0b', marginBottom: 8,
}

const titleStyle: React.CSSProperties = {
  fontSize: 26, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.2,
}

const subStyle: React.CSSProperties = {
  fontSize: 13, color: '#d0d8e4', margin: 0, lineHeight: 1.5,
}

const bodyStyle: React.CSSProperties = {
  fontSize: 14, color: '#d0d8e4', margin: '0 0 12px', lineHeight: 1.5,
}

const sectionStyle: React.CSSProperties = {
  padding: '20px 20px 0',
}

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 0', borderBottom: '1px solid #1f2942', fontSize: 14,
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 15,
  background: '#141b30', color: '#e6ebf5', border: '1px solid #1f2942',
  borderRadius: 6, fontFamily: 'inherit', appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '12px 14px', fontSize: 15,
  background: '#141b30', color: '#e6ebf5', border: '1px solid #1f2942',
  borderRadius: 6, fontFamily: 'inherit', outline: 'none',
}

const btnStyle: React.CSSProperties = {
  padding: '12px 18px', background: '#3b82f6', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer',
}

const resultCardStyle: React.CSSProperties = {
  marginTop: 12, padding: 16, background: '#141b30',
  border: '1px solid #1f2942', borderRadius: 8,
}

const resultRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 12px', borderBottom: '1px solid #1f2942', cursor: 'pointer',
}

const footerStyle: React.CSSProperties = {
  padding: '24px 20px 0', marginTop: 24,
  borderTop: '1px solid #1f2942',
  fontSize: 13, color: '#d0d8e4', textAlign: 'center',
}

const linkStyle: React.CSSProperties = {
  color: '#3b82f6', textDecoration: 'none', fontWeight: 500,
}
