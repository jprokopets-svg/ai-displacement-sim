import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  width?: number
}

export default function RightPanel({ children, width }: Props) {
  return (
    <aside style={{ ...style, width: width ?? 'var(--right-panel-width)' }}>
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
