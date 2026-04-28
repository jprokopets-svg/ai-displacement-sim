import { useEffect, useState } from 'react'
import { fetchCountyDetail } from '../utils/api'
import { getExposureColor, getOccupationExposureColor, formatExposure, formatNumber, formatWage } from '../utils/colors'

interface CountyPanelProps {
  countyFips: string
  onClose: () => void
}

export default function CountyPanel({ countyFips, onClose }: CountyPanelProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchCountyDetail(countyFips)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [countyFips])

  if (loading) return <div style={panelStyle}>Loading...</div>
  if (error) return <div style={panelStyle}>Error: {error}</div>
  if (!data) return null

  const county = data.county as Record<string, number | string>
  const topExposed = data.top_exposed_occupations as Record<string, number | string>[]
  const topEmployment = data.top_employment_occupations as Record<string, number | string>[]

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{county.county_name as string}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>FIPS: {countyFips}</div>
        </div>
        <button onClick={onClose} style={closeButtonStyle}>✕</button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        <StatCard
          label="AI Exposure"
          value={formatExposure(county.ai_exposure_score as number)}
          color={getExposureColor(county.exposure_percentile as number)}
        />
        <StatCard
          label="Percentile"
          value={`p${(county.exposure_percentile as number).toFixed(0)}`}
        />
        <StatCard
          label="Total Employment"
          value={formatNumber(county.total_employment as number)}
        />
        <StatCard
          label="Exposed Employment"
          value={formatNumber(county.exposed_employment as number)}
          color="var(--warning)"
        />
      </div>

      {/* Most exposed occupations */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>
        Most Exposed Occupations
      </h3>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {topExposed.slice(0, 10).map((occ, i) => (
          <OccRow key={i} occ={occ} />
        ))}
      </div>

      {/* Largest occupations */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>
        Largest Occupations
      </h3>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {topEmployment.slice(0, 10).map((occ, i) => (
          <OccRow key={i} occ={occ} />
        ))}
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 16 }}>
        Source: BLS OEWS May 2024, Eloundou et al. 2024.
        County estimates via MSA-QCEW crosswalk (see methodology).
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

function OccRow({ occ }: { occ: Record<string, number | string> }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12,
    }}>
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {occ.occupation_title as string}
      </div>
      <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginLeft: 8 }}>
        <span style={{ color: getOccupationExposureColor(occ.ai_exposure as number) }}>
          {formatExposure(occ.ai_exposure as number)}
        </span>
        <span style={{ color: 'var(--text-muted)', width: 60, textAlign: 'right' }}>
          {formatNumber(occ.employment as number)}
        </span>
        {occ.mean_wage && (
          <span style={{ color: 'var(--text-secondary)', width: 70, textAlign: 'right' }}>
            {formatWage(occ.mean_wage as number)}
          </span>
        )}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 400,
  height: '100%',
  background: 'var(--bg-panel)',
  borderLeft: '1px solid var(--border)',
  padding: 20,
  overflowY: 'auto',
  zIndex: 100,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: 14,
}
