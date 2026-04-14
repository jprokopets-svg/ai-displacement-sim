/**
 * Map a company sector to one of the four displacement tracks.
 * Falls back to 'Cognitive AI' — the default track for knowledge-work disruption.
 */

export type Track = 'Cognitive AI' | 'Industrial Robotics' | 'Agentic AI' | 'Offshoring'

const TRACK_MAP: Array<[RegExp, Track]> = [
  [/manufactur|industrial|automotive|warehouse|logistics|shipping|supply chain/i, 'Industrial Robotics'],
  [/bpo|call center|customer service|support/i, 'Offshoring'],
  [/autonomous|agentic|agent platform/i, 'Agentic AI'],
  [/consulting|tech|software|media|finance|legal|insurance|banking|retail|marketing|advertising|professional services|hr|accounting/i, 'Cognitive AI'],
]

export function trackForSector(sector: string | undefined): Track {
  if (!sector) return 'Cognitive AI'
  for (const [rx, track] of TRACK_MAP) {
    if (rx.test(sector)) return track
  }
  return 'Cognitive AI'
}

const TRACK_COLOR: Record<Track, string> = {
  'Cognitive AI': '#3b82f6',
  'Industrial Robotics': '#f59e0b',
  'Agentic AI': '#a855f7',
  'Offshoring': '#10b981',
}

export function colorForTrack(track: Track): string {
  return TRACK_COLOR[track]
}
