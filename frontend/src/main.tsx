import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SITE_CONFIG } from './config/site'
import './index.css'

document.title = SITE_CONFIG.name
const metaDesc = document.querySelector('meta[name="description"]') ?? document.head.appendChild(
  Object.assign(document.createElement('meta'), { name: 'description' }),
)
metaDesc.setAttribute('content', SITE_CONFIG.description)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
