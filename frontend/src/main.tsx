import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import EmbedPage from './components/EmbedPage'
import StoryPage from './components/StoryPage'
import { SITE_CONFIG } from './config/site'
import './index.css'

document.title = SITE_CONFIG.name
const metaDesc = document.querySelector('meta[name="description"]') ?? document.head.appendChild(
  Object.assign(document.createElement('meta'), { name: 'description' }),
)
metaDesc.setAttribute('content', SITE_CONFIG.description)

const path = window.location.pathname.replace(/\/$/, '')
const isMobile = window.innerWidth < 768

function MobileLanding() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0e1a', color: '#e6ebf5',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px', textAlign: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#f59e0b', marginBottom: 12, textTransform: 'uppercase' as const }}>
          AI DISPLACEMENT SIMULATOR
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2 }}>
          Built for desktop
        </h1>
        <p style={{ fontSize: 15, color: '#9aa6be', lineHeight: 1.6, margin: '0 0 28px' }}>
          The interactive model requires a larger screen to render the county-level map and run Monte Carlo simulations. It's best viewed on a laptop or desktop browser.
        </p>
        <div style={{
          background: '#141b30', border: '1px solid #1f2942', borderRadius: 8,
          padding: '16px 20px', marginBottom: 24, textAlign: 'left',
        }}>
          <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 8 }}>
            KEY FINDING
          </div>
          <p style={{ fontSize: 14, color: '#e6ebf5', margin: 0, lineHeight: 1.5 }}>
            The top 5 most AI-exposed counties in America are all in the DC metro — not the Rust Belt. 351,828 documented jobs affected across 78 companies.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href="mailto:jprokopets@gmail.com?subject=Remind%20me%20about%20yourjobrisk.com" style={{
            display: 'block', padding: '14px 20px', background: '#3b82f6', color: '#fff',
            borderRadius: 6, fontSize: 15, fontWeight: 600, textDecoration: 'none',
          }}>
            Email me a reminder
          </a>
          <a href="https://jakeprokopets.substack.com/p/why-the-most-ai-exposed-counties" style={{
            display: 'block', padding: '14px 20px', background: 'transparent',
            color: '#e6ebf5', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6, fontSize: 15, fontWeight: 600, textDecoration: 'none',
          }}>
            Read the methodology
          </a>
        </div>
        <p style={{ fontSize: 12, color: '#5e6a85', marginTop: 24, lineHeight: 1.5 }}>
          Visit <strong style={{ color: '#9aa6be' }}>yourjobrisk.com</strong> on a desktop device to use the full interactive tool.
        </p>
      </div>
    </div>
  )
}

function Root() {
  if (isMobile && (path === '/tool' || path === '')) return <MobileLanding />
  if (path === '/tool') return <App />
  if (path === '/embed') return <EmbedPage />
  if (path === '/story') return <StoryPage />
  if (path === '') return <StoryPage />
  return <StoryPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
    <Analytics />
  </StrictMode>,
)
