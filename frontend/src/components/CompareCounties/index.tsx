import { useEffect, useMemo, useState } from 'react'
import { fetchCountyDetail } from '../../utils/api'
import StateCountyPicker from '../shared/StateCountyPicker'
import { applyScenarioModifiers } from '../../utils/scenarios'
import { getExposureColor } from '../../utils/colors'
import { getUncertaintyState, BAND_LABELS } from '../../utils/uncertainty'
import { countyLabel } from '../../utils/countyLabel'
import type { ScenarioState } from '../ControlPanel'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
  is_estimated?: boolean
}

interface Props {
  baseCounties: CountyScore[]
  counties: CountyScore[]             // scenario-modified for current year
  overlays?: Record<string, Record<string, Record<string, unknown>>>
  scenario: ScenarioState
  onYearChange: (year: number) => void
  onClose: () => void
}

interface OccupationRow {
  occupation_title?: string
  ai_exposure?: number
  soc_code?: string
}

export default function CompareCounties({
  baseCounties, counties, overlays, scenario, onYearChange, onClose,
}: Props) {
  const [fipsA, setFipsA] = useState<string | null>(null)
  const [fipsB, setFipsB] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Live modified data lookup for the current year
  const byFips = useMemo(
    () => new Map(counties.map(c => [c.county_fips, c])),
    [counties],
  )

  const a = fipsA ? byFips.get(fipsA) ?? null : null
  const b = fipsB ? byFips.get(fipsB) ?? null : null

  // Divergence — % point gap between composite scores on 0-100 scale
  const divergence = a && b ? Math.abs(a.ai_exposure_score - b.ai_exposure_score) * 100 : null
  const divergenceBand: { label: string; color: string } | null =
    divergence == null ? null
      : divergence < 5 ? { label: 'Similar exposure trajectory', color: 'var(--success)' }
      : divergence < 15 ? { label: 'Moderate divergence — different economic pressures', color: 'var(--amber)' }
      : { label: 'High divergence — these places face fundamentally different futures', color: 'var(--danger)' }

  const copyShare = async () => {
    if (!a || !b) return
    const scoreA = Math.round(a.ai_exposure_score * 100)
    const scoreB = Math.round(b.ai_exposure_score * 100)
    const txt = `I compared ${shortName(a)} vs ${shortName(b)} on the AI Displacement Simulator. ${scoreA}% vs ${scoreB}% displacement risk by ${scenario.year}. See the full comparison: https://yourjobrisk.com`
    try {
      await navigator.clipboard.writeText(txt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div style={containerStyle}>
      <div style={topBarStyle}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--amber)' }}>Comparison</div>
          <h2 style={titleStyle}>Compare Counties</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={copyShare}
            disabled={!a || !b}
            style={shareBtnStyle(!a || !b)}
          >
            {copied ? 'Copied!' : 'Share comparison'}
          </button>
          <button onClick={onClose} style={backBtnStyle}>
            ← Back to map
          </button>
        </div>
      </div>

      {/* Shared year slider */}
      <div style={yearBarStyle}>
        <div style={yearLabelStyle}>
          <span style={{ color: 'var(--text-muted)' }}>Projection year</span>
          <span className="data-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {scenario.year}
          </span>
        </div>
        <input
          type="range" min={2025} max={2040} step={1}
          value={scenario.year}
          onChange={e => onYearChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Two panels side by side */}
      <div style={panelsRowStyle}>
        <CountyPanel
          side="A"
          selectedFips={fipsA}
          setSelectedFips={setFipsA}
          county={a}
          baseCounties={baseCounties}
          overlays={overlays}
          scenario={scenario}
        />
        <div style={verticalDividerStyle} />
        <CountyPanel
          side="B"
          selectedFips={fipsB}
          setSelectedFips={setFipsB}
          county={b}
          baseCounties={baseCounties}
          overlays={overlays}
          scenario={scenario}
        />
      </div>

      {/* Provocative headline — auto-generated from the most interesting data difference */}
      {a && b && (
        <div style={{
          marginTop: 14,
          padding: '10px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}>
            {generateHeadline(a, b, overlays)}
          </div>
        </div>
      )}

      {/* Divergence indicator */}
      {divergenceBand && (
        <div style={{
          marginTop: 14,
          background: 'var(--bg-secondary)',
          border: `1px solid ${divergenceBand.color}`,
          borderRadius: 6,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
              Divergence
            </div>
            <div style={{ fontSize: 14, color: divergenceBand.color, fontWeight: 500 }}>
              {divergenceBand.label}
            </div>
          </div>
          <div className="data-value" style={{
            fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500,
            color: divergenceBand.color,
          }}>
            {divergence!.toFixed(1)} pts
          </div>
        </div>
      )}

      {(!a || !b) && (
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Try: San Francisco County, California vs Youngstown / Mahoning County, Ohio
        </div>
      )}
    </div>
  )
}

// ---------- Single panel ----------

function CountyPanel({
  side, selectedFips, setSelectedFips, county,
  baseCounties, overlays, scenario,
}: {
  side: 'A' | 'B'
  selectedFips: string | null
  setSelectedFips: (fips: string | null) => void
  county: CountyScore | null
  baseCounties: CountyScore[]
  overlays: Props['overlays']
  scenario: ScenarioState
}) {
  const [topOccs, setTopOccs] = useState<OccupationRow[]>([])

  // Fetch top-5 exposed occupations when the selected county changes
  useEffect(() => {
    if (!selectedFips) { setTopOccs([]); return }
    let cancelled = false
    fetchCountyDetail(selectedFips)
      .then(data => {
        if (cancelled) return
        const list = ((data as Record<string, unknown>).top_exposed_occupations || []) as OccupationRow[]
        setTopOccs(list.slice(0, 5))
      })
      .catch(() => { if (!cancelled) setTopOccs([]) })
    return () => { cancelled = true }
  }, [selectedFips])

  // Trajectory 2025–2040 for this county — re-run applyScenarioModifiers per year.
  const trajectory = useMemo(() => {
    if (!selectedFips) return []
    const baseCounty = baseCounties.find(c => c.county_fips === selectedFips)
    if (!baseCounty) return []
    const years: Array<{ year: number; score: number }> = []
    for (let y = 2025; y <= 2040; y++) {
      const modded = applyScenarioModifiers([baseCounty], { ...scenario, year: y })
      years.push({ year: y, score: modded[0]?.ai_exposure_score ?? baseCounty.ai_exposure_score })
    }
    return years
  }, [selectedFips, baseCounties, scenario])

  const uncertainty = getUncertaintyState(scenario.year)
  const bandInfo = BAND_LABELS[uncertainty.band]

  return (
    <div style={panelStyle}>
      {/* Side label */}
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
        County {side}
      </div>

      {/* County selector — state first, then county */}
      <div style={{ marginBottom: 14 }}>
        <StateCountyPicker
          counties={baseCounties}
          selectedFips={selectedFips}
          onSelect={c => setSelectedFips(c.county_fips)}
        />
      </div>

      {!county ? (
        <div style={{
          padding: '36px 12px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          border: '1px dashed var(--border)',
          borderRadius: 6,
          fontSize: 13,
        }}>
          Search for a county above to populate this panel.
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2, marginBottom: 2 }}>
              {countyLabel({ county_name: county.county_name, county_fips: county.county_fips })}
            </h3>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              FIPS {county.county_fips} · {bandInfo.label}
              {county.is_estimated && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>· estimated</span>}
            </div>
          </div>

          {/* Composite score + confidence */}
          <div style={compositeCardStyle}>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
              Composite Displacement Score
            </div>
            <div className="data-value" style={{
              fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 500, lineHeight: 1,
              color: getExposureColor(county.exposure_percentile),
            }}>
              {(county.ai_exposure_score * 100).toFixed(0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              p{Math.round(county.exposure_percentile)} · Confidence {uncertainty.confidencePct}% · {bandInfo.label}
            </div>
          </div>

          {/* Four metric rows */}
          <div style={metricsBlockStyle}>
            <MetricRow
              label="AI Exposure Score"
              value={`${(county.ai_exposure_score * 100).toFixed(0)}`}
              sub={`${Math.round(county.exposure_percentile)}th percentile`}
            />
            <MetricRow
              label="Projected Impact"
              value={formatK(county.exposed_employment)}
              sub="jobs at elevated risk"
            />
            <MetricRow
              label="Government Floor"
              value={formatPct(overlayScore(overlays, 'govt_floor', county.county_fips, 'govt_floor_score'))}
              sub="share of local income protected"
            />
            <MetricRow
              label="Economic Fragility"
              value={formatPct(fragilityScore(overlays, county.county_fips))}
              sub="cascade vulnerability"
            />
          </div>

          {/* Track breakdown */}
          <Section title="Track breakdown">
            <TrackBar label="Cognitive AI" value={trackScore(county, 'cognitive')} />
            <TrackBar label="Industrial Robotics" value={trackScore(county, 'robotics')} />
            <TrackBar label="Agentic AI" value={trackScore(county, 'agentic', scenario.year)} />
            <TrackBar label="Offshoring" value={trackScore(county, 'offshoring')} />
          </Section>

          {/* Top 5 exposed occupations */}
          <Section title="Most exposed occupations">
            {topOccs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
            ) : (
              topOccs.map((o, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '4px 0', fontSize: 12, color: 'var(--text-secondary)',
                  borderBottom: i === topOccs.length - 1 ? 'none' : '1px solid var(--border)',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {o.occupation_title}
                  </span>
                  <span className="data-value" style={{
                    fontFamily: 'var(--font-mono)',
                    color: getExposureColor(((o.ai_exposure as number) || 0) * 100),
                    marginLeft: 10, flexShrink: 0,
                  }}>
                    {((o.ai_exposure as number) * 100).toFixed(0)}
                  </span>
                </div>
              ))
            )}
          </Section>

          {/* Trajectory sparkline */}
          <Section title="Trajectory 2025 → 2040">
            <Sparkline points={trajectory} currentYear={scenario.year} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              <span>2025</span>
              <span>2040</span>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------- Small pieces ----------

function MetricRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      <div className="data-value" style={{
        fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text-primary)',
      }}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function TrackBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="data-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {pct.toFixed(0)}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: getExposureColor(pct),
          transition: 'width var(--motion-normal, 200ms) ease',
        }} />
      </div>
    </div>
  )
}

function Sparkline({ points, currentYear }: { points: Array<{ year: number; score: number }>; currentYear: number }) {
  if (points.length === 0) return null
  const W = 260, H = 44
  const xs = (i: number) => (i / (points.length - 1)) * W
  const ys = (v: number) => H - v * H  // score 0-1 mapped to full height
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.score).toFixed(1)}`).join(' ')
  const curIdx = points.findIndex(p => p.year === currentYear)
  const cur = curIdx >= 0 ? points[curIdx] : null

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* reference min score baseline */}
      <line x1={0} y1={H - 0.3 * H} x2={W} y2={H - 0.3 * H} stroke="var(--border)" strokeDasharray="2 3" strokeWidth={0.5} />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {cur && (
        <circle
          cx={xs(curIdx)} cy={ys(cur.score)} r={3}
          fill="var(--accent)" stroke="var(--bg-panel)" strokeWidth={1.5}
        />
      )}
    </svg>
  )
}

// ---------- Helpers ----------

function shortName(c: CountyScore): string {
  return c.county_name.replace(/ County$/, '').split(',')[0].trim()
}

function generateHeadline(
  a: CountyScore,
  b: CountyScore,
  overlays: Props['overlays'],
): string {
  const nameA = shortName(a)
  const nameB = shortName(b)
  const scoreA = a.ai_exposure_score
  const scoreB = b.ai_exposure_score

  type Candidate = { text: string; magnitude: number }
  const candidates: Candidate[] = []

  // Score ratio
  if (scoreA > 0 && scoreB > 0) {
    const ratio = Math.max(scoreA, scoreB) / Math.min(scoreA, scoreB)
    if (ratio > 1.15) {
      const higher = scoreA > scoreB ? nameA : nameB
      const lower = scoreA > scoreB ? nameB : nameA
      candidates.push({
        text: `${higher} faces ${ratio.toFixed(1)}x more AI displacement pressure than ${lower}`,
        magnitude: ratio,
      })
    }
  }

  // Percentile gap as percentage difference
  const pctDiff = Math.abs(scoreA - scoreB) * 100
  if (pctDiff > 5) {
    const higher = scoreA > scoreB ? nameA : nameB
    const lower = scoreA > scoreB ? nameB : nameA
    candidates.push({
      text: `${higher} has ${Math.round(pctDiff)}% more AI exposure than ${lower}`,
      magnitude: pctDiff / 10,
    })
  }

  // Govt floor comparison
  const gfA = overlays?.govt_floor?.[a.county_fips]?.govt_floor_score as number | undefined
  const gfB = overlays?.govt_floor?.[b.county_fips]?.govt_floor_score as number | undefined
  if (gfA != null && gfB != null && Math.abs(gfA - gfB) > 0.1) {
    const stronger = gfA > gfB ? nameA : nameB
    const weaker = gfA > gfB ? nameB : nameA
    const pct = Math.round(Math.abs(gfA - gfB) * 100)
    candidates.push({
      text: `${stronger} has a ${pct}% stronger government safety floor than ${weaker}`,
      magnitude: pct / 15,
    })
  }

  // Fragility comparison
  const dynA = overlays?.dynamics?.[a.county_fips]
  const dynB = overlays?.dynamics?.[b.county_fips]
  if (dynA && dynB) {
    const fragA = ((dynA.cascade_score as number) ?? 0) * 0.5 + ((dynA.small_biz_concentration as number) ?? 0) * 0.5
    const fragB = ((dynB.cascade_score as number) ?? 0) * 0.5 + ((dynB.small_biz_concentration as number) ?? 0) * 0.5
    const fragDiff = Math.abs(fragA - fragB)
    if (fragDiff > 0.1) {
      const more = fragA > fragB ? nameA : nameB
      const less = fragA > fragB ? nameB : nameA
      candidates.push({
        text: `${more} is ${Math.round(fragDiff * 100)}% more economically fragile than ${less}`,
        magnitude: fragDiff * 8,
      })
    }
  }

  // Employment scale contrast
  if (a.total_employment > 0 && b.total_employment > 0) {
    const ratio = Math.max(a.total_employment, b.total_employment) /
                  Math.min(a.total_employment, b.total_employment)
    if (ratio > 5) {
      const bigger = a.total_employment > b.total_employment ? nameA : nameB
      const smaller = a.total_employment > b.total_employment ? nameB : nameA
      candidates.push({
        text: `${bigger} has ${Math.round(ratio)}x the workforce of ${smaller} — and more to lose`,
        magnitude: ratio / 5,
      })
    }
  }

  if (candidates.length === 0) {
    return `${nameA} vs ${nameB} — two different AI displacement futures`
  }

  candidates.sort((a, b) => b.magnitude - a.magnitude)
  return candidates[0].text
}

function formatK(n: number): string {
  if (!n) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

function formatPct(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(0)}%`
}

function overlayScore(
  overlays: Props['overlays'],
  group: 'govt_floor' | 'dynamics' | 'kshape',
  fips: string,
  field: string,
): number | null {
  const row = overlays?.[group]?.[fips]
  if (!row) return null
  const v = row[field]
  return typeof v === 'number' ? v : null
}

function fragilityScore(overlays: Props['overlays'], fips: string): number | null {
  const row = overlays?.dynamics?.[fips]
  if (!row) return null
  const cascade = (row.cascade_score as number) ?? 0
  const smallBiz = (row.small_biz_concentration as number) ?? 0
  return cascade * 0.5 + smallBiz * 0.5
}

// Approximate track scores per county — same fallback pattern as USMap.tsx
// (multi_track is empty in prod so this is the actual active path).
function trackScore(county: CountyScore, track: 'cognitive' | 'robotics' | 'agentic' | 'offshoring', year?: number): number {
  const s = county.ai_exposure_score
  if (track === 'cognitive') return s * 1.10
  if (track === 'robotics') return s * 0.60
  if (track === 'agentic') return (year && year > 2026) ? s * 0.90 : s * 0.20
  return s * 0.70
}

// ---------- Styles ----------

const containerStyle: React.CSSProperties = {
  padding: '20px 24px 40px',
  height: '100%',
  overflowY: 'auto',
  background: 'var(--bg-primary)',
  boxSizing: 'border-box',
}

const topBarStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
  marginBottom: 16,
}

const titleStyle: React.CSSProperties = {
  fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0,
  letterSpacing: '-0.01em',
}

const yearBarStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '10px 14px',
  marginBottom: 14,
}

const yearLabelStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: 11, marginBottom: 6,
}

const panelsRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'stretch', gap: 0,
}

const panelStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 18,
  minWidth: 0,
}

const verticalDividerStyle: React.CSSProperties = {
  width: 1, background: 'var(--border)', alignSelf: 'stretch',
  margin: '0 14px',
}

const compositeCardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '12px 14px',
  marginBottom: 14,
}

const metricsBlockStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 14px',
}

function shareBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    background: disabled ? 'var(--bg-panel-hover)' : 'var(--accent)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    border: 'none', borderRadius: 4,
    fontSize: 12, fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

const backBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: 12, fontWeight: 500,
  cursor: 'pointer',
}
