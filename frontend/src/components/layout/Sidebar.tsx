import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  width?: number
}

/** Left scenario-controls column. Controls get ported inside in a later step. */
export default function Sidebar({ children, width }: Props) {
  return (
    <aside style={{ ...style, width: width ?? 'var(--sidebar-width)' }}>
      {children}
    </aside>
  )
}

const style: React.CSSProperties = {
  flexShrink: 0,
  background: 'var(--bg-elevated)',
  overflowY: 'auto',
  overflowX: 'hidden',
  height: '100%',
}
