import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_PARAMS, N_SIMS, YEAR_END, YEAR_START, runMonteCarlo,
  type CorporateProfit, type FedResponse, type GovtResponse, type SimParams,
} from './model'
import { drawSimulation, canvasToData, AXIS_LEFT, AXIS_RIGHT, AXIS_TOP, AXIS_BOTTOM } from './canvasRender'

/**
 * Monte Carlo Simulation tab — 50,000 client-side paths rendered on Canvas.
 * Parameters on the left, fiber-bundle chart in the center, outcome metrics
 * + probability buckets + assumption formulas on the right.
 */
export default function SimulationTab() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS)
  const [computeMs, setComputeMs] = useState<number>(0)
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; year: number; pct: number; medianPct: number; visible: boolean }>({
    x: 0, y: 0, year: YEAR_START, pct: 0, medianPct: 0, visible: false,
  })

  const update = <K extends keyof SimParams>(k: K, v: SimParams[K]) =>
    setParams(prev => ({ ...prev, [k]: v }))

  // Recompute the full simulation whenever params change.
  const result = useMemo(() => {
    const t0 = performance.now()
    const r = runMonteCarlo(params)
    const ms = performance.now() - t0
    // Defer setState to avoid re-running the memo.
    queueMicrotask(() => setComputeMs(ms))
    return r
  }, [params])

  // Render to canvas whenever result changes.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    drawSimulation(canvasRef.current, result, { thresholdPct: params.stabilityThreshold })
  }, [result, params.stabilityThreshold])

  // Redraw on resize.
  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) {
        drawSimulation(canvasRef.current, result, { thresholdPct: params.stabilityThreshold })
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [result, params.stabilityThreshold])

  return (
    <div style={wrapStyle}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 4 }}>
          Probabilistic forecast
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
          Monte Carlo Simulation — {N_SIMS.toLocaleString()} configurations
        </h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, maxWidth: 860 }}>
          Results show probability distributions across parameter space, not point predictions.
          Confidence intervals widen with time horizon. Each paint
          {computeMs > 0 ? ` (last run ${Math.round(computeMs)}ms)` : ''}.
        </div>
      </div>

      <div style={gridStyle}>
        {/* Left: parameters */}
        <aside style={paramColStyle}>
          <SectionHeader title="Adoption" />
          <Slider
            label="AI adoption pace"
            hint="0 = slow 20-year S-curve · 100 = fast 5-year S-curve"
            min={0} max={100} step={1}
            value={params.aiAdoptionPace}
            onChange={v => update('aiAdoptionPace', v)}
            displayValue={`${params.aiAdoptionPace}`}
          />
          <Slider
            label="Agentic AI emergence"
            hint="Year autonomous agents become mainstream"
            min={2026} max={2032} step={1}
            value={params.agenticYear}
            onChange={v => update('agenticYear', v)}
            displayValue={String(params.agenticYear)}
          />

          <SectionHeader title="Economy" />
          <SelectField
            label="Corporate profit scenario"
            value={params.corporateProfit}
            onChange={v => update('corporateProfit', v as CorporateProfit)}
            options={[
              { value: 'baseline', label: 'Baseline growth' },
              { value: 'surge', label: 'Profit surge (10x)' },
              { value: 'decline', label: 'Profit decline' },
            ]}
          />
          <Slider
            label="Wealth concentration effect"
            hint="How much wealthy spending buffers GDP"
            min={0} max={100} step={1}
            value={params.wealthConcentration}
            onChange={v => update('wealthConcentration', v)}
            displayValue={`${params.wealthConcentration}`}
          />
          <Slider
            label="Business pressure to automate"
            hint="Competitive pressure forcing automation"
            min={0} max={100} step={1}
            value={params.businessPressure}
            onChange={v => update('businessPressure', v)}
            displayValue={`${params.businessPressure}`}
          />

          <SectionHeader title="Policy" />
          <SelectField
            label="Government response"
            value={params.govtResponse}
            onChange={v => update('govtResponse', v as GovtResponse)}
            options={[
              { value: 'none', label: 'No intervention' },
              { value: 'retraining', label: 'Retraining programs' },
              { value: 'ubi', label: 'Universal Basic Income' },
            ]}
          />
          {params.govtResponse === 'ubi' && (
            <Slider
              label="UBI implementation year"
              hint="When UBI kicks in"
              min={2027} max={2038} step={1}
              value={params.ubiYear}
              onChange={v => update('ubiYear', v)}
              displayValue={String(params.ubiYear)}
            />
          )}
          <SelectField
            label="Fed response"
            value={params.fedResponse}
            onChange={v => update('fedResponse', v as FedResponse)}
            options={[
              { value: 'hold', label: 'Hold rates' },
              { value: 'cut', label: 'Rate cuts' },
              { value: 'zero', label: 'Zero-rate policy' },
            ]}
          />

          <SectionHeader title="Uncertainty" />
          <PinnedSlider
            label="Feedback-loop aggressiveness"
            hint="Self-reinforcing cascade strength"
            min={0} max={100} step={1}
            value={params.feedbackAggressiveness}
            onChange={v => update('feedbackAggressiveness', v)}
            displayValue={`${params.feedbackAggressiveness}`}
            pin={{ at: 30, label: 'Author estimate' }}
          />
          <Slider
            label="Stability threshold"
            hint="Unemployment % where social instability begins"
            min={5} max={20} step={1}
            value={params.stabilityThreshold}
            onChange={v => update('stabilityThreshold', v)}
            displayValue={`${params.stabilityThreshold}%`}
          />
        </aside>

        {/* Center: canvas */}
        <section style={chartColStyle}>
          <div style={{
            position: 'relative', background: 'var(--bg-panel)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <LegendItem color="#e6ebf5" label="Median" solid />
              <LegendItem color="rgba(245, 158, 11, 0.8)" label="50% CI" swatch />
              <LegendItem color="rgba(59, 130, 246, 0.6)" label="90% CI" swatch />
              <LegendItem color="rgba(59, 130, 246, 0.25)" label={`${N_SIMS.toLocaleString()} paths`} swatch />
            </div>
            <div
              style={{ position: 'relative', cursor: 'crosshair' }}
              onMouseMove={e => {
                const rect = canvasRef.current?.getBoundingClientRect()
                if (!rect || !canvasRef.current) return
                const cssX = e.clientX - rect.left
                const cssY = e.clientY - rect.top
                const d = canvasToData(cssX, cssY, canvasRef.current)
                const yearIdx = d.year - YEAR_START
                const medianPct = (result.percentiles.p50[yearIdx] ?? 0) * 100
                setTooltip({ x: cssX, y: cssY, year: d.year, pct: d.pct, medianPct, visible: d.inPlot })
              }}
              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
            >
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: 320, display: 'block' }}
              />
              {/* Crosshair + tooltip overlay — HTML for performance (avoids canvas redraw) */}
              {tooltip.visible && (
                <>
                  {/* Vertical crosshair */}
                  <div style={{
                    position: 'absolute', left: tooltip.x, top: AXIS_TOP,
                    width: 1, height: 320 - AXIS_TOP - AXIS_BOTTOM,
                    background: 'rgba(230, 235, 245, 0.25)',
                    pointerEvents: 'none',
                  }} />
                  {/* Horizontal crosshair */}
                  <div style={{
                    position: 'absolute', left: AXIS_LEFT, top: tooltip.y,
                    width: `calc(100% - ${AXIS_LEFT + AXIS_RIGHT}px)`,
                    height: 1,
                    background: 'rgba(230, 235, 245, 0.12)',
                    pointerEvents: 'none',
                  }} />
                  {/* Tooltip panel */}
                  <div style={{
                    position: 'absolute',
                    left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth ?? 600) - 200),
                    top: tooltip.y < 160 ? tooltip.y + 16 : tooltip.y - 60,
                    background: '#0c1120',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '6px 10px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}>
                      {tooltip.year} · {tooltip.pct.toFixed(1)}% displacement
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: 'var(--text-muted)', marginTop: 2,
                    }}>
                      Median at {tooltip.year}: {tooltip.medianPct.toFixed(1)}%
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{
              marginTop: 10, fontSize: 11, color: 'var(--text-muted)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{YEAR_START}–{YEAR_END} horizon · share of workforce displaced</span>
              <span>{computeMs > 0 ? `${Math.round(computeMs)}ms compute` : ''}</span>
            </div>
          </div>
        </section>

        {/* Right: results */}
        <aside style={resultsColStyle}>
          <MetricCard
            label="Median displacement"
            value={`${Math.round(result.medianFinal * 100)}%`}
            color="var(--amber)"
            sub={`at ${YEAR_END} · 50th percentile outcome`}
          />
          <MetricCard
            label="90th percentile scenario"
            value={`${Math.round(result.p90Final * 100)}%`}
            color="var(--danger)"
            sub={`at ${YEAR_END} · the tail-risk world`}
          />
          <MetricCard
            label="Years to threshold"
            value={result.yearsToThresholdMedian != null
              ? `${result.yearsToThresholdMedian}y`
              : '—'}
            color="var(--text-primary)"
            sub={`median path time to ${params.stabilityThreshold}%`}
          />

          <BucketBars probs={result.bucketProbs} />

          <Assumptions
            open={assumptionsOpen}
            onToggle={() => setAssumptionsOpen(o => !o)}
            items={result.assumptions}
          />
        </aside>
      </div>
    </div>
  )
}

