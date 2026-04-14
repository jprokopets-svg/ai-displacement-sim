import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/** Left scenario-controls column. Controls get ported inside in a later step. */
export default function Sidebar({ children }: Props) {
  return (
    <aside style={style}>
      {children}
    </aside>
  )
}

const style: React.CSSProperties = {
  width: 'var(--sidebar-width)',
  flexShrink: 0,
  background: 'var(--bg-elevated)',
  borderRight: '1px solid var(--border)',
  overflowY: 'auto',
  overflowX: 'hidden',
  height: '100%',
}
