import { useEffect, useMemo, useState } from 'react'
import { fetchSignals } from '../../utils/api'
import { trackForSector, colorForTrack } from '../../utils/trackClassifier'

type Company = {
  name: string
  sector: string
  ticker?: string
  downstream_impact?: string
  displacement_events?: DisplacementEvent[]
}

type DisplacementEvent = {
  date: string
  description?: string
  headcount_impact: number
  confidence_score: number
  source_url?: string
  source_type?: string
}

type FeedItem = DisplacementEvent & {
  company: string
  sector: string
  ticker?: string
  downstream_impact?: string
}

interface Props {
  companies: Company[]
  filterCompany?: string | null
  onClearFilter?: () => void
}

type SortBy = 'recent' | 'impactful' | 'confidence'
type ConfFilter = 'all' | 'high' | 'medium' | 'lower'
type TrackFilter = 'all' | 'cognitive' | 'robotics' | 'agentic' | 'offshoring'

interface Signal {
  id: number
  raw_text: string
  source_url?: string
  confidence: number
  found_at: string
  status: string
}

export default function NewsFeed({ companies, filterCompany, onClearFilter }: Props) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [confFilter, setConfFilter] = useState<ConfFilter>('all')
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all')
  const [signals, setSignals] = useState<Signal[]>([])

  useEffect(() => {
    fetchSignals()
      .then(d => setSignals((d.signals || []) as Signal[]))
      .catch(() => {})
  }, [])

  const items = useMemo<FeedItem[]>(() => {
    const all: FeedItem[] = []
    for (const c of companies || []) {
      if (filterCompany && c.name !== filterCompany) continue
      for (const ev of c.displacement_events || []) {
        all.push({
          ...ev,
          company: c.name,
          sector: c.sector,
          ticker: c.ticker,
          downstream_impact: c.downstream_impact,
        })
      }
    }

    let filtered = all

    // Text search
    const q = search.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(it =>
        (it.company || '').toLowerCase().includes(q) ||
        (it.sector || '').toLowerCase().includes(q) ||
        (it.description || '').toLowerCase().includes(q),
      )
    }

    // Track filter
    if (trackFilter !== 'all') {
      filtered = filtered.filter(it => {
        const t = trackForSector(it.sector).toLowerCase()
        return t.includes(trackFilter)
      })
    }

    // Confidence filter
    if (confFilter === 'high') filtered = filtered.filter(it => it.confidence_score >= 4)
    else if (confFilter === 'medium') filtered = filtered.filter(it => it.confidence_score === 3)
    else if (confFilter === 'lower') filtered = filtered.filter(it => it.confidence_score <= 2)

    // Sort
    if (sortBy === 'recent') filtered.sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1))
    else if (sortBy === 'impactful') filtered.sort((a, b) => (b.headcount_impact || 0) - (a.headcount_impact || 0))
    else filtered.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))

    return filtered
  }, [companies, filterCompany, search, sortBy, confFilter, trackFilter])

  const totalRoles = items.reduce((s, it) => s + (it.headcount_impact || 0), 0)

  return (
    <div style={containerStyle}>
      <div style={topBarStyle}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--amber)' }}>Displacement Feed</div>
          <h2 style={titleStyle}>
            {filterCompany ? filterCompany : 'All AI-driven workforce events'}
          </h2>
          <div style={metaStyle}>
            <span className="data-value" style={{ color: 'var(--text-primary)' }}>
              {items.length.toLocaleString()}
            </span>
            <span> events</span>
            <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>·</span>
            <span className="data-value" style={{ color: 'var(--text-primary)' }}>
              {totalRoles.toLocaleString()}
            </span>
            <span> roles</span>
            <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>·</span>
            <span>Sources: Reuters, WSJ, BLS WARN notices, SEC filings, company statements</span>
            <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Last updated: Apr 19, 2026</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {filterCompany && (
            <button onClick={onClearFilter} style={clearFilterStyle}>
              Clear filter ×
            </button>
          )}
          <input
            type="search"
            placeholder="Search company, sector…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
      </div>

      {/* Filter and sort bar */}
      <div style={filterBarStyle}>
        <FilterGroup label="Sort">
          {([['recent', 'Most recent'], ['impactful', 'Most impactful'], ['confidence', 'Highest confidence']] as const).map(([k, l]) => (
            <Pill key={k} active={sortBy === k} onClick={() => setSortBy(k)}>{l}</Pill>
          ))}
        </FilterGroup>
        <FilterGroup label="Track">
          {([['all', 'All'], ['cognitive', 'Cognitive AI'], ['robotics', 'Industrial Robotics'], ['agentic', 'Agentic AI'], ['offshoring', 'Offshoring']] as const).map(([k, l]) => (
            <Pill key={k} active={trackFilter === k} onClick={() => setTrackFilter(k)}>{l}</Pill>
          ))}
        </FilterGroup>
        <FilterGroup label="Confidence">
          {([['all', 'All'], ['high', 'High (C4-C5)'], ['medium', 'Medium (C3)'], ['lower', 'Lower (C1-C2)']] as const).map(([k, l]) => (
            <Pill key={k} active={confFilter === k} onClick={() => setConfFilter(k)}>{l}</Pill>
          ))}
        </FilterGroup>
      </div>

      {/* Verified events */}
      {items.length === 0 ? (
        <div style={emptyStyle}>No events match the current filter.</div>
      ) : (
        <div style={gridStyle}>
          {items.map((it, i) => <Card key={i} item={it} />)}
        </div>
      )}

      {/* Market Signals section — prediction markets + options activity */}
      {!filterCompany && <MarketSignals />}

      {/* Signal feed — unverified pipeline items */}
      {signals.length > 0 && !filterCompany && (
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ color: 'var(--text-muted)' }}>Signal Feed</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)' }}>
              Unverified — awaiting review
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              These headlines passed the NLP displacement filter but have not been manually verified.
              Treat as signals, not confirmed events.
            </div>
          </div>
          <div style={gridStyle}>
            {signals.map(s => <SignalCard key={s.id} signal={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ item }: { item: FeedItem }) {
  const track = trackForSector(item.sector)
  const trackColor = colorForTrack(track)
  const conf = item.confidence_score
  const confLabel =
    conf >= 4 ? 'High confidence' :
    conf >= 3 ? 'Moderate confidence' :
    'Low confidence'
  const confColor =
    conf >= 4 ? 'var(--danger)' :
    conf >= 3 ? 'var(--amber)' :
    'var(--text-muted)'

  return (
    <article style={cardStyle}>
      <header style={cardHeaderStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={companyStyle}>
            {item.company}
            {item.ticker && (
              <span style={tickerBadgeStyle}>{item.ticker}</span>
            )}
          </div>
          <div style={sectorStyle}>{item.sector}</div>
        </div>
        <div style={dateStyle}>{item.date}</div>
      </header>

      <div style={headcountRowStyle}>
        <div>
          {item.headcount_impact && item.headcount_impact > 0 ? (
            <>
              <div className="data-value" style={headcountStyle}>
                {item.headcount_impact.toLocaleString()}
              </div>
              <div style={headcountLabelStyle}>roles impacted</div>
            </>
          ) : (
            <>
              <div style={{ ...headcountStyle, color: 'var(--text-muted)', fontSize: 18 }}>
                Undisclosed
              </div>
              <div style={headcountLabelStyle}>headcount not reported</div>
            </>
          )}
        </div>
        <div style={{
          padding: '4px 8px', borderRadius: 3,
          background: `${trackColor}22`,
          border: `1px solid ${trackColor}55`,
          fontSize: 11, fontWeight: 500, color: trackColor,
          alignSelf: 'flex-start',
        }}>
          {track}
        </div>
      </div>

      {item.description && (
        <p style={descriptionStyle}>{cleanDescription(item.description)}</p>
      )}

      {item.downstream_impact && (
        <div style={downstreamWrapStyle}>
          <div style={downstreamLabelStyle}>Downstream Impact</div>
          <p style={downstreamTextStyle}>{item.downstream_impact}</p>
        </div>
      )}

      <footer style={cardFooterStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: confColor,
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {confLabel} · C{conf}
          </span>
        </span>
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={sourceLinkStyle}
          >
            {item.source_type || 'Source'} →
          </a>
        )}
      </footer>
    </article>
  )
}

const containerStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  height: '100%',
  overflow: 'auto',
  padding: '24px 28px',
  background: 'var(--bg-primary)',
}

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: '1px solid var(--border)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginTop: 4,
  letterSpacing: '-0.01em',
}

const metaStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginTop: 6,
}

const clearFilterStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 11,
  color: 'var(--text-secondary)',
  background: 'var(--bg-panel-hover)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
}

const emptyStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: 13,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  transition: 'border-color var(--motion-fast)',
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
}

const companyStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}

const tickerBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-strong)',
  padding: '1px 6px',
  borderRadius: 2,
  letterSpacing: '0.02em',
}

const sectorStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginTop: 2,
}

const dateStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  flexShrink: 0,
}

const headcountRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
}

const headcountStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 500,
  color: 'var(--danger)',
  lineHeight: 1.1,
}

const headcountLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginTop: 2,
}

const descriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}

const downstreamWrapStyle: React.CSSProperties = {
  paddingTop: 10,
  borderTop: '1px solid var(--border)',
}

const downstreamLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--amber)',
  marginBottom: 4,
}

const downstreamTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
  fontStyle: 'italic',
}

const cardFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: 10,
  borderTop: '1px solid var(--border)',
}

function cleanDescription(raw: string): string {
  let s = raw
    .replace(/&[a-zA-Z]+;/g, m => {
      const map: Record<string, string> = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
        '&apos;': "'", '&ndash;': '–', '&mdash;': '—', '&nbsp;': ' ',
        '&ldquo;': '\u201C', '&rdquo;': '\u201D', '&lsquo;': '\u2018',
        '&rsquo;': '\u2019', '&hellip;': '…',
      }
      return map[m] || m
    })
    .replace(/&#\d+;/g, m => String.fromCharCode(Number(m.slice(2, -1))))
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > 200) s = s.slice(0, 197) + '…'
  return s
}

const sourceLinkStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--accent)',
  textDecoration: 'none',
  fontWeight: 500,
}

// ---------- Filter bar components ----------

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4, flexShrink: 0 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        background: active ? 'var(--bg-panel-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  padding: '8px 10px',
  background: 'var(--bg-inset)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  marginBottom: 18,
}

// ---------- Signal card ----------

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <article style={signalCardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>
          {signal.raw_text}
        </div>
        <span style={unverifiedBadgeStyle}>UNVERIFIED</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>
          C{signal.confidence}
          <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>·</span>
          {signal.found_at?.slice(0, 10) || '—'}
        </span>
        {signal.source_url && (
          <a
            href={signal.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}
          >
            Source →
          </a>
        )}
      </div>
    </article>
  )
}

const signalCardStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px dashed var(--border)',
  borderRadius: 6,
  padding: 14,
}

const unverifiedBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: 'var(--amber)',
  border: '1px solid var(--amber)',
  borderRadius: 3,
  padding: '2px 6px',
  flexShrink: 0,
}

// ---------- Market Signals section ----------

interface PolymarketEntry {
  question: string
  probability: number
  volume: string
  closingDate: string
}

interface OptionsEntry {
  company: string
  ticker: string
  activity: string
  relevance: string
}

const SEEDED_POLYMARKET: PolymarketEntry[] = [
  { question: 'US unemployment above 5% before 2028?', probability: 0.32, volume: '$2.1M', closingDate: '2028-01-01' },
  { question: 'Major US tech company lays off >10,000 in 2026?', probability: 0.74, volume: '$890K', closingDate: '2026-12-31' },
  { question: 'US GDP growth below 1% for any quarter in 2026?', probability: 0.28, volume: '$1.4M', closingDate: '2026-12-31' },
  { question: 'Federal AI regulation bill passes before 2027?', probability: 0.18, volume: '$540K', closingDate: '2027-01-01' },
  { question: 'Autonomous trucks operating on >5 US corridors by end of 2027?', probability: 0.62, volume: '$320K', closingDate: '2027-12-31' },
]

