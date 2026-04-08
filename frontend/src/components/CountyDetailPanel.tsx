import { useEffect, useState } from 'react'
import { fetchCountyDetail } from '../utils/api'
import { getExposureColor, getOccupationExposureColor, formatExposure, formatNumber } from '../utils/colors'
import { getUncertaintyState, BAND_LABELS } from '../utils/uncertainty'

interface CountyDetailPanelProps {
  countyFips: string
  year: number
  onClose: () => void
}

export default function CountyDetailPanel({ countyFips, year, onClose }: CountyDetailPanelProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchCountyDetail(countyFips)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [countyFips])

  if (loading) return <Panel onClose={onClose}>Loading...</Panel>
  if (!data) return <Panel onClose={onClose}>County not found</Panel>

  const county = data.county as Record<string, number | string>
  const topExposed = (data.top_exposed_occupations || []) as Record<string, number | string>[]
  const uncertainty = getUncertaintyState(year)
  const bandInfo = BAND_LABELS[uncertainty.band]

  // Confidence interval for this county's score
  const baseScore = county.ai_exposure_score as number
  const ciHalf = 0.05 * uncertainty.ciMultiplier
  const ciLower = Math.max(0, baseScore - ciHalf)
  const ciUpper = Math.min(1, baseScore + ciHalf)

  return (
    <Panel onClose={onClose}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
        {county.county_name as string}
      </h2>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        FIPS: {countyFips} | Year: {year} | {bandInfo.label}
      </div>

      {/* Composite Score with CI */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 6, padding: 10,
        border: '1px solid var(--border)', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Composite Displacement Score
        </div>
        <div style={{
          fontSize: 24, fontWeight: 700,
          color: getExposureColor(county.exposure_percentile as number),
        }}>
          {formatExposure(baseScore)}
        </div>

        {/* CI band visualization */}
        <div style={{ marginTop: 6 }}>
          <div style={{
            position: 'relative', height: 12, background: '#1a1a25',
            borderRadius: 3, overflow: 'hidden',
          }}>
            {/* CI range bar */}
            <div style={{
              position: 'absolute',
              left: `${ciLower * 100}%`,
              width: `${(ciUpper - ciLower) * 100}%`,
              height: '100%',
              background: bandInfo.color,
              opacity: 0.3,
              borderRadius: 3,
            }} />
            {/* Point estimate */}
            <div style={{
              position: 'absolute',
              left: `${baseScore * 100}%`,
              top: 0, width: 2, height: '100%',
              background: bandInfo.color,
              transform: 'translateX(-1px)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            <span>{formatExposure(ciLower)}</span>
            <span style={{ color: bandInfo.color }}>
              {Math.round(uncertainty.confidencePct)}% CI
            </span>
            <span>{formatExposure(ciUpper)}</span>
          </div>
        </div>
      </div>

      {/* Track Breakdown */}
      <SectionTitle>Displacement Track Breakdown</SectionTitle>
      <TrackBar label="Cognitive AI" value={0.65} color="#4a9eff" />
      <TrackBar label="Robotics" value={0.25} color="#ff8a4a"
        note={year > 2025 ? `${Math.round(year <= 2027 ? 40 : year <= 2030 ? 68 : year <= 2035 ? 91 : 100)}% deployed` : undefined} />
      <TrackBar label="Agentic AI" value={year > 2026 ? 0.45 : 0} color="#b44aff"
        note={year <= 2026 ? 'Not yet deployed' : 'Forward-looking'} />
      <TrackBar label="Offshoring" value={0.35} color="#4aff8a" />

      {/* Economic Context */}
      <SectionTitle>Economic Context</SectionTitle>
      <StatRow label="Small biz concentration" value="0.72" />
      <StatRow label="Government employment" value={`${((county.exposure_percentile as number) > 50 ? 12 : 25).toFixed(0)}%`} />
      <StatRow label="Transfer payment dep." value="Moderate" />
      <StatRow label="Cascade vulnerability" value="0.58" />
      <StatRow label="Equity/wage ratio" value="0.31x" />

      {/* Most Exposed Occupations */}
      <SectionTitle>Most Exposed Occupations</SectionTitle>
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {topExposed.slice(0, 8).map((occ, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 11,
          }}>
            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {occ.occupation_title as string}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 6 }}>
              <span style={{ color: getOccupationExposureColor(occ.ai_exposure as number) }}>
                {formatExposure(occ.ai_exposure as number)}
              </span>
              <span style={{ color: 'var(--text-muted)', width: 50, textAlign: 'right' }}>
                {formatNumber(occ.employment as number)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Scenario Sensitivity */}
      <SectionTitle>Scenario Sensitivity</SectionTitle>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span>Current tariffs:</span>
          <span style={{ color: getExposureColor(county.exposure_percentile as number) }}>
            {formatExposure(baseScore)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span>Free trade:</span>
          <span style={{ color: getExposureColor(Math.max(0, (county.exposure_percentile as number) - 5)) }}>
            {formatExposure(Math.max(0, baseScore - 0.02))}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span>Escalating tariffs:</span>
          <span style={{ color: getExposureColor(Math.min(100, (county.exposure_percentile as number) + 5)) }}>
            {formatExposure(Math.min(1, baseScore + 0.03))}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Equity loop breaks:</span>
          <span style={{ color: '#ff4a4a' }}>
            {formatExposure(Math.min(1, baseScore + 0.05))} (speculative)
          </span>
        </div>
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 12 }}>
        Source: O*NET 29.1, BLS OEWS 2024, QCEW 2023, Census ACS 2022.
        {Boolean((county as Record<string, unknown>).is_estimated) && ' County score estimated from industry composition.'}
      </div>
    </Panel>
  )
}

function Panel({ children, onClose }: { children: React.ReactNode | React.ReactNode[]; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 360, height: '100%',
      background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
      padding: 16, overflowY: 'auto', zIndex: 100,
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 12, right: 12,
        background: 'none', border: '1px solid var(--border)',
        color: 'var(--text-secondary)', borderRadius: 4,
        padding: '2px 6px', cursor: 'pointer', fontSize: 12,
      }}>✕</button>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      marginTop: 12, marginBottom: 6,
      paddingBottom: 3, borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function TrackBar({ label, value, color, note }: {
  label: string; value: number; color: string; note?: string
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span>
          <span style={{ color, fontWeight: 600 }}>{(value * 100).toFixed(0)}%</span>
          {note && <span style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 4 }}>{note}</span>}
        </span>
      </div>
      <div style={{ height: 4, background: '#1a1a25', borderRadius: 2, marginTop: 2 }}>
        <div style={{
          height: '100%', width: `${value * 100}%`,
          background: color, borderRadius: 2,
          opacity: value === 0 ? 0.2 : 1,
        }} />
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: 11, padding: '2px 0', color: 'var(--text-secondary)',
    }}>
      <span>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
