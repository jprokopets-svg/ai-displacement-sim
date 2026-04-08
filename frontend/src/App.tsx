import { useEffect, useState, useCallback, useMemo } from 'react'
import USMap from './components/USMap'
import WorldMap from './components/WorldMap'
import CountyDetailPanel from './components/CountyDetailPanel'
import SimulationPanel from './components/SimulationPanel'
import JobSearch from './components/JobSearch'
import ControlPanel from './components/ControlPanel'
import type { ScenarioState } from './components/ControlPanel'
import { fetchCounties, fetchCountries, fetchOverlays, fetchCompanyDisplacement } from './utils/api'
import { applyScenarioModifiers } from './utils/scenarios'
import DebugPanel from './components/DebugPanel'

type Tab = 'map' | 'simulate' | 'job'
type MapView = 'us' | 'world'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
  is_estimated?: boolean
}

export default function App() {
  const [tab, setTab] = useState<Tab>('map')
  const [mapView, setMapView] = useState<MapView>('us')
  const [scenario, setScenario] = useState<ScenarioState>({
    year: 2025,
    feedbackAggressiveness: 0.5,
    tradePolicy: 'current',
    govtResponse: 'none',
    corporateProfit: 'baseline',
    equityLoop: 'intact',
    fedResponse: 'hold',
    mapLayer: 'composite',
    showCompanyDots: false,
    showReshoringParadox: false,
    showTransferDependency: false,
    showKshapeDivergence: false,
  })
  const updateScenario = useCallback((updates: Partial<ScenarioState>) => {
    setScenario(prev => ({ ...prev, ...updates }))
  }, [])
  const [baseCounties, setBaseCounties] = useState<CountyScore[]>([])
  const [countries, setCountries] = useState<Record<string, unknown>[]>([])
  const [overlays, setOverlays] = useState<Record<string, Record<string, Record<string, unknown>>>>({})
  const [companyData, setCompanyData] = useState<Record<string, unknown>[]>([])
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchCounties().then(data => setBaseCounties(data.counties)),
      fetchCountries().then(data => setCountries(data.countries)).catch(() => {}),
      fetchOverlays().then(setOverlays).catch(() => {}),
      fetchCompanyDisplacement().then(data => setCompanyData(data.companies || [])).catch(() => {}),
    ])
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Apply scenario modifiers to base county scores (client-side, instant)
  const counties = useMemo(
    () => applyScenarioModifiers(baseCounties, scenario),
    [baseCounties, scenario],
  )

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
            {mapView === 'us' ? 'US county-level' : 'International'} AI exposure with Monte Carlo scenario modeling
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
            Loading data...
          </div>
        )}

        {error && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ color: 'var(--danger)', marginBottom: 8 }}>Failed to load data</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {error}. Make sure the backend is running and the data pipeline has been executed.
            </div>
          </div>
        )}

        {!loading && !error && tab === 'map' && (
          <div style={{ position: 'relative', height: 'calc(100vh - 70px)' }}>
            {/* Control Panel */}
            <ControlPanel state={scenario} onChange={updateScenario} />

            {/* US / World toggle (top center) */}
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              zIndex: 50, display: 'flex', gap: 2,
              background: 'var(--bg-panel)', borderRadius: 6,
              border: '1px solid var(--border)', padding: 2,
            }}>
              {(['us', 'world'] as MapView[]).map(v => (
                <button
                  key={v}
                  onClick={() => { setMapView(v); setSelectedCounty(null) }}
                  style={{
                    padding: '4px 12px', borderRadius: 4, border: 'none',
                    background: mapView === v ? 'var(--accent)' : 'transparent',
                    color: mapView === v ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}
                >
                  {v === 'us' ? 'US Counties' : 'World'}
                </button>
              ))}
            </div>

            {mapView === 'us' ? (
              <>
                <USMap
                  counties={counties}
                  onCountyClick={handleCountyClick}
                  year={scenario.year}
                  selectedCounty={selectedCounty}
                  overlays={overlays}
                  companyData={companyData}
                  scenario={scenario}
                />
                {selectedCounty && (
                  <CountyDetailPanel
                    countyFips={selectedCounty}
                    year={scenario.year}
                    onClose={() => setSelectedCounty(null)}
                  />
                )}
              </>
            ) : (
              <WorldMap countries={countries as never[]} />
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
          Data: O*NET 29.1, BLS OEWS/QCEW 2024, OECD/ILO occupation statistics
        </span>
        <span>
          All outputs are probability distributions. See methodology for assumptions.
        </span>
      </footer>

      {/* Debug panel — shows scenario modifier deltas */}
      <DebugPanel
        scenario={scenario}
        baseCounties={baseCounties as never[]}
        adjustedCounties={counties as never[]}
      />
    </>
  )
}
