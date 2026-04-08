const API_BASE = '/api'

export async function fetchCounties() {
  const res = await fetch(`${API_BASE}/counties`)
  if (!res.ok) throw new Error(`Failed to fetch counties: ${res.statusText}`)
  return res.json()
}

export async function fetchCountyDetail(fips: string) {
  const res = await fetch(`${API_BASE}/counties/${fips}`)
  if (!res.ok) throw new Error(`Failed to fetch county ${fips}: ${res.statusText}`)
  return res.json()
}

export async function searchOccupations(query: string) {
  const res = await fetch(`${API_BASE}/occupations/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Failed to search occupations: ${res.statusText}`)
  return res.json()
}

export async function fetchOccupationDetail(soc: string) {
  const res = await fetch(`${API_BASE}/occupations/${encodeURIComponent(soc)}`)
  if (!res.ok) throw new Error(`Failed to fetch occupation ${soc}: ${res.statusText}`)
  return res.json()
}

export async function fetchCountries() {
  const res = await fetch(`${API_BASE}/countries`)
  if (!res.ok) throw new Error(`Failed to fetch countries: ${res.statusText}`)
  return res.json()
}

export interface SimulationParams {
  ai_adoption_pace: number
  policy_response: 'none' | 'retraining' | 'ubi'
  fed_response: 'hold' | 'cut' | 'zero'
  social_stability_threshold: number
  global_macro: 'risk_on' | 'neutral' | 'risk_off'
  n_simulations: number
  time_horizon_years: number
  county_fips?: string
}

export async function runSimulation(params: SimulationParams) {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`Simulation failed: ${res.statusText}`)
  return res.json()
}
