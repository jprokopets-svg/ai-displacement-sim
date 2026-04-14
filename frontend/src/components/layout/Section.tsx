import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  dense?: boolean
}

/** Sectioned panel block used inside Sidebar and RightPanel. */
export default function Section({ title, children, dense = false }: Props) {
  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <span className="eyebrow">{title}</span>
      </div>
      <div style={{ padding: dense ? '10px 16px' : '14px 16px' }}>
        {children}
      </div>
    </section>
  )
}

const sectionStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
}

const headerStyle: React.CSSProperties = {
  padding: '10px 16px 6px',
  background: 'var(--bg-inset)',
  borderBottom: '1px solid var(--border)',
}
