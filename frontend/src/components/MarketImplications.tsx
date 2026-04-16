import { useMemo, useState } from 'react'

type Track = 'cognitive' | 'robotics' | 'agentic' | 'offshoring'
type FilterTrack = 'all' | Track
type Confidence = 'High' | 'Medium' | 'Speculative'

interface Beneficiary {
  name: string
  ticker: string
  sector: string
  tracks: Track[]
  rationale: string
  confidence: Confidence
}

interface Headwind {
  name: string
  tickers?: string
  sector: string
  tracks: Track[]
  rationale: string
  confidence: Confidence
}

const BENEFICIARIES: Beneficiary[] = [
  {
    name: 'Nvidia',
    ticker: 'NVDA',
    sector: 'AI Infrastructure',
    tracks: ['cognitive', 'agentic'],
    rationale: 'Every AI model deployed runs on Nvidia GPUs. Displacement acceleration is direct capex acceleration.',
    confidence: 'High',
  },
  {
    name: 'Aurora Innovation',
    ticker: 'AUR',
    sector: 'Autonomous Vehicles',
    tracks: ['robotics'],
    rationale: 'Commercially operating driverless trucks on the Dallas-Houston corridor. Direct replacement of trucking employment at scale.',
    confidence: 'High',
  },
  {
    name: 'Fanuc',
    ticker: 'FANUC',
    sector: 'Industrial Robotics',
    tracks: ['robotics'],
    rationale: 'World\'s largest industrial robot manufacturer. Reshoring under tariffs drives robotics capex, not human employment.',
    confidence: 'High',
  },
  {
    name: 'ABB',
    ticker: 'ABB',
    sector: 'Industrial Automation',
    tracks: ['robotics'],
    rationale: 'Global automation and robotics leader. Every manufacturing reshoring announcement is an ABB revenue opportunity.',
    confidence: 'High',
  },
  {
    name: 'Salesforce',
    ticker: 'CRM',
    sector: 'Agentic AI Platforms',
    tracks: ['cognitive', 'agentic'],
    rationale: 'Agentforce replaces white-collar workflow workers. Already displacing customer service and sales support roles at scale.',
    confidence: 'High',
  },
  {
    name: 'Thomson Reuters',
    ticker: 'TRI',
    sector: 'Legal AI',
    tracks: ['cognitive'],
    rationale: 'Owns Westlaw and CoCounsel. Legal AI displacement flows directly through their platform.',
    confidence: 'High',
  },
  {
    name: 'Palantir',
    ticker: 'PLTR',
    sector: 'Enterprise AI',
    tracks: ['cognitive', 'agentic'],
    rationale: 'AIP platform automates analyst and operations roles at government and enterprise clients.',
    confidence: 'Medium',
  },
  {
    name: 'Constellation Energy',
    ticker: 'CEG',
    sector: 'Data Center Power',
    tracks: ['cognitive', 'agentic'],
    rationale: 'Nuclear power for AI data centers. Every AI workload requires reliable baseload power.',
    confidence: 'Medium',
  },
  {
    name: 'Symbotic',
    ticker: 'SYM',
    sector: 'Warehouse Robotics',
    tracks: ['robotics'],
    rationale: 'Automates warehouse and fulfillment operations. Direct displacement of warehouse worker roles.',
    confidence: 'Medium',
  },
  {
    name: 'Intuitive Surgical',
    ticker: 'ISRG',
    sector: 'Surgical Robotics',
    tracks: ['robotics'],
    rationale: 'Robotic surgery systems augment and eventually reduce surgical support staffing requirements.',
    confidence: 'Medium',
  },
  {
    name: 'Accenture',
    ticker: 'ACN',
    sector: 'AI Implementation',
    tracks: ['cognitive', 'agentic'],
    rationale: 'Consulted by every major corporation on AI deployment. Profits from the transition regardless of direction.',
    confidence: 'Medium',
  },
  {
    name: 'Workday',
    ticker: 'WDAY',
    sector: 'HR and Finance AI',
    tracks: ['cognitive'],
    rationale: 'HR and finance automation platform. Directly reduces headcount in administrative functions.',
    confidence: 'Speculative',
  },
]

const HEADWINDS: Headwind[] = [
  {
    name: 'Staffing Agencies',
    tickers: 'MAN · RHI · KELYA',
    sector: 'Human Capital',
    tracks: ['cognitive', 'agentic'],
    rationale: 'Business model is placing workers. AI reduces demand for contingent workers across white-collar categories.',
    confidence: 'High',
  },
  {
    name: 'Traditional Legal Services',
    sector: 'Legal',
    tracks: ['cognitive'],
    rationale: 'Partner-heavy law firms face margin compression as AI handles document review, discovery, and first drafts. No direct pure-play public ticker exists yet — this is sector-level analysis.',
    confidence: 'High',
  },
  {
    name: 'Regional Banks in high-displacement counties',
    sector: 'Financial Services',
    tracks: ['cognitive'],
    rationale: 'Consumer loan and deposit base shrinks as middle-income employment erodes in high-displacement counties.',
    confidence: 'Medium',
  },
  {
    name: 'Commercial Real Estate',
    sector: 'Real Estate',
    tracks: ['cognitive', 'agentic'],
    rationale: 'Office demand declining as white-collar headcount falls. Middle-market CRE REITs most exposed.',
    confidence: 'Medium',
  },
  {
    name: 'For-profit Education',
    sector: 'Education',
    tracks: ['cognitive', 'agentic'],
    rationale: 'Credential value disrupted by AI skill alternatives. Student enrollment under pressure as job market shifts.',
    confidence: 'Speculative',
  },
]

