import { useEffect, useState, useCallback, useMemo } from 'react'
import USMap from './components/USMap'
import WorldMap from './components/WorldMap'
import CountyDetailPanel from './components/CountyDetailPanel'
import SimulationTab from './components/Simulation'
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
import NewsFeed from './components/layout/NewsFeed'
import ResizeHandle from './components/layout/ResizeHandle'
import MyRisk from './components/MyRisk'
import CompareCounties from './components/CompareCounties'

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
  const [newsFilter, setNewsFilter] = useState<string | null>(null)

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

  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [compareMode, setCompareMode] = useState(false)

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

  const counties = useMemo(
    () => applyScenarioModifiers(baseCounties, scenario),
    [baseCounties, scenario],
  )

  const handleCountyClick = useCallback((fips: string) => {
    setSelectedCounty(prev => prev === fips ? null : fips)
  }, [])

  const handleTickerCompanyClick = useCallback((companyName: string) => {
    setNewsFilter(companyName)
    setTab('news')
  }, [])

  const tickerCompanies = companyData as unknown as Parameters<typeof Ticker>[0]['companies']

  return (
    <>
      <Header
        tab={tab}
        onTabChange={setTab}
        ticker={<Ticker companies={tickerCompanies} onCompanyClick={handleTickerCompanyClick} />}
      />

      <main style={mainStyle}>
        <Sidebar width={sidebarWidth}>
          <ControlPanel state={scenario} onChange={updateScenario} />
        </Sidebar>
        <ResizeHandle width={sidebarWidth} side="left" onResize={setSidebarWidth} />

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

          {!loading && !error && tab === 'map' && !compareMode && (
            <div style={mapColumnStyle}>
              <div style={toggleRowStyle}>
                <div style={viewToggleStyle}>
                  {(['us', 'world'] as MapView[]).map(v => (
                    <button
                      key={v}
                      onClick={() => { setMapView(v); setSelectedCounty(null) }}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 4,
                        background: mapView === v ? 'var(--accent)' : 'transparent',
                        color: mapView === v ? '#fff' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        transition: 'background var(--motion-fast), color var(--motion-fast)',
                      }}
                    >
                      {v === 'us' ? 'US Counties' : 'World'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCompareMode(true)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 4,
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-strong)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginLeft: 10,
                  }}
                >
                  Compare counties →
                </button>
              </div>
              <div style={mapAreaStyle}>
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
            </div>
          )}

          {!loading && !error && tab === 'map' && compareMode && (
            <CompareCounties
              baseCounties={baseCounties}
              counties={counties}
              overlays={overlays}
              scenario={scenario}
              onYearChange={(y) => updateScenario({ year: y })}
              onClose={() => setCompareMode(false)}
            />
          )}

          {!loading && !error && tab === 'simulate' && (
            <div style={scrollTabStyle}><SimulationTab /></div>
          )}
          {!loading && !error && tab === 'job' && (
            <div style={scrollTabStyle}><JobSearch /></div>
          )}
          {!loading && !error && tab === 'market' && (
            <div style={scrollTabStyle}>
              <MarketImplications
                companyData={companyData as unknown as Parameters<typeof MarketImplications>[0]['companyData']}
                onShowCompanyInNews={(name) => { setNewsFilter(name); setTab('news') }}
              />
            </div>
          )}
          {!loading && !error && tab === 'news' && (
            <NewsFeed
              companies={companyData as Parameters<typeof NewsFeed>[0]['companies']}
              filterCompany={newsFilter}
              onClearFilter={() => setNewsFilter(null)}
            />
          )}
          {!loading && !error && tab === 'my_risk' && (
            <div style={scrollTabStyle}>
              <MyRisk companyData={companyData as unknown as Parameters<typeof MyRisk>[0]['companyData']} />
            </div>
          )}
        </section>

        <ResizeHandle width={rightPanelWidth} side="right" onResize={setRightPanelWidth} />
        <RightPanel width={rightPanelWidth}>
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
  display: 'flex',
  flexDirection: 'column',
}

const mapColumnStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '12px 16px 0',
  flexShrink: 0,
  zIndex: 40,
  background: 'var(--bg-primary)',
}

const viewToggleStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  background: 'var(--bg-inset)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  padding: 2,
  boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
}

const mapAreaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'hidden',
}

const scrollTabStyle: React.CSSProperties = {
  overflow: 'auto',
  height: '100%',
}
