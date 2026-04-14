interface Props {
  lastUpdated?: string
  confidence?: 'high' | 'medium' | 'low'
}

export default function Footer({ lastUpdated, confidence = 'medium' }: Props) {
  const confColor =
    confidence === 'high' ? 'var(--success)' :
    confidence === 'low' ? 'var(--danger)' :
    'var(--amber)'

  return (
    <footer style={style}>
      <div style={groupStyle}>
        <span style={dimStyle}>Sources:</span>
        <span style={textStyle}>O*NET 29.1 · BLS OEWS/QCEW 2024 · Felten-Raj-Rock 2021 · IFR · World Bank</span>
      </div>
      <div style={groupStyle}>
        <a href="#" style={linkStyle} onClick={e => e.preventDefault()}>Methodology</a>
        <span style={sepStyle}>·</span>
        <span style={dimStyle}>Updated</span>
        <span className="data-value" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {lastUpdated ?? '—'}
        </span>
        <span style={sepStyle}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: confColor,
            boxShadow: `0 0 6px ${confColor}`,
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {confidence === 'high' ? 'High confidence' : confidence === 'low' ? 'Low confidence' : 'Med confidence'}
          </span>
        </span>
      </div>
    </footer>
  )
}

const style: React.CSSProperties = {
  height: 'var(--footer-height)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  background: 'var(--bg-elevated)',
  borderTop: '1px solid var(--border)',
  fontSize: 11,
  overflow: 'hidden',
}

const groupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const dimStyle: React.CSSProperties = { color: 'var(--text-dim)' }
const textStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const sepStyle: React.CSSProperties = { color: 'var(--text-dim)' }
const linkStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  borderBottom: '1px dotted var(--border-strong)',
}
