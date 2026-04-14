import { useMemo } from 'react'
import Section from './Section'
import type { ScenarioState } from '../ControlPanel'
import { countyLabel } from '../../utils/countyLabel'

const MIN_EMPLOYMENT_FOR_RANKING = 10_000

type CountyScore = {
  county_fips: string
  county_name: string
  ai_exposure_score: number
  total_employment: number
  exposed_employment: number
  exposure_percentile: number
}

type Company = {
  name: string
  sector: string
  displacement_events?: { date: string; headcount_impact: number; confidence_score: number }[]
}

interface Props {
  counties: CountyScore[]
  companies: Company[]
  scenario: ScenarioState
}

/**
 * Default right panel shown when no county is selected.
 * Scenario-reactive: recomputes when sliders/toggles change via `counties` prop.
 */
export default function DefaultRightPanel({ counties, companies, scenario }: Props) {
  const stats = useMemo(() => {
    if (counties.length === 0) return null
    const totalExposed = counties.reduce((s, c) => s + (c.exposed_employment || 0), 0)
    const totalEmp = counties.reduce((s, c) => s + (c.total_employment || 0), 0)
    // Filter out tiny counties before ranking — a 46-worker county topping the
    // list is statistical noise, not a meaningful signal.
    const rankable = counties.filter(c => (c.total_employment || 0) >= MIN_EMPLOYMENT_FOR_RANKING)
    const sorted = [...rankable].sort((a, b) => b.ai_exposure_score - a.ai_exposure_score)
    const top5 = sorted.slice(0, 5)
    return {
      totalExposed,
      totalEmp,
      exposedShare: totalEmp > 0 ? totalExposed / totalEmp : 0,
      top5,
    }
  }, [counties])

  const latestEvent = useMemo(() => {
    let best: { company: string; sector: string; jobs: number; date: string } | null = null
    for (const c of companies || []) {
      for (const ev of c.displacement_events || []) {
        if (!best || ev.date > best.date) {
          best = { company: c.name, sector: c.sector, jobs: ev.headcount_impact, date: ev.date }
        }
      }
    }
    return best
  }, [companies])

  return (
    <div>
      <Section title="National Exposure">
        {stats ? (
          <>
            <Stat
              label="Employment at risk"
              value={fmtNum(stats.totalExposed)}
              sub={`${(stats.exposedShare * 100).toFixed(1)}% of total workforce`}
              large
            />
            <Divider />
            <Stat
              label="Projection year"
              value={String(scenario.year)}
              sub={yearConfidenceLabel(scenario.year)}
            />
            <Stat
              label="Feedback aggressiveness"
              value={scenario.feedbackAggressiveness.toFixed(2)}
              sub={feedbackLabel(scenario.feedbackAggressiveness)}
            />
          </>
        ) : (
          <span style={mutedStyle}>Loading…</span>
        )}
      </Section>

      <Section title="Most Exposed Counties">
        {stats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.top5.map((c, i) => (
              <div key={c.county_fips} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  <span style={rankStyle}>{i + 1}</span>
                  <span style={countyNameStyle}>{countyLabel(c)}</span>
                </div>
                <span className="data-value" style={scoreStyle}>
                  {(c.ai_exposure_score * 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span style={mutedStyle}>Loading…</span>
        )}
      </Section>

      <Section title="Latest Event">
        {latestEvent ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
              {latestEvent.company}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {latestEvent.sector}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span className="data-value" style={{ fontSize: 20, color: 'var(--danger)' }}>
                {fmtNum(latestEvent.jobs)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {latestEvent.date}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              ROLES IMPACTED
            </div>
          </div>
        ) : (
          <span style={mutedStyle}>No events loaded</span>
        )}
      </Section>

      <Section title="How to use">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Click any county on the map to see a full exposure breakdown.
          Adjust sliders in the left panel to run scenarios.
        </div>
      </Section>
    </div>
  )
}

function Stat({ label, value, sub, large }: { label: string; value: string; sub?: string; large?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div className="data-value" style={{
        fontSize: large ? 28 : 16,
        fontWeight: 500,
        color: 'var(--text-primary)',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
}

function fmtNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function yearConfidenceLabel(year: number): string {
  if (year <= 2027) return 'High confidence band'
  if (year <= 2032) return 'Medium confidence band'
  return 'Low confidence — scenario modeling'
}

function feedbackLabel(v: number): string {
  if (v < 0.3) return 'Gradual (Goldman baseline)'
  if (v < 0.7) return 'Moderate acceleration'
  return 'Aggressive self-reinforcing cascade'
}

const mutedStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
}
const rankStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 14,
}
const countyNameStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const scoreStyle: React.CSSProperties = {
  fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
}