const SEEDED_OPTIONS: OptionsEntry[] = [
  { company: 'ManpowerGroup', ticker: 'MAN', activity: 'Unusual put volume at $55 strike, 3x avg', relevance: 'Staffing agency — bearish bets align with displacement headwind thesis' },
  { company: 'Nvidia', ticker: 'NVDA', activity: 'Call sweep $180 Jan 2027, $4.2M notional', relevance: 'AI infrastructure beneficiary — large upside bets on continued GPU demand' },
  { company: 'Robert Half', ticker: 'RHI', activity: 'Put/call ratio 2.8x (bearish), elevated OI', relevance: 'Staffing agency — options market pricing in AI displacement of temp workers' },
]

function MarketSignals() {
  const [polyData, setPolyData] = useState<PolymarketEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('https://gamma-api.polymarket.com/markets?limit=20&closed=false&tag=ai')
      .then(r => r.json())
      .then((data: Array<Record<string, unknown>>) => {
        if (cancelled) return
        const relevant = (data || [])
          .filter(m => {
            const q = ((m.question as string) || '').toLowerCase()
            return q.includes('job') || q.includes('unemploy') || q.includes('layoff')
              || q.includes('ai') || q.includes('automat') || q.includes('displac')
              || q.includes('workforce')
          })
          .slice(0, 5)
          .map(m => ({
            question: (m.question as string) || '',
            probability: parseFloat(String(m.outcomePrices || '0.5')),
            volume: `$${Math.round(parseFloat(String(m.liquidity || 0)) / 1000)}K`,
            closingDate: ((m.endDate as string) || '').slice(0, 10),
          }))
        if (relevant.length >= 2) {
          setPolyData(relevant)
        } else {
          setPolyData(null)
        }
      })
      .catch(() => { if (!cancelled) setPolyData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const markets = polyData ?? SEEDED_POLYMARKET
  const isLive = polyData !== null

  return (
    <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <div style={{ marginBottom: 14 }}>
        <div className="eyebrow" style={{ color: '#8b5cf6' }}>Market Signals</div>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-primary)' }}>
          Prediction Markets &amp; Options Activity
        </h3>
        <div style={mktDisclaimerStyle}>
          Market signals are not investment advice. Prediction market probabilities reflect crowd
          sentiment, not guaranteed outcomes. Options activity reflects institutional positioning,
          not directional certainty.
        </div>
      </div>

      {/* Prediction markets */}
      <div style={mktSubheadStyle}>
        Prediction Markets
        {!isLive && !loading && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8, fontWeight: 400 }}>
            · Curated seed data — live Polymarket integration pending
          </span>
        )}
        {loading && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8, fontWeight: 400 }}>
            · Connecting to market data…
          </span>
        )}
      </div>
      <div style={gridStyle}>
        {markets.map((m, i) => (
          <div key={i} style={mktCardStyle}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 8 }}>
              {m.question}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="data-value" style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 22, fontWeight: 500,
                color: m.probability > 0.6 ? 'var(--amber)' : m.probability < 0.4 ? 'var(--success)' : 'var(--text-primary)',
              }}>
                {Math.round(m.probability * 100)}%
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {m.volume} · closes {m.closingDate}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Options activity */}
      <div style={{ ...mktSubheadStyle, marginTop: 20 }}>
        Options Activity — Displacement-Relevant Names
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8, fontWeight: 400 }}>
          · Curated seed data — live Unusual Whales integration pending
        </span>
      </div>
      <div style={gridStyle}>
        {SEEDED_OPTIONS.map((o, i) => (
          <div key={i} style={mktCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{o.company}</span>
                <span className="data-value" style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 8,
                }}>{o.ticker}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 4 }}>{o.activity}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{o.relevance}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const mktDisclaimerStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  marginTop: 6,
  padding: '6px 10px',
  background: 'rgba(139, 92, 246, 0.06)',
  border: '1px solid rgba(139, 92, 246, 0.2)',
  borderRadius: 4,
}

const mktSubheadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  marginBottom: 10,
}

const mktCardStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderLeft: '3px solid #8b5cf6',
  borderRadius: 6,
  padding: 14,
}
