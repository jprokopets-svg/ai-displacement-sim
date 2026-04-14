import type { ReactNode } from 'react'

export type Tab = 'map' | 'simulate' | 'job' | 'market' | 'news'

const TAB_LABELS: Record<Tab, string> = {
  map: 'Map',
  simulate: 'Simulate',
  job: 'Check My Job',
  market: 'Market',
  news: 'News',
}

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
  ticker?: ReactNode
}

export default function Header({ tab, onTabChange, ticker }: Props) {
  return (
    <header style={headerStyle}>
      <div style={leftStyle}>
        <div style={logoStyle}>
          <div style={logoMarkStyle} />
          <div>
            <div style={titleStyle}>AI Displacement Simulator</div>
            <div style={subtitleStyle}>County-level exposure · Monte Carlo scenarios</div>
          </div>
        </div>
      </div>

      <div style={centerStyle}>{ticker}</div>

      <nav style={navStyle}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            style={tabButtonStyle(tab === t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>
    </header>
  )
}

const headerStyle: React.CSSProperties = {
  height: 'var(--header-height)',
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, auto) 1fr auto',
  alignItems: 'center',
  gap: 24,
  padding: '0 20px',
  background: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border)',
  zIndex: 100,
}

const leftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
}

const logoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const logoMarkStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  background: 'linear-gradient(135deg, var(--accent) 0%, #1e40af 100%)',
  boxShadow: '0 0 0 1px var(--border-accent)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--text-primary)',
  lineHeight: 1.2,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  lineHeight: 1.3,
  marginTop: 2,
}

const centerStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  background: 'var(--bg-inset)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 2,
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 4,
    background: active ? 'var(--bg-panel-hover)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none',
    transition: 'background var(--motion-fast), color var(--motion-fast)',
    whiteSpace: 'nowrap',
  }
}
