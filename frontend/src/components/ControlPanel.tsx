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
  activeTab?: string
}

export default function ControlPanel({ state, onChange, activeTab }: ControlPanelProps) {
  const showMapControls = !activeTab || activeTab === 'map'
  const uncertainty = getUncertaintyState(state.year)
  const bandInfo = BAND_LABELS[uncertainty.band]

  return (
    <div style={{ padding: '0 16px 16px', fontSize: 12 }}>
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

      {/* Section 3: Map Layer — only on Map tab */}
      {showMapControls && (
        <>
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

          <OverlayToggle label="Company displacement dots"
            checked={state.showCompanyDots}
            onChange={v => onChange({ showCompanyDots: v })}
            info="Shows verified AI-driven layoff events from 22 companies. Dot size = headcount impact. Red = high confidence, orange = moderate."
          />
          <OverlayToggle label="Reshoring paradox (mfg counties)"
            checked={state.showReshoringParadox}
            onChange={v => onChange({ showReshoringParadox: v })}
            info="Manufacturing counties that benefit from reshoring but face accelerated robotics automation. Tariffs boost factory returns but also fund robot deployment."
          />
          <OverlayToggle label="Transfer payment dependency"
            checked={state.showTransferDependency}
            onChange={v => onChange({ showTransferDependency: v })}
            info="Blue tint intensity shows government transfer payments as % of personal income (Social Security, Medicare, unemployment). Higher = more dependent on federal spending floor."
          />
          <OverlayToggle label="K-shape divergence"
            checked={state.showKshapeDivergence}
            onChange={v => onChange({ showKshapeDivergence: v })}
            info="Pink tint intensity shows equity-to-wage ratio — how much local wealth depends on asset prices vs. wages. Higher = more vulnerable to K-shaped recovery dynamics."
          />
        </>
      )}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      color: '#6b7794',
      letterSpacing: '0.12em',
      padding: '0 16px 6px',
      borderBottom: '1px solid var(--border)',
      margin: '18px -16px 10px',
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
  const [pos, setPos] = useState({ x: 0, y: 0 })
  return (
    <span style={{ display: 'inline-block' }}>
      <button
        onClick={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect()
          setPos({ x: rect.right + 8, y: rect.top })
          setShow(!show)
        }}
        style={{
          background: 'none', border: '1px solid #555', borderRadius: '50%',
          width: 14, height: 14, fontSize: 9, color: '#888', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1, flexShrink: 0,
        }}
      >i</button>
      {show && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
          background: '#0a0a12', border: '1px solid #555', borderRadius: 4,
          padding: '8px 10px', fontSize: 10, color: '#ddd',
          width: 220, lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
        }}>
          {text}
          <div
            onClick={() => setShow(false)}
            style={{ color: '#888', cursor: 'pointer', marginTop: 4, fontSize: 9, textAlign: 'right' }}
          >
            dismiss
          </div>
        </div>
      )}
    </span>
  )
}

function OverlayToggle({ label, checked, onChange, info }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; info: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
      <ToggleControl label={label} checked={checked} onChange={onChange} />
      <InfoTip text={info} />
    </div>
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
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'var(--text-secondary)', marginBottom: 4,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 30px 8px 10px',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  color: 'var(--text-primary)',
  backgroundColor: '#0c1120',
  border: '1px solid var(--border-strong)',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage:
    'linear-gradient(45deg, transparent 50%, #9aa6be 50%), linear-gradient(135deg, #9aa6be 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
  backgroundSize: '5px 5px, 5px 5px',
  backgroundRepeat: 'no-repeat',
  cursor: 'pointer',
}
