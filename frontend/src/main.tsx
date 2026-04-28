import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import EmbedPage from './components/EmbedPage'
import StoryPage from './components/StoryPage'
import MobilePage from './components/MobilePage'
import MethodologyPage from './components/MethodologyPage'
import { SITE_CONFIG } from './config/site'
import './index.css'

document.title = SITE_CONFIG.name
const metaDesc = document.querySelector('meta[name="description"]') ?? document.head.appendChild(
  Object.assign(document.createElement('meta'), { name: 'description' }),
)
metaDesc.setAttribute('content', SITE_CONFIG.description)

const path = window.location.pathname.replace(/\/$/, '')
const isMobile = window.innerWidth < 768

function Root() {
  if (path === '/methodology') return <MethodologyPage />
  if (isMobile && (path === '/tool' || path === '')) return <MobilePage />
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
