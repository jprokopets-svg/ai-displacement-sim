import { useMemo } from 'react'

type Company = {
  name: string
  sector: string
  displacement_events?: DisplacementEvent[]
}

type DisplacementEvent = {
  date: string
  headcount_impact: number
  confidence_score: number
  description?: string
  source_type?: string
}

type TickerItem = {
  company: string
  sector: string
  jobs: number
  confidence: number
  date: string
}

interface Props {
  companies: Company[]
  onCompanyClick?: (companyName: string) => void
}

/**
 * Horizontal marquee of latest displacement events.
 * Sorted by event.date DESC, top 10, duplicated once for seamless loop.
 * Entries are clickable — parent handles navigation to the news feed.
 */
export default function Ticker({ companies, onCompanyClick }: Props) {
  const items = useMemo<TickerItem[]>(() => {
    const all: TickerItem[] = []
    for (const c of companies || []) {
      for (const ev of c.displacement_events || []) {
        if (!ev.headcount_impact) continue
        all.push({
          company: c.name,
          sector: c.sector,
          jobs: ev.headcount_impact,
          confidence: ev.confidence_score,
          date: ev.date,
        })
      }
    }
    all.sort((a, b) => (a.date < b.date ? 1 : -1))
    return all.slice(0, 10)
  }, [companies])

  if (items.length === 0) {
    return (
      <div style={placeholderStyle}>
        <span className="eyebrow" style={{ color: 'var(--text-dim)' }}>
          Loading displacement events…
        </span>
      </div>
    )
  }

  const loop = [...items, ...items]

  return (
    <div style={wrapperStyle}>
      <div style={labelStyle}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)',
          boxShadow: '0 0 6px var(--amber)', display: 'inline-block',
        }} />
        <span className="eyebrow" style={{ color: 'var(--amber)' }}>Live</span>
      </div>
      <div style={maskStyle}>
        <div className="ticker-track">
          {loop.map((it, i) => (
            <TickerEntry
              key={i}
              item={it}
              onClick={onCompanyClick ? () => onCompanyClick(it.company) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TickerEntry({ item, onClick }: { item: TickerItem; onClick?: () => void }) {
  const conf = item.confidence
  const confColor =
    conf >= 4 ? 'var(--danger)' :
    conf >= 3 ? 'var(--amber)' :
    'var(--text-muted)'
  const clickable = Boolean(onClick)

  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontSize: 12, padding: '2px 6px', borderRadius: 3,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background var(--motion-fast)',
        background: 'transparent',
      }}
      onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-panel-hover)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.company}</span>
      <Sep />
      <span className="data-value" style={{ color: 'var(--text-primary)' }}>
        {item.jobs.toLocaleString()} roles
      </span>
      <Sep />
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>{item.sector}</span>
      <Sep />
      <span style={{ color: confColor, fontSize: 11, fontWeight: 500 }}>C{conf}</span>
    </button>
  )
}

function Sep() {
  return <span style={{ color: 'var(--text-dim)' }}>·</span>
}

const wrapperStyle: React.CSSProperties = {
  height: 'var(--ticker-height)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '0 16px',
  background: 'var(--bg-inset)',
  borderRadius: 4,
  border: '1px solid var(--border)',
  overflow: 'hidden',
}

const labelStyle: React.CSSProperties = {
  flexShrink: 0,
  paddingRight: 12,
  borderRight: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const FADE_WIDTH = '72px'

const maskStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
  maskImage: `linear-gradient(to right, transparent 0, black ${FADE_WIDTH}, black calc(100% - ${FADE_WIDTH}), transparent 100%)`,
  WebkitMaskImage: `linear-gradient(to right, transparent 0, black ${FADE_WIDTH}, black calc(100% - ${FADE_WIDTH}), transparent 100%)`,
}

const placeholderStyle: React.CSSProperties = {
  ...wrapperStyle,
  justifyContent: 'center',
}
