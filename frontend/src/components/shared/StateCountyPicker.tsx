import { useMemo, useState } from 'react'

interface County {
  county_fips: string
  county_name: string
  exposure_percentile: number
}

interface Props {
  counties: County[]
  onSelect: (county: County) => void
  selectedFips?: string | null
}

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois',
  'Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
  'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota',
  'Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming',
]

function extractState(countyName: string): string {
  const parts = countyName.split(',')
  return (parts[parts.length - 1] || '').trim()
}

function extractCountyOnly(countyName: string): string {
  const parts = countyName.split(',')
  return (parts[0] || '').trim()
}

export default function StateCountyPicker({ counties, onSelect, selectedFips }: Props) {
  const [state, setState] = useState('')

  const countiesInState = useMemo(() => {
    if (!state) return []
    return counties
      .filter(c => extractState(c.county_name) === state)
      .sort((a, b) => extractCountyOnly(a.county_name).localeCompare(extractCountyOnly(b.county_name)))
  }, [counties, state])

  const selectedCounty = selectedFips ? counties.find(c => c.county_fips === selectedFips) : null

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>State</label>
          <select
            value={state}
            onChange={e => { setState(e.target.value) }}
            style={selectStyle}
          >
            <option value="">Select state…</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>County</label>
          <select
            value={selectedFips || ''}
            onChange={e => {
              const c = counties.find(c => c.county_fips === e.target.value)
              if (c) onSelect(c)
            }}
            style={selectStyle}
            disabled={!state}
          >
            <option value="">{state ? 'Select county…' : 'Select state first'}</option>
            {countiesInState.map(c => (
              <option key={c.county_fips} value={c.county_fips}>
                {extractCountyOnly(c.county_name)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {selectedCounty && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {selectedCounty.county_name} · p{Math.round(selectedCounty.exposure_percentile)}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box' as const,
}
