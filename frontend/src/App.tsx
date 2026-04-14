import { useEffect, useState, useCallback, useMemo } from 'react'
import USMap from './components/USMap'
import WorldMap from './components/WorldMap'
import CountyDetailPanel from './components/CountyDetailPanel'
import SimulationPanel from './components/SimulationPanel'
import JobSearch from './components/JobSearch'
import ControlPanel from './components/ControlPanel'
import MarketImplications from './components/MarketImplications'
import type { ScenarioState } from './components/ControlPanel'
import { fetchCounties, fetchCountries, fetchOverlays, fetchCompanyDisplacement } from './utils/api'
import { applyScenarioModifiers } from './utils/scenarios'

import Header from './components/layout/Header'
import type { Tab } from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import RightPanel from './components/layout/RightPanel'
import Footer from './components/layout/Footer'
import Ticker from './components/layout/Ticker'
import DefaultRightPanel from './components/layout/DefaultRightPanel'

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
      fetchOverlays().then(data => setOverlays(data)).catch(e => console.error('[Overlays] failed:', e)),
      fetchCompanyDisplacement().then(data => setCompanyData(data.companies || []))
        .catch(e => console.error('[Companies] failed:', e)),
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

  // ---- Layout chrome ----
  const tickerCompanies = companyData as unknown as Parameters<typeof Ticker>[0]['companies']

  return (
    <>
      <Header
        tab={tab}
        onTabChange={setTab}
        ticker={<Ticker companies={tickerCompanies} />}
      />

      <main style={mainStyle}>
        <Sidebar>
          <ControlPanel state={scenario} onChange={updateScenario} />
        </Sidebar>

        <section style={centerStyle}>
          {loading && <CenterMessage>Loading data…</CenterMessage>}
          {error && (
            <CenterMessage error>
              Failed to load data: {error}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Make sure the backend is running.
              </div>
            </CenterMessage>
          )}

          {!loading && !error && tab === 'map' && (
            <div style={mapWrapperStyle}>
              <div style={mapToggleStyle}>
                {(['us', 'world'] as MapView[]).map(v => (
                  <button
                    key={v}
                    onClick={() => { setMapView(v); setSelectedCounty(null) }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 4,
                      background: mapView === v ? 'var(--bg-panel-hover)' : 'transparent',
                      color: mapView === v ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'background var(--motion-fast)',
                    }}
                  >
                    {v === 'us' ? 'US Counties' : 'World'}
                  </button>
                ))}
              </div>

              {mapView === 'us' ? (
                <USMap
                  counties={counties}
                  onCountyClick={handleCountyClick}
                  year={scenario.year}
                  selectedCounty={selectedCounty}
                  overlays={overlays}
                  companyData={companyData}
                  scenario={scenario}
                />
              ) : (
                <WorldMap countries={countries as never[]} scenario={scenario} />
              )}
            </div>
          )}

          {!loading && !error && tab === 'simulate' && (
            <div style={scrollTabStyle}><SimulationPanel /></div>
          )}
          {!loading && !error && tab === 'job' && (
            <div style={scrollTabStyle}><JobSearch /></div>
          )}
          {!loading && !error && tab === 'market' && (
            <div style={scrollTabStyle}><MarketImplications /></div>
          )}
        </section>

        <RightPanel>
          {selectedCounty && tab === 'map' ? (
            <CountyDetailPanel
              countyFips={selectedCounty}
              year={scenario.year}
              onClose={() => setSelectedCounty(null)}
            />
          ) : (
            <DefaultRightPanel
              counties={counties}
              companies={companyData as Parameters<typeof DefaultRightPanel>[0]['companies']}
              scenario={scenario}
            />
          )}
        </RightPanel>
      </main>

      <Footer
        lastUpdated={new Date().toISOString().slice(0, 10)}
        confidence={scenario.year <= 2027 ? 'high' : scenario.year <= 2032 ? 'medium' : 'low'}
      />
    </>
  )
}

function CenterMessage({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: error ? 'var(--danger)' : 'var(--text-secondary)',
      textAlign: 'center',
      padding: 40,
    }}>
      <div>{children}</div>
    </div>
  )
}

const mainStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
}

const centerStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  position: 'relative',
  background: 'var(--bg-primary)',
  overflow: 'hidden',
  height: '100%',
}

const mapWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
}

const mapToggleStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  display: 'flex',
  gap: 2,
  background: 'var(--bg-inset)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 2,
}

const scrollTabStyle: React.CSSProperties = {
  overflow: 'auto',
  height: '100%',
}