const TRACK_LABELS: Record<Track, string> = {
  cognitive: 'Cognitive AI',
  robotics: 'Industrial Robotics',
  agentic: 'Agentic AI',
  offshoring: 'Offshoring',
}

const TRACK_COLORS: Record<Track, string> = {
  cognitive: 'var(--accent)',
  robotics: '#f97316',
  agentic: '#8b5cf6',
  offshoring: 'var(--amber)',
}

const FILTER_OPTIONS: Array<{ value: FilterTrack; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'cognitive', label: 'Cognitive AI' },
  { value: 'robotics', label: 'Industrial Robotics' },
  { value: 'agentic', label: 'Agentic AI' },
  { value: 'offshoring', label: 'Offshoring' },
]

interface Props {
  /** company_displacement.json companies, used for the documented-events badge */
  companyData?: Array<{ name?: string; displacement_events?: unknown[] }>
  /** Called when a user clicks a documented-events badge — routes to News tab filtered to that company */
  onShowCompanyInNews?: (companyName: string) => void
}

export default function MarketImplications({ companyData = [], onShowCompanyInNews }: Props) {
  const [filter, setFilter] = useState<FilterTrack>('all')

  const matchesFilter = (tracks: Track[]) =>
    filter === 'all' || tracks.includes(filter as Track)

  const beneficiaries = BENEFICIARIES.filter(b => matchesFilter(b.tracks))
  const headwinds = HEADWINDS.filter(h => matchesFilter(h.tracks))

  // Pre-compute a case-insensitive map: companyNameLower → event count, for the badge.
  const eventCountByCompany = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of companyData) {
      if (!c?.name) continue
      m.set(c.name.toLowerCase(), (c.displacement_events?.length) ?? 0)
    }
    return m
  }, [companyData])

  const findEventCount = (companyName: string): number => {
    const key = companyName.toLowerCase()
    if (eventCountByCompany.has(key)) return eventCountByCompany.get(key)!
    for (const [k, v] of eventCountByCompany) {
      if (k.includes(key) || key.includes(k)) return v
    }
    return 0
  }

  return (
    <div style={wrapStyle}>
      {/* Disclaimer */}
      <div style={disclaimerStyle}>
        <div style={disclaimerHeaderStyle}>
          STRUCTURAL MACRO ANALYSIS ONLY — NOT INVESTMENT ADVICE
        </div>
        <div style={disclaimerBodyStyle}>
          This section identifies companies structurally positioned to benefit or face headwinds from
          AI workforce displacement trends. This is long-horizon macro analysis, not a recommendation
          to buy or sell any security. Past performance does not predict future results. Always
          consult a licensed financial advisor before making investment decisions.
        </div>
      </div>

      {/* Map connection callout */}
      <div style={mapCalloutStyle}>
        These companies appear on the displacement map. Toggle <em>Company displacement dots</em> on
        the Map tab to see their office locations and documented job impacts.
      </div>

      {/* Filter bar */}
      <div style={filterBarStyle}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={pillStyle(filter === opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Section A — Beneficiaries */}
      <SectionHeader
        eyebrow="Where the money goes"
        title="Structural Beneficiaries"
        subtitle="Every dollar saved on labor gets reinvested somewhere. These companies capture that flow."
      />
      {beneficiaries.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={gridStyle}>
          {beneficiaries.map(b => (
            <BeneficiaryCard
              key={b.ticker + b.name}
              b={b}
              eventCount={findEventCount(b.name)}
              onShowInNews={onShowCompanyInNews}
            />
          ))}
        </div>
      )}

      {/* Section B — Headwinds */}
      <SectionHeader
        eyebrow="Where the money leaves"
        title="Structural Headwinds"
        subtitle="These sectors face long-horizon pressure from displacement of their core customer base or business model."
        marginTop={34}
      />
      {headwinds.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={gridStyle}>
          {headwinds.map(h => (
            <HeadwindCard key={h.name} h={h} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Sub-components ----------

function SectionHeader({ eyebrow, title, subtitle, marginTop = 12 }: {
  eyebrow: string; title: string; subtitle: string; marginTop?: number
}) {
  return (
    <div style={{ marginTop, marginBottom: 16 }}>
      <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 4 }}>
        {eyebrow}
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 720 }}>
        {subtitle}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      border: '1px dashed var(--border)', borderRadius: 6,
      padding: '24px 12px', textAlign: 'center',
      color: 'var(--text-muted)', fontSize: 13,
    }}>
      No companies match the current filter.
    </div>
  )
}

