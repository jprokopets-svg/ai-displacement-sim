import { type ReactNode, useState, useEffect } from 'react'

interface Props {
  children: ReactNode
  width?: number
}

const STORAGE_KEY = 'rightpanel-collapsed'

export default function RightPanel({ children, width }: Props) {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1')

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, hidden ? '1' : '0')
  }, [hidden])

  if (hidden) {
    return (
      <button onClick={() => setHidden(false)} style={showBtnRight} title="Show panel">
        ‹
      </button>
    )
  }

  return (
    <aside style={{ ...panelStyle, width: width ?? 320 }}>
      <button onClick={() => setHidden(true)} style={hideBtnTopLeft} title="Hide panel">
        ›
      </button>
      <div style={{ ...contentStyle, paddingTop: 36 }}>{children}</div>
    </aside>
  )
}

const panelStyle: React.CSSProperties = {
  flexShrink: 0,
  background: 'var(--bg-elevated)',
  height: '100%',
  position: 'relative',
}

const contentStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
}

const hideBtnTopLeft: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 10,
  width: 24,
  height: 24,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-muted)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

const showBtnRight: React.CSSProperties = {
  position: 'fixed',
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 50,
  width: 24,
  height: 48,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: '4px 0 0 4px',
  color: 'var(--text-muted)',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}
