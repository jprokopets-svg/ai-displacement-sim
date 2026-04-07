import { useState } from 'react'
import { searchOccupations } from '../utils/api'
import { getOccupationExposureColor, formatExposure } from '../utils/colors'

export default function JobSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (query.length < 2) return
    setLoading(true)
    try {
      const data = await searchOccupations(query)
      setResults(data.occupations)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check Your Job</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        Enter your occupation to see its AI exposure score and where it ranks.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="e.g. Software Developer, Accountant, Truck Driver"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 6,
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', fontSize: 14,
          }}
        />
        <button onClick={handleSearch} disabled={loading} style={{
          padding: '8px 16px', borderRadius: 6,
          background: 'var(--accent)', color: '#fff',
          border: 'none', fontSize: 14, cursor: 'pointer',
        }}>
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {results.map((occ, i) => {
            const exposure = occ.ai_exposure as number
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {occ.occupation_title as string}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    SOC: {occ.soc_code as string}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 18, fontWeight: 700,
                    color: getOccupationExposureColor(exposure),
                  }}>
                    {formatExposure(exposure)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    AI exposure
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
            Source: Felten, Raj, Rock (2021). Scores measure task-AI overlap,
            not binary displacement probability.
          </div>
        </div>
      )}
    </div>
  )
}