function BeneficiaryCard({ b, eventCount, onShowInNews }: {
  b: Beneficiary
  eventCount: number
  onShowInNews?: (name: string) => void
}) {
  return (
    <article style={cardStyle('beneficiary')}>
      <header style={cardHeaderStyle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={companyLineStyle}>
            <span style={nameStyle}>{b.name}</span>
            <span className="data-value" style={tickerStyle}>{b.ticker}</span>
          </div>
          <div style={sectorStyle}>{b.sector}</div>
        </div>
        <ConfidenceBadge level={b.confidence} />
      </header>

      <div style={trackPillRowStyle}>
        {b.tracks.map(t => (
          <span key={t} style={trackPillStyle(t)}>{TRACK_LABELS[t]}</span>
        ))}
      </div>

      <p style={rationaleStyle}>{b.rationale}</p>

      {eventCount > 0 && (
        <button
          onClick={() => onShowInNews?.(b.name)}
          style={eventsBadgeStyle}
        >
          {eventCount} documented displacement event{eventCount === 1 ? '' : 's'} →
        </button>
      )}

      <div style={microDisclaimerStyle}>Not investment advice.</div>
    </article>
  )
}

function HeadwindCard({ h }: { h: Headwind }) {
  return (
    <article style={cardStyle('headwind')}>
      <header style={cardHeaderStyle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={companyLineStyle}>
            <span style={nameStyle}>{h.name}</span>
            {h.tickers && (
              <span className="data-value" style={{ ...tickerStyle, color: 'var(--text-muted)' }}>
                {h.tickers}
              </span>
            )}
          </div>
          <div style={sectorStyle}>{h.sector}</div>
        </div>
        <ConfidenceBadge level={h.confidence} />
      </header>

      <div style={trackPillRowStyle}>
        {h.tracks.map(t => (
          <span key={t} style={trackPillStyle(t)}>{TRACK_LABELS[t]}</span>
        ))}
      </div>

      <p style={rationaleStyle}>{h.rationale}</p>

      <div style={microDisclaimerStyle}>Not investment advice.</div>
    </article>
  )
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  const color = level === 'High' ? 'var(--success)'
    : level === 'Medium' ? 'var(--amber)' : 'var(--danger)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      color, border: `1px solid ${color}`, borderRadius: 3,
      padding: '3px 6px',
      flexShrink: 0,
      background: 'transparent',
    }}>
      {level}
    </span>
  )
}

// ---------- Styles ----------

const wrapStyle: React.CSSProperties = {
  padding: '20px 24px 40px',
  maxWidth: 1400,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box',
}

const disclaimerStyle: React.CSSProperties = {
  border: '1px solid var(--amber)',
  background: 'rgba(245, 158, 11, 0.06)',
  borderRadius: 6,
  padding: '12px 16px',
  marginBottom: 12,
}

const disclaimerHeaderStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  color: 'var(--amber)', marginBottom: 6,
}

const disclaimerBodyStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
}

const mapCalloutStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderLeft: '3px solid var(--accent)',
  borderRadius: 4,
  padding: '8px 14px',
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 18,
}

const filterBarStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6,
  padding: 6,
  background: 'var(--bg-inset)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  marginBottom: 22,
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: 12, fontWeight: 500,
    borderRadius: 4,
    background: active ? 'var(--bg-panel-hover)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'background var(--motion-fast), color var(--motion-fast)',
  }
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 14,
}

function cardStyle(kind: 'beneficiary' | 'headwind'): React.CSSProperties {
  const accent = kind === 'beneficiary' ? 'var(--accent)' : '#f97316'
  return {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${accent}`,
    borderRadius: 6,
    padding: 16,
    display: 'flex', flexDirection: 'column',
    minHeight: 220,
  }
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  gap: 8, marginBottom: 10,
}

const companyLineStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 8,
  flexWrap: 'wrap',
}

const nameStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
  lineHeight: 1.2,
}

const tickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11,
  color: 'var(--text-muted)',
  letterSpacing: '0.04em',
}

const sectorStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const trackPillRowStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 4,
  marginBottom: 10,
}

function trackPillStyle(track: Track): React.CSSProperties {
  const color = TRACK_COLORS[track]
  return {
    fontSize: 10, fontWeight: 500,
    padding: '2px 7px', borderRadius: 3,
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color,
  }
}

const rationaleStyle: React.CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: 1.5,
  color: 'var(--text-secondary)',
  flex: 1,
}

const eventsBadgeStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: 12,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  padding: '5px 10px',
  color: 'var(--amber)',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background var(--motion-fast), border-color var(--motion-fast)',
}

const microDisclaimerStyle: React.CSSProperties = {
  fontSize: 9, fontStyle: 'italic',
  color: 'var(--text-dim)',
  marginTop: 12,
  paddingTop: 8,
  borderTop: '1px solid var(--border)',
}
