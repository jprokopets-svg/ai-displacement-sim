import { useEffect, useState, useCallback } from 'react'
import USMap from './components/USMap'
import CountyPanel from './components/CountyPanel'
import SimulationPanel from './components/SimulationPanel'
import JobSearch from './components/JobSearch'
import { fetchCounties } from './utils/api'

type Tab = 'map' | 'simulate' | 'job'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
}

export default function App() {
  const [tab, setTab] = useState<Tab>('map')
  const [counties, setCounties] = useState<CountyScore[]>([])
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCounties()
      .then(data => setCounties(data.counties))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleCountyClick = useCallback((fips: string) => {
    setSelectedCounty(prev => prev === fips ? null : fips)
  }, [])

  return (
    <>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>AI Workforce Displacement Simulator</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            County-level AI exposure with Monte Carlo scenario modeling
          </p>
        </div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {(['map', 'simulate', 'job'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {t === 'job' ? 'Check My Job' : t === 'simulate' ? 'Simulate' : 'Map'}
            </button>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading county data...
          </div>
        )}

        {error && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ color: 'var(--danger)', marginBottom: 8 }}>Failed to load data</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {error}. Make sure the backend is running (uvicorn backend.app.main:app)
              and the data pipeline has been executed.
            </div>
          </div>
        )}

        {!loading && !error && tab === 'map' && (
          <div style={{ position: 'relative', height: 'calc(100vh - 70px)' }}>
            <USMap
              counties={counties}
              onCountyClick={handleCountyClick}
              selectedCounty={selectedCounty}
            />
            {selectedCounty && (
              <CountyPanel
                countyFips={selectedCounty}
                onClose={() => setSelectedCounty(null)}
              />
            )}
          </div>
        )}

        {tab === 'simulate' && <SimulationPanel />}
        {tab === 'job' && <JobSearch />}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '8px 24px',
        fontSize: 11,
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>
          Data: O*NET 29.1, Felten-Raj-Rock 2021, BLS OEWS/QCEW 2023
        </span>
        <span>
          All outputs are probability distributions. See methodology for assumptions.
        </span>
      </footer>
    </>
  )
}
