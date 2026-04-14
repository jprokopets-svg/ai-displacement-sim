import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default function RightPanel({ children }: Props) {
  return (
    <aside style={style}>
      {children}
    </aside>
  )
}

const style: React.CSSProperties = {
  width: 'var(--right-panel-width)',
  flexShrink: 0,
  background: 'var(--bg-elevated)',
  borderLeft: '1px solid var(--border)',
  overflowY: 'auto',
  overflowX: 'hidden',
  height: '100%',
}
