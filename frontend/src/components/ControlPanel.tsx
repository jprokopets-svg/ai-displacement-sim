import { useState } from 'react'
import { getUncertaintyState, BAND_LABELS } from '../utils/uncertainty'
import type { DisplayMode } from '../utils/buckets'

export interface ScenarioState {
  year: number
  feedbackAggressiveness: number
  tradePolicy: 'current' | 'free_trade' | 'escalating_tariffs'
  govtResponse: 'none' | 'retraining' | 'ubi'
  corporateProfit: 'baseline' | 'surge' | 'decline'
  equityLoop: 'intact' | 'breaks'
  fedResponse: 'hold' | 'cut' | 'zero'
  mapLayer: string
  displayMode: DisplayMode
  showCompanyDots: boolean
  showTransferDependency: boolean
  showKshapeDivergence: boolean
}

interface ControlPanelProps {
  state: ScenarioState
  onChange: (updates: Partial<ScenarioState>) => void
  showMapControls?: boolean
}

export default function ControlPanel({ state, onChange, showMapControls = false }: ControlPanelProps) {
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
      <div style={sliderWrapStyle}>
        <input
          type="range" min="2025" max="2040" step="1"
          value={state.year}
          onChange={e => onChange({ year: +e.target.value })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          Feedback Loop: {state.feedbackAggressiveness.toFixed(1)}
        </label>
        <InfoTip text="How aggressively AI displacement accelerates itself. Left = Goldman Sachs gradual baseline. Right = full self-reinforcing cascade." />
      </div>
      <div style={sliderWrapStyle}>
        <input
          type="range" min="0" max="1" step="0.05"
          value={state.feedbackAggressiveness}
          onChange={e => onChange({ feedbackAggressiveness: +e.target.value })}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{
        fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
        marginTop: 4, lineHeight: 1.4,
      }}>
        Year affects the projection panel on the right. The map shows current AI exposure (static).
      </div>
      <div style={{ height: 16 }} />

      {/* Section 2: Economic Scenario */}
      <SectionHeader title="Economic Scenario" />

      <SelectControl label="Trade Policy" value={state.tradePolicy}
        onChange={v => onChange({ tradePolicy: v as ScenarioState['tradePolicy'] })}
        info="Bartik shift-share response using BEA Input-Output Leontief-propagated coefficients. Manufacturing-heavy counties shift most. Source: Autor-Dorn-Hanson 2013."
        options={[
          { value: 'current', label: 'Current tariffs (baseline)' },
          { value: 'free_trade', label: 'Trade liberalization' },
          { value: 'escalating_tariffs', label: 'Escalating tariffs' },
        ]}
      />
      <SelectControl label="Fed Response" value={state.fedResponse}
        onChange={v => onChange({ fedResponse: v as ScenarioState['fedResponse'] })}
        info="Bartik shift-share response via BEA IO propagation. Construction and real estate counties shift most. Source: Carlino & DeFina 1998."
        options={[
          { value: 'hold', label: 'Hold rates (baseline)' },
          { value: 'cut', label: 'Rate cuts (150bp)' },
          { value: 'zero', label: 'Zero rate policy (400bp)' },
        ]}
      />
      <div style={{
        fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
        marginTop: 8, padding: '6px 0', borderTop: '1px solid var(--border)',
        lineHeight: 1.4,
      }}>
        Additional scenario controls coming in v3.
      </div>

      {/* Section 3: Map Layer — only when map is visible */}
      {showMapControls && (
        <>
          <SectionHeader title="Map Layer" />

          <SelectControl label="Color by" value={state.mapLayer}
            onChange={v => onChange({ mapLayer: v })}
            options={[
              { value: 'composite', label: 'AI exposure' },
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
      color: 'var(--text-muted)',
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

const sliderWrapStyle: React.CSSProperties = {
  padding: '0 8px',
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
    'linear-gradient(45deg, transparent 50%, #d0d8e4 50%), linear-gradient(135deg, #d0d8e4 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
  backgroundSize: '5px 5px, 5px 5px',
  backgroundRepeat: 'no-repeat',
  cursor: 'pointer',
}
