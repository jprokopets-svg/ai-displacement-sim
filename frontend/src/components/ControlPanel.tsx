import { useState } from 'react'
import { getUncertaintyState, BAND_LABELS } from '../utils/uncertainty'

export interface ScenarioState {
  year: number
  feedbackAggressiveness: number
  tradePolicy: 'current' | 'free_trade' | 'escalating_tariffs'
  govtResponse: 'none' | 'retraining' | 'ubi'
  corporateProfit: 'baseline' | 'surge' | 'decline'
  equityLoop: 'intact' | 'breaks'
  fedResponse: 'hold' | 'cut' | 'zero'
  mapLayer: string
  showCompanyDots: boolean
  showReshoringParadox: boolean
  showTransferDependency: boolean
  showKshapeDivergence: boolean
}

interface ControlPanelProps {
  state: ScenarioState
  onChange: (updates: Partial<ScenarioState>) => void
}

export default function ControlPanel({ state, onChange }: ControlPanelProps) {
  const uncertainty = getUncertaintyState(state.year)
  const bandInfo = BAND_LABELS[uncertainty.band]

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 50,
      background: 'var(--bg-panel)', borderRadius: 8,
      border: '1px solid var(--border)', padding: 12,
      width: 260, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
      fontSize: 12,
    }}>
      {/* Section 1: Time and Scenario */}
      <SectionHeader title="Time & Scenario" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          Year: <strong>{state.year}</strong>
          <span style={{ color: bandInfo.color, marginLeft: 6, fontSize: 10 }}>{bandInfo.label}</span>
        </label>
        <InfoTip text="Projection year. Near-term uses deployment evidence. Long-term uses scenario modeling with wider uncertainty." />
      </div>
      <input
        type="range" min="2025" max="2040" step="1"
        value={state.year}
        onChange={e => onChange({ year: +e.target.value })}
        style={{ width: '100%' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          Feedback Loop: {state.feedbackAggressiveness.toFixed(1)}
        </label>
        <InfoTip text="How aggressively AI displacement accelerates itself. Left = Goldman Sachs gradual baseline. Right = full self-reinforcing cascade." />
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="range" min="0" max="1" step="0.05"
          value={state.feedbackAggressiveness}
          onChange={e => onChange({ feedbackAggressiveness: +e.target.value })}
          style={{ width: '100%' }}
        />
        {/* Author prediction marker at 7.5/10 = 0.75 */}
        <div style={{
          position: 'absolute', top: -2, left: '75%', transform: 'translateX(-50%)',
          width: 2, height: 20, background: 'var(--accent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 18, left: '75%', transform: 'translateX(-50%)',
          fontSize: 9, color: 'var(--accent)', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          Author prediction
        </div>
      </div>
      <div style={{ height: 16 }} />

      {/* Section 2: Economic Scenario */}
      <SectionHeader title="Economic Scenario" />

      <SelectControl label="Trade Policy" value={state.tradePolicy}
        onChange={v => onChange({ tradePolicy: v as ScenarioState['tradePolicy'] })}
        info="Current tariffs boost manufacturing robotics ROI. Free trade increases offshoring risk. Escalating tariffs amplify reshoring paradox."
        options={[
          { value: 'current', label: 'Current tariffs' },
          { value: 'free_trade', label: 'Free trade' },
          { value: 'escalating_tariffs', label: 'Escalating tariffs' },
        ]}
      />
      <SelectControl label="Government Response" value={state.govtResponse}
        onChange={v => onChange({ govtResponse: v as ScenarioState['govtResponse'] })}
        info="Policy intervention reduces displacement over time but requires deficit spending."
        options={[
          { value: 'none', label: 'No intervention' },
          { value: 'retraining', label: 'Retraining programs' },
          { value: 'ubi', label: 'Universal Basic Income' },
        ]}
      />
      <SelectControl label="Corporate Profits" value={state.corporateProfit}
        onChange={v => onChange({ corporateProfit: v as ScenarioState['corporateProfit'] })}
        info="Profit surge generates tax revenue that funds government floor. Decline accelerates deficit spiral."
        options={[
          { value: 'baseline', label: 'Baseline growth' },
          { value: 'surge', label: 'Profit surge (10x)' },
          { value: 'decline', label: 'Profit decline' },
        ]}
      />
      <SelectControl label="AI Equity Loop" value={state.equityLoop}
        onChange={v => onChange({ equityLoop: v as ScenarioState['equityLoop'] })}
        info="Speculative. Loop intact = AI capex sustains equity wealth effect. Loop breaks = AI investment disappoints, triggering spending contraction."
        options={[
          { value: 'intact', label: 'Loop intact' },
          { value: 'breaks', label: 'Loop breaks (speculative)' },
        ]}
      />
      <SelectControl label="Fed Response" value={state.fedResponse}
        onChange={v => onChange({ fedResponse: v as ScenarioState['fedResponse'] })}
        info="Federal Reserve interest rate policy. Long-term projections assume policy normalization after 2-5 years regardless of initial stance."
        options={[
          { value: 'hold', label: 'Hold rates' },
          { value: 'cut', label: 'Rate cuts' },
          { value: 'zero', label: 'Zero rate policy' },
        ]}
      />

      {/* Section 3: Map Layer */}
      <SectionHeader title="Map Layer" />

      <SelectControl label="Color by" value={state.mapLayer}
        onChange={v => onChange({ mapLayer: v })}
        options={[
          { value: 'composite', label: 'Composite displacement' },
          { value: 'cognitive', label: 'Cognitive AI only' },
          { value: 'robotics', label: 'Robotics only' },
          { value: 'agentic', label: 'Agentic AI' },
          { value: 'offshoring', label: 'Offshoring risk' },
          { value: 'fragility', label: 'Local economy fragility' },
          { value: 'govt_floor', label: 'Government floor strength' },
          { value: 'cascade', label: 'Competitive cascade' },
        ]}
      />

      {/* Section 4: Overlays */}
      <SectionHeader title="Overlays" />

      <ToggleControl label="Company displacement dots"
        checked={state.showCompanyDots}
        onChange={v => onChange({ showCompanyDots: v })}
      />
      <ToggleControl label="Reshoring paradox (mfg counties)"
        checked={state.showReshoringParadox}
        onChange={v => onChange({ showReshoringParadox: v })}
      />
      <ToggleControl label="Transfer payment dependency"
        checked={state.showTransferDependency}
        onChange={v => onChange({ showTransferDependency: v })}
      />
      <ToggleControl label="K-shape divergence"
        checked={state.showKshapeDivergence}
        onChange={v => onChange({ showKshapeDivergence: v })}
      />
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      color: 'var(--text-muted)', letterSpacing: '0.05em',
      marginTop: 12, marginBottom: 6,
      paddingBottom: 4, borderBottom: '1px solid var(--border)',
    }}>
      {title}
    </div>
  )
}

