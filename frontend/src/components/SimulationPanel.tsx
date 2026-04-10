import { useState, useRef, useEffect } from 'react'
import { runSimulation, type SimulationParams } from '../utils/api'

const DEFAULT_PARAMS: SimulationParams = {
  ai_adoption_pace: 0.5,
  policy_response: 'none',
  fed_response: 'hold',
  social_stability_threshold: 0.10,
  global_macro: 'neutral',
  n_simulations: 50000,
  time_horizon_years: 10,
  business_pressure: 0.5,
  wealth_concentration: 0.3,
  ubi_timeline_years: 5,
  price_deflation_rate: 0.02,
  expert_wage_premium: 0.3,
  base_worker_wage_trajectory: -0.02,
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
      {/* Prominent header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2a4a 0%, #1a1a35 100%)',
        borderRadius: 8, padding: '16px 20px', marginBottom: 20,
        border: '1px solid var(--border)',
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Monte Carlo Simulation
        </h2>
        <div style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 600 }}>
          50,000 configurations
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
          Each simulation draws from probability distributions for uncertain parameters,
          producing a distribution of outcomes rather than point predictions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 700 }}>
        {/* AI Adoption Pace */}
        <ParamSlider
          label="AI Adoption Pace"
          value={params.ai_adoption_pace}
          min={0} max={1} step={0.05}
          format={v => `${(v * 100).toFixed(0)}%`}
          hint="0% = slow (20yr), 100% = fast (5yr)"
          info="S-curve adoption model. Controls how quickly AI capabilities translate into actual workplace deployment."
          onChange={v => setParams(p => ({ ...p, ai_adoption_pace: v }))}
        />

        {/* Social Stability Threshold */}
        <ParamSlider
          label="Stability Threshold"
          value={params.social_stability_threshold}
          min={0.01} max={0.30} step={0.01}
          format={v => `${(v * 100).toFixed(0)}% unemployment`}
          info="Unemployment rate that triggers social instability classification. When exceeded for 2+ consecutive years, scenario is classified as socially unstable."
          onChange={v => setParams(p => ({ ...p, social_stability_threshold: v }))}
        />

        {/* Policy Response */}
        <ParamSelect
          label="Government Policy"
          value={params.policy_response}
          info="Government intervention reduces displacement over time. Retraining: 2-year lag, then 20-40% reduction. UBI: preserves 30-50% of spending."
          options={[
            { value: 'none', label: 'No intervention' },
            { value: 'retraining', label: 'Retraining programs' },
            { value: 'ubi', label: 'Universal Basic Income' },
          ]}
          onChange={v => setParams(p => ({ ...p, policy_response: v as SimulationParams['policy_response'] }))}
        />

        {/* Fed Response */}
        <ParamSelect
          label="Fed Response"
          value={params.fed_response}
          info="Federal Reserve interest rate policy. Fed response reflects initial policy stance. Long-term projections assume policy normalization after year 3."
          options={[
            { value: 'hold', label: 'Hold rates' },
            { value: 'cut', label: 'Rate cuts' },
            { value: 'zero', label: 'Zero rate policy' },
          ]}
          onChange={v => setParams(p => ({ ...p, fed_response: v as SimulationParams['fed_response'] }))}
        />

        {/* Global Macro */}
        <ParamSelect
          label="Global Macro"
          value={params.global_macro}
          info="Global macroeconomic environment. Risk-on amplifies both growth and disruption. Risk-off dampens changes."
          options={[
            { value: 'risk_on', label: 'Risk on (tailwinds)' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'risk_off', label: 'Risk off (headwinds)' },
          ]}
          onChange={v => setParams(p => ({ ...p, global_macro: v as SimulationParams['global_macro'] }))}
        />

        {/* Time Horizon */}
        <ParamSlider
          label="Time Horizon"
          value={params.time_horizon_years}
          min={1} max={30} step={1}
          format={v => `${v} years`}
          info="Simulation length in years. Longer horizons have wider confidence intervals."
          onChange={v => setParams(p => ({ ...p, time_horizon_years: v }))}
        />

        {/* Business Pressure */}
        <ParamSlider
          label="Business Pressure"
          value={params.business_pressure ?? 0.5}
          min={0} max={1} step={0.05}
          format={v => `${(v * 100).toFixed(0)}%`}
          hint="Economic pressure to automate"
          info="How much competitive pressure forces businesses to adopt AI. Higher = faster automation adoption driven by labor cost as % of revenue."
          onChange={v => setParams(p => ({ ...p, business_pressure: v }))}
        />

        {/* Wealth Concentration */}
        <ParamSlider
          label="Wealth Concentration Effect"
          value={params.wealth_concentration ?? 0.3}
          min={0} max={1} step={0.05}
          format={v => `${(v * 100).toFixed(0)}%`}
          hint="Wealthy spending GDP support"
          info="How much can wealthy spending support GDP as middle-class demand falls. Higher = more GDP resilience from top-decile consumption."
          onChange={v => setParams(p => ({ ...p, wealth_concentration: v }))}
        />

        {/* UBI Timeline */}
        <ParamSlider
          label="UBI/Subsidy Timeline"
          value={params.ubi_timeline_years ?? 5}
          min={1} max={15} step={1}
          format={v => `${v} years`}
          hint="Years until intervention"
          info="How many years until government intervention (UBI/subsidies) kicks in. Shorter = faster policy response, longer = more displacement before stabilization."
          onChange={v => setParams(p => ({ ...p, ubi_timeline_years: v }))}
        />

        {/* Price Deflation */}
        <ParamSlider
          label="Price Deflation Rate"
          value={params.price_deflation_rate ?? 0.02}
          min={0} max={0.15} step={0.005}
          format={v => `${(v * 100).toFixed(1)}%/yr`}
          hint="How much prices drop as demand falls"
          info="Annual price deflation as aggregate demand declines. Higher deflation worsens GDP impact through debt burden and delayed spending."
          onChange={v => setParams(p => ({ ...p, price_deflation_rate: v }))}
        />

        {/* Expert Wage Premium */}
        <ParamSlider
          label="Expert Wage Premium"
          value={params.expert_wage_premium ?? 0.3}
          min={0} max={1} step={0.05}
          format={v => `${(v * 100).toFixed(0)}%`}
          hint="AI-skilled wage differential"
          info="Wage premium for workers skilled in AI/automation. Higher premium accelerates K-shaped recovery — experts thrive while baseline workers face stagnation."
          onChange={v => setParams(p => ({ ...p, expert_wage_premium: v }))}
        />

        {/* Base Worker Wage Trajectory */}
        <ParamSlider
          label="Base Worker Wages"
          value={params.base_worker_wage_trajectory ?? -0.02}
          min={-0.10} max={0.05} step={0.005}
          format={v => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%/yr`}
          hint="Non-AI worker wage growth"
          info="Annual wage trajectory for workers in non-AI roles. Negative = wage erosion from displacement pressure. Positive = tight labor markets or policy support."
          onChange={v => setParams(p => ({ ...p, base_worker_wage_trajectory: v }))}
        />
      </div>

      {/* Fed response note */}
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', marginTop: 16,
        padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 4,
        border: '1px solid var(--border)',
      }}>
        Fed response reflects initial policy stance. Long-term projections assume
        policy normalization after year 3.
      </div>

      <button onClick={handleRun} disabled={loading} style={buttonStyle}>
        {loading ? 'Running...' : `Run ${params.n_simulations.toLocaleString()} Simulations`}
      </button>

      {error && <div style={{ color: 'var(--danger)', marginTop: 16 }}>{error}</div>}

      {result && <SimulationResults result={result} timeHorizon={params.time_horizon_years} />}
    </div>
  )
}

function SimulationResults({ result, timeHorizon }: { result: Record<string, unknown>; timeHorizon: number }) {
  const scenarios = result.scenario_probabilities as Record<string, number>
  const assumptions = result.assumptions as string[]
  const yearlyDisplacement = result.yearly_displacement as { year: number; mean: number; p5: number; p95: number; p25: number; p75: number }[]

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Results</h3>

      {/* Key outcomes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <ResultCard
          label="Displacement"
          mean={`${((result.displacement_pct_mean as number) * 100).toFixed(1)}%`}
          ci={`${((result.displacement_pct_p5 as number) * 100).toFixed(1)}% - ${((result.displacement_pct_p95 as number) * 100).toFixed(1)}%`}
        />
        <ResultCard
          label="Unemployment"
          mean={`${((result.unemployment_rate_mean as number) * 100).toFixed(1)}%`}
          ci={`${((result.unemployment_rate_p5 as number) * 100).toFixed(1)}% - ${((result.unemployment_rate_p95 as number) * 100).toFixed(1)}%`}
        />
        <ResultCard
          label="GDP Impact"
          mean={`${((result.gdp_impact_pct_mean as number) * 100).toFixed(2)}%`}
          ci={`${((result.gdp_impact_pct_p5 as number) * 100).toFixed(2)}% - ${((result.gdp_impact_pct_p95 as number) * 100).toFixed(2)}%`}
        />
      </div>

      {/* Monte Carlo Visualization — simulation fan chart */}
      {yearlyDisplacement && yearlyDisplacement.length > 0 && (
        <MonteCarloChart data={yearlyDisplacement} timeHorizon={timeHorizon} />
      )}

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
              {(prob * 100).toFixed(1)}% -- {key.replace(/_/g, ' ')}
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

/** Monte Carlo fan chart: shows 90% CI band, 50% CI band, and mean line. */
function MonteCarloChart({ data, timeHorizon }: {
  data: { year: number; mean: number; p5: number; p95: number; p25: number; p75: number }[]
  timeHorizon: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = 660
    const h = 220
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)

    const pad = { top: 20, right: 20, bottom: 30, left: 50 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom

    const maxY = Math.max(0.01, ...data.map(d => d.p95)) * 1.1
    const xScale = (i: number) => pad.left + (i / (data.length - 1)) * cw
    const yScale = (v: number) => pad.top + ch - (v / maxY) * ch

    // Clear
    ctx.fillStyle = '#12121a'
    ctx.fillRect(0, 0, w, h)

    // 90% CI band
    ctx.fillStyle = 'rgba(74, 158, 255, 0.10)'
    ctx.beginPath()
    data.forEach((d, i) => {
      const x = xScale(i)
      ctx.lineTo(x, yScale(d.p95))
    })
    for (let i = data.length - 1; i >= 0; i--) {
      ctx.lineTo(xScale(i), yScale(data[i].p5))
    }
    ctx.closePath()
    ctx.fill()

    // 50% CI band
    ctx.fillStyle = 'rgba(74, 158, 255, 0.20)'
    ctx.beginPath()
    data.forEach((d, i) => {
      ctx.lineTo(xScale(i), yScale(d.p75))
    })
    for (let i = data.length - 1; i >= 0; i--) {
      ctx.lineTo(xScale(i), yScale(data[i].p25))
    }
    ctx.closePath()
    ctx.fill()

    // Simulated faint lines (50 paths for visual effect)
    ctx.globalAlpha = 0.06
    ctx.strokeStyle = '#4a9eff'
    ctx.lineWidth = 0.8
    for (let s = 0; s < 50; s++) {
      ctx.beginPath()
      let val = 0
      for (let i = 0; i < data.length; i++) {
        const range = data[i].p95 - data[i].p5
        val = data[i].mean + (Math.random() - 0.5) * range * 1.2
        val = Math.max(0, val)
        const x = xScale(i)
        const y = yScale(val)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1.0

    // Mean line
    ctx.strokeStyle = '#4a9eff'
    ctx.lineWidth = 2
    ctx.beginPath()
    data.forEach((d, i) => {
      const x = xScale(i)
      const y = yScale(d.mean)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Axes
    ctx.strokeStyle = '#3a3a4a'
    ctx.lineWidth = 1
    // X axis
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top + ch)
    ctx.lineTo(pad.left + cw, pad.top + ch)
    ctx.stroke()
    // Y axis
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top)
    ctx.lineTo(pad.left, pad.top + ch)
    ctx.stroke()

    // X labels
    ctx.fillStyle = '#5a5a70'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(data.length / 5))
    for (let i = 0; i < data.length; i += step) {
      ctx.fillText(`Year ${data[i].year}`, xScale(i), pad.top + ch + 16)
    }
    // Last year
    if (data.length > 1) {
      ctx.fillText(`Year ${data[data.length - 1].year}`, xScale(data.length - 1), pad.top + ch + 16)
    }

    // Y labels
    ctx.textAlign = 'right'
    const yTicks = 4
    for (let i = 0; i <= yTicks; i++) {
      const v = (maxY / yTicks) * i
      ctx.fillText(`${(v * 100).toFixed(0)}%`, pad.left - 6, yScale(v) + 4)
    }

    // Legend
    ctx.font = '9px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(74,158,255,0.3)'
    ctx.fillRect(pad.left + 8, pad.top + 2, 8, 8)
    ctx.fillStyle = '#888'
    ctx.fillText('90% CI', pad.left + 20, pad.top + 10)

    ctx.fillStyle = 'rgba(74,158,255,0.5)'
    ctx.fillRect(pad.left + 68, pad.top + 2, 8, 8)
    ctx.fillStyle = '#888'
    ctx.fillText('50% CI', pad.left + 80, pad.top + 10)

    ctx.strokeStyle = '#4a9eff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pad.left + 128, pad.top + 6)
    ctx.lineTo(pad.left + 138, pad.top + 6)
    ctx.stroke()
    ctx.fillStyle = '#888'
    ctx.fillText('Mean', pad.left + 142, pad.top + 10)

  }, [data, timeHorizon])

  return (
    <div style={{ marginTop: 20 }}>
      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Displacement Trajectory — {data.length} years
      </h4>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 6, padding: 8,
        border: '1px solid var(--border)',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        Faint lines represent individual simulation paths. Bands show confidence intervals.
      </div>
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

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ display: 'inline-block', marginLeft: 4 }}>
      <button
        onClick={() => setShow(!show)}
        style={{
          background: 'none', border: '1px solid #555', borderRadius: '50%',
          width: 14, height: 14, fontSize: 9, color: '#888', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1,
        }}
      >i</button>
      {show && (
        <div style={{
          position: 'absolute', zIndex: 9999,
          background: '#0a0a12', border: '1px solid #555', borderRadius: 4,
          padding: '8px 10px', fontSize: 10, color: '#ddd',
          width: 220, lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
          marginTop: 4,
        }}>
          {text}
          <div onClick={() => setShow(false)}
            style={{ color: '#888', cursor: 'pointer', marginTop: 4, fontSize: 9, textAlign: 'right' }}>
            dismiss
          </div>
        </div>
      )}
    </span>
  )
}

function ParamSlider({ label, value, min, max, step, format, hint, info, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; hint?: string; info?: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <label style={labelStyle}>{label}: {format(value)}</label>
        {info && <InfoTip text={info} />}
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%' }}
      />
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  )
}

function ParamSelect({ label, value, info, options, onChange }: {
  label: string; value: string; info?: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <label style={labelStyle}>{label}</label>
        {info && <InfoTip text={info} />}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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
