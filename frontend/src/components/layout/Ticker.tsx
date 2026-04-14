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
}

/**
 * Horizontal marquee of latest displacement events.
 * Sorted by event.date DESC, top 10, duplicated for seamless loop.
 */
export default function Ticker({ companies }: Props) {
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

  // Duplicate once so translate -50% loops seamlessly
  const loop = [...items, ...items]

  return (
    <div style={wrapperStyle}>
      <div style={labelStyle}>
        <span className="eyebrow" style={{ color: 'var(--amber)' }}>Live</span>
      </div>
      <div style={maskStyle}>
        <div className="ticker-track">
          {loop.map((it, i) => (
            <TickerEntry key={i} item={it} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TickerEntry({ item }: { item: TickerItem }) {
  const conf = item.confidence
  const color =
    conf >= 4 ? 'var(--danger)' :
    conf >= 3 ? 'var(--amber)' :
    'var(--text-muted)'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.company}</span>
      <Sep />
      <span className="data-value" style={{ color: 'var(--text-primary)' }}>
        {item.jobs.toLocaleString()} roles
      </span>
      <Sep />
      <span style={{ color: 'var(--text-secondary)' }}>{item.sector}</span>
      <Sep />
      <span style={{ color, fontSize: 11, fontWeight: 500 }}>
        C{conf}
      </span>
    </span>
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
  borderTop: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
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

const maskStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
  maskImage: 'linear-gradient(to right, transparent 0, black 32px, black calc(100% - 32px), transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 32px, black calc(100% - 32px), transparent 100%)',
}

const placeholderStyle: React.CSSProperties = {
  ...wrapperStyle,
  justifyContent: 'center',
}
