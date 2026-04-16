import MyRisk from './MyRisk'
import { SITE_CONFIG } from '../config/site'

export default function EmbedPage() {
  return (
    <div style={wrapStyle}>
      <MyRisk companyData={[]} />
      <footer style={footerStyle}>
        <a
          href="https://ai-displacement-sim-4x9g.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          Powered by {SITE_CONFIG.name}
        </a>
      </footer>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  maxWidth: 600,
  margin: '0 auto',
  padding: '16px 16px 8px',
  minHeight: '100vh',
  background: 'var(--bg-primary)',
  boxSizing: 'border-box',
}

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '16px 0 12px',
  borderTop: '1px solid var(--border)',
  marginTop: 12,
}

const linkStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textDecoration: 'none',
}
