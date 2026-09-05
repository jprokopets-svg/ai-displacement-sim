import { useEffect, useState } from 'react'
import USMap from './components/USMap'
import type { CountyScore } from './components/USMap'
import JobSearch from './components/JobSearch'
import { fetchCounties } from './utils/api'
import { SITE_CONFIG } from './config/site'

export default function App() {
  const [counties, setCounties] = useState<CountyScore[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCounties()
      .then(data => setCounties(data.counties))
      .catch(e => setError(e.message))
  }, [])

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>{SITE_CONFIG.name}</h1>
      <p style={{ fontSize: 14, color: '#333', marginTop: 4 }}>
        AI exposure by US county and occupation.
      </p>

      <section style={{ marginTop: 24 }}>
        <JobSearch />
      </section>

      <section style={{ marginTop: 28 }}>
        {error
          ? <p style={{ color: '#b00' }}>Could not load county data: {error}</p>
          : <USMap counties={counties} />}
      </section>

      <footer style={footerStyle}>
        County and occupation exposure scores derived from Eloundou et al. 2024
        GPT-4 task exposure, with O*NET 29.1 and BLS employment data.
      </footer>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '32px 16px 48px',
}

const footerStyle: React.CSSProperties = {
  marginTop: 32,
  paddingTop: 12,
  borderTop: '1px solid #ddd',
  fontSize: 12,
  color: '#555',
}