// ---------- Sub-components ----------

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#6b7794',
      padding: '14px 0 6px', borderBottom: '1px solid var(--border)',
      marginBottom: 10,
    }}>
      {title}
    </div>
  )
}

function Slider({ label, hint, min, max, step, value, onChange, displayValue }: {
  label: string; hint?: string; min: number; max: number; step: number
  value: number; onChange: (v: number) => void; displayValue: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span className="data-value" style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)',
        }}>
          {displayValue}
        </span>
      </div>
      <div style={{ padding: '0 8px' }}>
        <input
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function PinnedSlider(props: Parameters<typeof Slider>[0] & { pin: { at: number; label: string } }) {
  const { pin, ...rest } = props
  const pinPct = ((pin.at - rest.min) / (rest.max - rest.min)) * 100
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rest.label}</span>
        <span className="data-value" style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)',
        }}>
          {rest.displayValue}
        </span>
      </div>
      <div style={{ position: 'relative', padding: '0 8px' }}>
        <input
          type="range" min={rest.min} max={rest.max} step={rest.step}
          value={rest.value}
          onChange={e => rest.onChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{
          position: 'absolute', top: -2, left: `${pinPct}%`, transform: 'translateX(-50%)',
          width: 2, height: 20, background: 'var(--accent)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 20, left: `${pinPct}%`, transform: 'translateX(-50%)',
          fontSize: 9, color: 'var(--accent)', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {pin.label}
        </div>
      </div>
      {rest.hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 14 }}>{rest.hint}</div>}
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '7px 10px', fontSize: 12,
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 4,
          fontFamily: 'inherit',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function LegendItem({ color, label, solid, swatch }: { color: string; label: string; solid?: boolean; swatch?: boolean }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {solid && <span style={{ width: 18, height: 2, background: color, display: 'inline-block' }} />}
      {swatch && <span style={{ width: 12, height: 10, background: color, display: 'inline-block', borderRadius: 2 }} />}
      {label}
    </span>
  )
}

