import { useState } from 'react'
import { runSimulation, type SimulationParams } from '../utils/api'

const DEFAULT_PARAMS: SimulationParams = {
  ai_adoption_pace: 0.5,
  policy_response: 'none',
  fed_response: 'hold',
  social_stability_threshold: 0.10,
  global_macro: 'neutral',
  n_simulations: 50000,
  time_horizon_years: 10,
}

export default function SimulationPanel() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await runSimulation(params)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Monte Carlo Simulator</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
        Configure scenario parameters and run simulations. Results show probability
        distributions across {params.n_simulations.toLocaleString()} configurations,
        not point predictions.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 700 }}>
        {/* AI Adoption Pace */}
        <div>
          <label style={labelStyle}>
            AI Adoption Pace: {(params.ai_adoption_pace * 100).toFixed(0)}%
          </label>
          <input
            type="range" min="0" max="1" step="0.05"
            value={params.ai_adoption_pace}
            onChange={e => setParams(p => ({ ...p, ai_adoption_pace: +e.target.value }))}
            style={{ width: '100%' }}
          />
          <div style={hintStyle}>0% = slow (20yr), 100% = fast (5yr)</div>
        </div>

        {/* Social Stability Threshold */}
        <div>
          <label style={labelStyle}>
            Stability Threshold: {(params.social_stability_threshold * 100).toFixed(0)}% unemployment
          </label>
          <input
            type="range" min="0.01" max="0.30" step="0.01"
            value={params.social_stability_threshold}
            onChange={e => setParams(p => ({ ...p, social_stability_threshold: +e.target.value }))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Policy Response */}
        <div>
          <label style={labelStyle}>Government Policy</label>
          <select
            value={params.policy_response}
            onChange={e => setParams(p => ({ ...p, policy_response: e.target.value as SimulationParams['policy_response'] }))}
            style={selectStyle}
          >
            <option value="none">No intervention</option>
            <option value="retraining">Retraining programs</option>
            <option value="ubi">Universal Basic Income</option>
          </select>
        </div>

        {/* Fed Response */}
        <div>
          <label style={labelStyle}>Fed Response</label>
          <select
            value={params.fed_response}
            onChange={e => setParams(p => ({ ...p, fed_response: e.target.value as SimulationParams['fed_response'] }))}
            style={selectStyle}
          >
            <option value="hold">Hold rates</option>
            <option value="cut">Rate cuts</option>
            <option value="zero">Zero rate policy</option>
          </select>
        </div>

        {/* Global Macro */}
        <div>
          <label style={labelStyle}>Global Macro</label>
          <select
            value={params.global_macro}
            onChange={e => setParams(p => ({ ...p, global_macro: e.target.value as SimulationParams['global_macro'] }))}
            style={selectStyle}
          >
            <option value="risk_on">Risk on (tailwinds)</option>
            <option value="neutral">Neutral</option>
            <option value="risk_off">Risk off (headwinds)</option>
          </select>
        </div>

        {/* Time Horizon */}
        <div>
          <label style={labelStyle}>Time Horizon: {params.time_horizon_years} years</label>
          <input
            type="range" min="1" max="30" step="1"
            value={params.time_horizon_years}
            onChange={e => setParams(p => ({ ...p, time_horizon_years: +e.target.value }))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <button onClick={handleRun} disabled={loading} style={buttonStyle}>
        {loading ? 'Running...' : `Run ${params.n_simulations.toLocaleString()} Simulations`}
      </button>

      {error && <div style={{ color: 'var(--danger)', marginTop: 16 }}>{error}</div>}

      {result && <SimulationResults result={result} />}
    </div>
  )
}

function SimulationResults({ result }: { result: Record<string, unknown> }) {
  const scenarios = result.scenario_probabilities as Record<string, number>
  const assumptions = result.assumptions as string[]

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Results</h3>

      {/* Key outcomes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <ResultCard
          label="Displacement"
          mean={`${((result.displacement_pct_mean as number) * 100).toFixed(1)}%`}
          ci={`${((result.displacement_pct_p5 as number) * 100).toFixed(1)}% — ${((result.displacement_pct_p95 as number) * 100).toFixed(1)}%`}
        />
        <ResultCard
          label="Unemployment"
          mean={`${((result.unemployment_rate_mean as number) * 100).toFixed(1)}%`}
          ci={`${((result.unemployment_rate_p5 as number) * 100).toFixed(1)}% — ${((result.unemployment_rate_p95 as number) * 100).toFixed(1)}%`}
        />
        <ResultCard
          label="GDP Impact"
          mean={`${((result.gdp_impact_pct_mean as number) * 100).toFixed(2)}%`}
          ci={`${((result.gdp_impact_pct_p5 as number) * 100).toFixed(2)}% — ${((result.gdp_impact_pct_p95 as number) * 100).toFixed(2)}%`}
        />
      </div>

      {/* Scenario probabilities */}
      <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>
        Scenario Probabilities
      </h4>
      <div style={{ display: 'grid', gap: 6 }}>
        {Object.entries(scenarios).map(([key, prob]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: `${prob * 100}%`, minWidth: 4, maxWidth: 200,
              height: 16, borderRadius: 2,
              background: key === 'mass_displacement' || key === 'social_instability'
                ? 'var(--danger)' : 'var(--accent)',
            }} />
            <span style={{ fontSize: 13 }}>
              {(prob * 100).toFixed(1)}% — {key.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Assumptions */}
      <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>
        Assumptions Used
      </h4>
      <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16 }}>
        {assumptions.map((a, i) => <li key={i} style={{ marginBottom: 2 }}>{a}</li>)}
      </ul>
    </div>
  )
}

function ResultCard({ label, mean, ci }: { label: string; mean: string; ci: string }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', borderRadius: 6, padding: 12,
      border: '1px solid var(--border)',
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{mean}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
        90% CI: {ci}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: 'var(--text-secondary)', marginBottom: 4,
}

const hintStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 4,
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', fontSize: 13,
}

const buttonStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 24px', borderRadius: 6,
  background: 'var(--accent)', color: '#fff', border: 'none',
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
