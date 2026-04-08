import { useState } from 'react'
import type { ScenarioState } from './ControlPanel'

interface CountyScore {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  exposure_percentile: number
}

interface DebugPanelProps {
  scenario: ScenarioState
  baseCounties: CountyScore[]
  adjustedCounties: CountyScore[]
}

const DEBUG_FIPS = [
  { fips: '51059', name: 'Fairfax VA' },
  { fips: '26099', name: 'Macomb MI' },
  { fips: '21189', name: 'Owsley KY' },
  { fips: '06081', name: 'San Mateo CA' },
  { fips: '37051', name: 'Cumberland NC' },
]

export default function DebugPanel({ scenario, baseCounties, adjustedCounties }: DebugPanelProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 8, right: 8, zIndex: 9999,
          background: '#1a1a25', color: '#666', border: '1px solid #333',
          borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer',
        }}
      >
        debug
      </button>
    )
  }

  const baseMap = new Map(baseCounties.map(c => [c.county_fips, c]))
  const adjMap = new Map(adjustedCounties.map(c => [c.county_fips, c]))

  return (
    <div style={{
      position: 'fixed', bottom: 8, right: 8, zIndex: 9999,
      background: '#0a0a0f', border: '1px solid #333', borderRadius: 6,
      padding: 10, fontSize: 10, fontFamily: 'monospace', color: '#aaa',
      maxWidth: 420, maxHeight: 400, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Scenario Debug</strong>
        <button onClick={() => setOpen(false)} style={{
          background: 'none', border: 'none', color: '#666', cursor: 'pointer',
        }}>close</button>
      </div>

      <div style={{ color: '#888', marginBottom: 8 }}>
        year={scenario.year} trade={scenario.tradePolicy} corp={scenario.corporateProfit}
        <br />
        equity={scenario.equityLoop} govt={scenario.govtResponse} fed={scenario.fedResponse}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333' }}>
            <th style={{ textAlign: 'left' }}>County</th>
            <th style={{ textAlign: 'right' }}>Base</th>
            <th style={{ textAlign: 'right' }}>Adj</th>
            <th style={{ textAlign: 'right' }}>Delta</th>
            <th style={{ textAlign: 'right' }}>Base%</th>
            <th style={{ textAlign: 'right' }}>Adj%</th>
          </tr>
        </thead>
        <tbody>
          {DEBUG_FIPS.map(({ fips, name }) => {
            const base = baseMap.get(fips)
            const adj = adjMap.get(fips)
            if (!base || !adj) return (
              <tr key={fips}><td colSpan={6}>{name}: not found</td></tr>
            )
            const delta = adj.ai_exposure_score - base.ai_exposure_score
            const pctDelta = adj.exposure_percentile - base.exposure_percentile
            return (
              <tr key={fips} style={{ borderBottom: '1px solid #222' }}>
                <td>{name}</td>
                <td style={{ textAlign: 'right' }}>{(base.ai_exposure_score * 100).toFixed(1)}</td>
                <td style={{ textAlign: 'right' }}>{(adj.ai_exposure_score * 100).toFixed(1)}</td>
                <td style={{
                  textAlign: 'right',
                  color: delta > 0.01 ? '#ff6b6b' : delta < -0.01 ? '#51cf66' : '#666',
                }}>
                  {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}
                </td>
                <td style={{ textAlign: 'right' }}>p{base.exposure_percentile.toFixed(0)}</td>
                <td style={{
                  textAlign: 'right',
                  color: pctDelta > 2 ? '#ff6b6b' : pctDelta < -2 ? '#51cf66' : '#666',
                }}>
                  p{adj.exposure_percentile.toFixed(0)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