function MetricCard({ label, value, color, sub }: {
  label: string; value: string; color: string; sub: string
}) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: 14,
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div className="data-value" style={{
        fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 500, color, lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        {sub}
      </div>
    </div>
  )
}

function BucketBars({ probs }: { probs: Record<string, number> }) {
  const rows: Array<{ key: string; label: string; range: string; color: string; p: number }> = [
    { key: 'minimal', label: 'Minimal disruption', range: '<10%', color: 'var(--success)', p: probs.minimal },
    { key: 'gradual', label: 'Gradual transition', range: '10–25%', color: 'var(--accent)', p: probs.gradual },
    { key: 'significant', label: 'Significant displacement', range: '25–40%', color: 'var(--amber)', p: probs.significant },
    { key: 'mass', label: 'Mass displacement', range: '40–60%', color: '#f97316', p: probs.mass },
    { key: 'instability', label: 'Social instability', range: '>60%', color: 'var(--danger)', p: probs.instability },
  ]
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 6, padding: 14, marginBottom: 10,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
        Outcome probability at {YEAR_END}
      </div>
      {rows.map(r => (
        <div key={r.key} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{r.range}</span>
            </span>
            <span className="data-value" style={{
              fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
            }}>
              {(r.p * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(0.5, r.p * 100)}%`, height: '100%',
              background: r.color,
              transition: 'width var(--motion-normal, 200ms) ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Assumptions({ open, onToggle, items }: {
  open: boolean; onToggle: () => void; items: Array<{ label: string; expr: string }>
}) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 6, padding: 14,
    }}>
      <button
        onClick={onToggle}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%',
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-muted)', fontWeight: 600,
        }}
      >
        <span>Assumptions & formulas</span>
        <span style={{ fontSize: 14 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {items.map((it, i) => (
            <div key={i} style={{
              padding: '6px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              fontSize: 11,
            }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{it.label}</div>
              <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5 }}>
                {it.expr}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Styles ----------

const wrapStyle: React.CSSProperties = {
  padding: '20px 24px 40px',
  width: '100%',
  boxSizing: 'border-box',
  overflowY: 'auto',
  height: '100%',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 280px) 1fr minmax(260px, 320px)',
  gap: 16,
  alignItems: 'start',
}

const paramColStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 16px 16px',
  position: 'sticky',
  top: 0,
}

const chartColStyle: React.CSSProperties = {
  minWidth: 0,
}

const resultsColStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
}
