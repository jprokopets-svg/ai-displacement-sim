const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`

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

export async function fetchOverlays() {
  const res = await fetch(`${API_BASE}/overlays`)
  if (!res.ok) throw new Error(`Failed to fetch overlays: ${res.statusText}`)
  return res.json()
}

export async function fetchCompanyDisplacement() {
  const res = await fetch(`${API_BASE}/companies`)
  if (!res.ok) throw new Error(`Failed to fetch companies: ${res.statusText}`)
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
  trade_policy?: string
  corporate_profit?: string
  equity_loop?: string
  feedback_aggressiveness?: number
  business_pressure?: number
  wealth_concentration?: number
  ubi_timeline_years?: number
  price_deflation_rate?: number
  expert_wage_premium?: number
  base_worker_wage_trajectory?: number
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
