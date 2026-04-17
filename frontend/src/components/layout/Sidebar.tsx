import { type ReactNode, useState, useEffect } from 'react'

interface Props {
  children: ReactNode
  width?: number
}

const STORAGE_KEY = 'sidebar-collapsed'

export default function Sidebar({ children, width }: Props) {
  const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1')

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <aside style={{
      ...baseStyle,
      width: collapsed ? 36 : (width ?? 280),
      minWidth: collapsed ? 36 : undefined,
      transition: 'width 0.2s ease',
      position: 'relative',
    }}>
      {!collapsed && <div style={{ overflow: 'hidden', height: '100%', overflowY: 'auto' }}>{children}</div>}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          ...toggleStyle,
          right: -12,
        }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '›' : '‹'}
      </button>
    </aside>
  )
}

const baseStyle: React.CSSProperties = {
  flexShrink: 0,
  background: 'var(--bg-elevated)',
  height: '100%',
  overflow: 'hidden',
}

const toggleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 22,
  height: 40,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: '0 4px 4px 0',
  color: 'var(--text-muted)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  padding: 0,
}
