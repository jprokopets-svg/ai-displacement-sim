const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`

export async function fetchCounties() {
  const res = await fetch(`${API_BASE}/counties`)
  if (!res.ok) throw new Error(`Failed to fetch counties: ${res.statusText}`)
  return res.json()
}

export async function searchOccupations(query: string) {
  const res = await fetch(`${API_BASE}/occupations/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Failed to search occupations: ${res.statusText}`)
  return res.json()
}
