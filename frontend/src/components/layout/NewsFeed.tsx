import { useMemo, useState } from 'react'
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

export default function NewsFeed({ companies, filterCompany, onClearFilter }: Props) {
  const [search, setSearch] = useState('')

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
    const q = search.trim().toLowerCase()
    const filtered = q
      ? all.filter(it =>
          (it.company || '').toLowerCase().includes(q) ||
          (it.sector || '').toLowerCase().includes(q) ||
          (it.description || '').toLowerCase().includes(q),
        )
      : all
    filtered.sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1))
    return filtered
  }, [companies, filterCompany, search])

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

      {items.length === 0 ? (
        <div style={emptyStyle}>No events match the current filter.</div>
      ) : (
        <div style={gridStyle}>
          {items.map((it, i) => <Card key={i} item={it} />)}
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
        <p style={descriptionStyle}>{item.description}</p>
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

const sourceLinkStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--accent)',
  textDecoration: 'none',
  fontWeight: 500,
}