function SelectControl({ label, value, onChange, options, info }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  info?: string
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
        {info && <InfoTip text={info} />}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShow(!show)}
        style={{
          background: 'none', border: '1px solid #555', borderRadius: '50%',
          width: 14, height: 14, fontSize: 9, color: '#888', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1, flexShrink: 0,
        }}
      >i</button>
      {show && (
        <div style={{
          position: 'absolute', left: 18, top: -4, zIndex: 200,
          background: '#1a1a25', border: '1px solid #444', borderRadius: 4,
          padding: '6px 8px', fontSize: 10, color: '#ccc',
          width: 200, lineHeight: 1.4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          {text}
          <div
            onClick={() => setShow(false)}
            style={{ color: '#666', cursor: 'pointer', marginTop: 4, fontSize: 9 }}
          >
            close
          </div>
        </div>
      )}
    </span>
  )
}

function ToggleControl({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 6, cursor: 'pointer', fontSize: 11,
      color: checked ? '#fff' : 'var(--text-secondary)',
      padding: '3px 0',
      userSelect: 'none',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        border: checked ? '2px solid var(--accent)' : '2px solid #555',
        background: checked ? 'var(--accent)' : 'transparent',
        transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ display: 'none' }} />
      {label}
    </label>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2,
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '3px 6px', borderRadius: 4, fontSize: 11,
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  border: '1px solid var(--border)',
}
