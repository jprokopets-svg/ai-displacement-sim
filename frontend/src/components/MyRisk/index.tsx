import { useEffect, useMemo, useRef, useState } from 'react'
import { searchOccupations, fetchCounties } from '../../utils/api'
import {
  DEFAULT_ANSWERS, computeRisk, probabilityColor, resilienceColor,
  type FormAnswers, type Industry, type CompanySize, type Seniority,
  type YesNoSome, type AiUsage, type TechLiteracy, type SkillsType, type SalaryBand,
} from './scoring'
import { downloadCard, shareTextFor } from './shareCard'

type Step = 1 | 2 | 3 | 4 | 5 | 'output'

interface Company {
  name: string
  sector?: string
  ticker?: string
}

interface County {
  county_fips: string
  county_name: string
  exposure_percentile: number
}

interface Props {
  companyData: Company[]
}

const INDUSTRIES: Industry[] = [
  'Technology', 'Finance', 'Healthcare', 'Legal', 'Education',
  'Manufacturing', 'Retail', 'Government', 'Media', 'Transportation', 'Other',
]
const COMPANY_SIZES: CompanySize[] = ['Under 50', '50-500', '500-5000', 'Over 5000', 'Public company']
const SENIORITIES: Seniority[] = ['Entry level', 'Mid level', 'Senior', 'Manager', 'Director', 'Executive']
const TECH_LITERACIES: TechLiteracy[] = ['Non-technical', 'Some technical skills', 'Technical', 'Highly technical']
const SKILLS_TYPES: SkillsType[] = [
  'Relational/interpersonal', 'Creative/judgment-based', 'Analytical/data',
  'Routine/process-based', 'Physical/manual',
]
const SALARY_BANDS: SalaryBand[] = ['Above median', 'At median', 'Below median']

export default function MyRisk({ companyData }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [answers, setAnswers] = useState<FormAnswers>(DEFAULT_ANSWERS)
  const [counties, setCounties] = useState<County[]>([])

  useEffect(() => {
    fetchCounties()
      .then(d => setCounties((d.counties || []) as County[]))
      .catch(() => {})
  }, [])

  const update = <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) =>
    setAnswers(prev => ({ ...prev, [k]: v }))

  // Auto-check company against displacement feed whenever companyName changes
  useEffect(() => {
    if (!answers.companyName.trim()) {
      if (answers.companyInFeed) update('companyInFeed', false)
      return
    }
    const q = answers.companyName.trim().toLowerCase()
    const hit = companyData.some(c => (c.name || '').toLowerCase().includes(q) && q.length >= 3)
    if (hit !== answers.companyInFeed) update('companyInFeed', hit)

  }, [answers.companyName, companyData])

  const canAdvance = (s: Step): boolean => {
    if (s === 1) return answers.jobTitle.trim().length > 1 && !!answers.industry
    if (s === 2) return !!answers.companySize && !!answers.sector
    if (s === 3) return !!answers.seniority && !!answers.tacitKnowledge && !!answers.clientFacing
    if (s === 4) return !!answers.aiUsage && !!answers.techLiteracy && !!answers.professionalLicense && !!answers.skillsType
    if (s === 5) return !!answers.salaryBand
    return true
  }

  const risk = useMemo(() => computeRisk(answers), [answers])

  return (
    <div style={containerStyle}>
      <ProgressBar step={step} />

      <div style={cardStyle}>
        {step === 1 && <ScreenRole answers={answers} update={update} />}
        {step === 2 && <ScreenCompany answers={answers} update={update} />}
        {step === 3 && <ScreenExperience answers={answers} update={update} />}
        {step === 4 && <ScreenSkills answers={answers} update={update} />}
        {step === 5 && <ScreenLocation answers={answers} update={update} counties={counties} />}
        {step === 'output' && <OutputScreen answers={answers} risk={risk} />}
      </div>

      {step !== 'output' && (
        <div style={navRowStyle}>
          <button
            onClick={() => setStep(s => (s === 1 ? 1 : ((s as number) - 1) as Step))}
            disabled={step === 1}
            style={secondaryBtn(step === 1)}
          >
            ← Back
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Step {step} of 5
          </div>
          <button
            onClick={() => {
              if (!canAdvance(step)) return
              if (step === 5) setStep('output')
              else setStep(((step as number) + 1) as Step)
            }}
            disabled={!canAdvance(step)}
            style={primaryBtn(!canAdvance(step))}
          >
            {step === 5 ? 'See My Risk →' : 'Next →'}
          </button>
        </div>
      )}

      {step === 'output' && (
        <div style={navRowStyle}>
          <button onClick={() => setStep(1)} style={secondaryBtn(false)}>
            ← Start over
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Personal risk profile
          </div>
          <div />
        </div>
      )}
    </div>
  )
}

// ---------- Screens ----------

function ScreenRole({
  answers, update,
}: { answers: FormAnswers; update: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void }) {
  const [options, setOptions] = useState<Array<{ soc_code: string; occupation_title: string; ai_exposure: number }>>([])
  const [open, setOpen] = useState(false)
  const debounced = useDebounce(answers.jobTitle, 250)

  useEffect(() => {
    if (debounced.length < 2) { setOptions([]); return }
    let cancelled = false
    searchOccupations(debounced)
      .then(d => { if (!cancelled) setOptions(((d.occupations || []) as typeof options).slice(0, 8)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [debounced])

  return (
    <>
      <Eyebrow>Step 1 — Role</Eyebrow>
      <H1>What do you do?</H1>

      <Field label="Job title">
        <div style={{ position: 'relative' }}>
          <input
            value={answers.jobTitle}
            onChange={e => { update('jobTitle', e.target.value); update('socCode', null); update('baseExposure', null); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="e.g. Paralegal, Warehouse associate, Product manager"
            style={inputStyle}
          />
          {open && options.length > 0 && (
            <div style={dropdownStyle}>
              {options.map(o => (
                <div
                  key={o.soc_code}
                  onMouseDown={() => {
                    update('jobTitle', o.occupation_title)
                    update('socCode', o.soc_code)
                    update('baseExposure', o.ai_exposure)
                    setOpen(false)
                  }}
                  style={dropdownItemStyle}
                >
                  <span>{o.occupation_title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.soc_code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {answers.socCode && (
          <div style={hintStyle}>
            Matched: <strong>{answers.jobTitle}</strong> (SOC {answers.socCode}) —
            base exposure {(answers.baseExposure! * 100).toFixed(0)}%
          </div>
        )}
        {!answers.socCode && answers.jobTitle.length >= 2 && (
          <div style={{ ...hintStyle, color: 'var(--amber)' }}>
            Free text — risk estimate will use a generic baseline. Select from suggestions for a precise match.
          </div>
        )}
      </Field>

      <Field label="Industry">
        <Select
          value={answers.industry}
          onChange={v => update('industry', v as Industry)}
          options={INDUSTRIES.map(i => ({ value: i, label: i }))}
          placeholder="Select industry"
        />
      </Field>

      <Field label="Specific function within the role">
        <textarea
          value={answers.specificFunction}
          onChange={e => update('specificFunction', e.target.value)}
          placeholder="e.g. 'I write code' vs 'I manage teams of engineers'"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
        />
      </Field>
    </>
  )
}

function ScreenCompany({
  answers, update,
}: { answers: FormAnswers; update: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void }) {
  return (
    <>
      <Eyebrow>Step 2 — Company</Eyebrow>
      <H1>Where do you work?</H1>

      <Field label="Company name">
        <input
          value={answers.companyName}
          onChange={e => update('companyName', e.target.value)}
          placeholder="e.g. Acme Corp"
          style={inputStyle}
        />
      </Field>

      {answers.companyInFeed && (
        <div style={warningBannerStyle}>
          <strong>⚠ Your employer has documented AI displacement activity.</strong>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>
            This company appears in our news feed of verified AI-driven workforce changes.
          </div>
        </div>
      )}

      <Field label="Company size">
        <Select
          value={answers.companySize}
          onChange={v => update('companySize', v as CompanySize)}
          options={COMPANY_SIZES.map(s => ({ value: s, label: s }))}
          placeholder="Select size"
        />
      </Field>

      <Field label="Sector">
        <Select
          value={answers.sector}
          onChange={v => update('sector', v as Industry)}
          options={INDUSTRIES.map(i => ({ value: i, label: i }))}
          placeholder="Select sector"
        />
      </Field>
    </>
  )
}

function ScreenExperience({
  answers, update,
}: { answers: FormAnswers; update: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void }) {
  return (
    <>
      <Eyebrow>Step 3 — Experience</Eyebrow>
      <H1>How long, how senior, how replaceable?</H1>

      <Field label={`Years in this role: ${answers.yearsInRole}`}>
        <input
          type="range" min={0} max={30} step={1}
          value={answers.yearsInRole}
          onChange={e => update('yearsInRole', Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </Field>

      <Field label="Seniority level">
        <Select
          value={answers.seniority}
          onChange={v => update('seniority', v as Seniority)}
          options={SENIORITIES.map(s => ({ value: s, label: s }))}
          placeholder="Select seniority"
        />
      </Field>

      <Field label="Do you have significant tacit knowledge that is hard to document?">
        <Segmented
          value={answers.tacitKnowledge}
          onChange={v => update('tacitKnowledge', v as YesNoSome)}
          options={['Yes', 'Some', 'No']}
        />
      </Field>

      <Field label="Do you work directly with clients or customers?">
        <Segmented
          value={answers.clientFacing}
          onChange={v => update('clientFacing', v as 'Yes' | 'No')}
          options={['Yes', 'No']}
        />
      </Field>
    </>
  )
}

function ScreenSkills({
  answers, update,
}: { answers: FormAnswers; update: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void }) {
  return (
    <>
      <Eyebrow>Step 4 — Skills</Eyebrow>
      <H1>What protects you?</H1>

      <Field label="Do you currently use AI tools in your daily work?">
        <Segmented
          value={answers.aiUsage}
          onChange={v => update('aiUsage', v as AiUsage)}
          options={['Yes', 'Learning', 'No']}
        />
      </Field>

      <Field label="Technical literacy">
        <Select
          value={answers.techLiteracy}
          onChange={v => update('techLiteracy', v as TechLiteracy)}
          options={TECH_LITERACIES.map(s => ({ value: s, label: s }))}
          placeholder="Select level"
        />
      </Field>

      <Field label="Do you hold a professional license or certification that is legally required for your work?">
        <Segmented
          value={answers.professionalLicense}
          onChange={v => update('professionalLicense', v as 'Yes' | 'No')}
          options={['Yes', 'No']}
        />
      </Field>

      <Field label="Your skills are primarily…">
        <Select
          value={answers.skillsType}
          onChange={v => update('skillsType', v as SkillsType)}
          options={SKILLS_TYPES.map(s => ({ value: s, label: s }))}
          placeholder="Select dominant skill type"
        />
      </Field>
    </>
  )
}

function ScreenLocation({
  answers, update, counties,
}: {
  answers: FormAnswers
  update: <K extends keyof FormAnswers>(k: K, v: FormAnswers[K]) => void
  counties: County[]
}) {
  const [query, setQuery] = useState(answers.countyName)
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.trim().toLowerCase()
    return counties
      .filter(c => (c.county_name || '').toLowerCase().includes(q))
      .slice(0, 10)
  }, [query, counties])

  return (
    <>
      <Eyebrow>Step 5 — Location</Eyebrow>
      <H1>Where are you?</H1>

      <Field label="County or city">
        <div style={{ position: 'relative' }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); update('countyName', e.target.value); update('countyFips', null); update('countyPercentile', null); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Start typing your county (e.g. Fairfax County, Virginia)"
            style={inputStyle}
          />
          {open && matches.length > 0 && (
            <div style={dropdownStyle}>
              {matches.map(c => (
                <div
                  key={c.county_fips}
                  onMouseDown={() => {
                    setQuery(c.county_name)
                    update('countyName', c.county_name)
                    update('countyFips', c.county_fips)
                    update('countyPercentile', c.exposure_percentile)
                    setOpen(false)
                  }}
                  style={dropdownItemStyle}
                >
                  <span>{c.county_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    p{Math.round(c.exposure_percentile)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="Is your salary significantly above or below median for your role?">
        <Segmented
          value={answers.salaryBand}
          onChange={v => update('salaryBand', v as SalaryBand)}
          options={SALARY_BANDS}
        />
      </Field>
    </>
  )
}

// ---------- Output screen ----------

function OutputScreen({ answers, risk }: {
  answers: FormAnswers
  risk: ReturnType<typeof computeRisk>
}) {
  const shareRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const card = {
    jobTitle: answers.jobTitle || 'Your role',
    probability: risk.probability,
    timelineLabel: risk.timelineLabel,
    countyName: answers.countyName,
    siteUrl: 'ai-displacement-sim-4x9g.vercel.app',
  }

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareTextFor(card))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div ref={shareRef}>
      <Eyebrow>Personal Risk Profile</Eyebrow>
      <H1 style={{ marginBottom: 4 }}>{answers.jobTitle || 'Your role'}</H1>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        {answers.industry || '—'} · {answers.companyName || 'Unspecified employer'}
        {answers.companyInFeed && (
          <span style={{ color: 'var(--amber)', marginLeft: 8 }}>
            · employer flagged
          </span>
        )}
      </div>

      {/* 4 main metrics */}
      <div style={metricsGridStyle}>
        <Metric
          label="Displacement probability"
          value={`${risk.probability}%`}
          color={probabilityColor(risk.probability)}
          sub="within 10 years"
        />
        <Metric
          label="Timeline"
          value={risk.timelineLabel}
          color="var(--text-primary)"
          sub={`Meaningful pressure begins around ${risk.timelineYear}`}
        />
        <Metric
          label="Resilience score"
          value={`${risk.resilience}`}
          color={resilienceColor(risk.resilience)}
          sub="0 = fully exposed · 100 = deeply protected"
        />
        <Metric
          label="County context"
          value={answers.countyPercentile != null ? `p${Math.round(answers.countyPercentile)}` : '—'}
          color="var(--text-primary)"
          sub={risk.countyContextLabel}
        />
      </div>

      <div style={disclaimerStyle}>
        Scores are estimates based on occupational task composition, company
        data, and personal factors. Not a guarantee of employment outcomes.
      </div>

      {/* Factors */}
      <div style={factorsRowStyle}>
        <FactorList title="What protects you" tone="positive" items={risk.positiveFactors} />
        <FactorList title="What raises your risk" tone="negative" items={risk.negativeFactors} />
      </div>

      {/* Action items */}
      <Section title="Three moves that would meaningfully lower your risk">
        <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          {risk.actionItems.map((a, i) => <li key={i} style={{ marginBottom: 8 }}>{a}</li>)}
        </ol>
      </Section>

      {/* Replacement mechanism */}
      <Section title="What's most likely to replace this role">
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          {risk.replacementMechanism}
        </p>
      </Section>

      {/* Share + Substack */}
      <div style={shareRowStyle}>
        <button onClick={() => downloadCard(card)} style={shareBtnStyle}>
          ↓ Download share card (PNG)
        </button>
        <button onClick={copyShare} style={secondaryShareBtnStyle}>
          {copied ? 'Copied!' : 'Copy share text'}
        </button>
      </div>

      <a
        href="https://substack.com"
        target="_blank"
        rel="noopener noreferrer"
        style={substackLinkStyle}
      >
        Read the full analysis of how this displacement unfolds →
      </a>
    </div>
  )
}

// ---------- Small presentational helpers ----------

function ProgressBar({ step }: { step: Step }) {
  const pct = step === 'output' ? 100 : (Number(step) / 5) * 100
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, letterSpacing: '0.08em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        <span>Role</span><span>Company</span><span>Experience</span><span>Skills</span><span>Location</span><span>Result</span>
      </div>
      <div style={{ height: 3, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, var(--accent), #60a5fa)',
          transition: 'width var(--motion-normal, 200ms) ease',
        }} />
      </div>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function H1({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h1 style={{
      fontSize: 24, fontWeight: 600, color: 'var(--text-primary)',
      marginBottom: 20, letterSpacing: '-0.01em',
      ...style,
    }}>
      {children}
    </h1>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Select({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">{placeholder || 'Select…'}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Segmented({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: value === o ? 'var(--bg-panel-hover)' : 'var(--bg-secondary)',
            color: value === o ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: value === o ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all var(--motion-fast)',
          }}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Metric({ label, value, color, sub }: {
  label: string; value: string; color: string; sub: string
}) {
  return (
    <div style={metricStyle}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div className="data-value" style={{
        fontFamily: 'var(--font-mono, "DM Mono", ui-monospace, monospace)',
        fontSize: 36,
        fontWeight: 500,
        color,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
        {sub}
      </div>
    </div>
  )
}

function FactorList({ title, tone, items }: {
  title: string; tone: 'positive' | 'negative'; items: string[]
}) {
  const color = tone === 'positive' ? 'var(--success)' : 'var(--danger)'
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color, marginBottom: 8, fontWeight: 600 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>None identified.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {items.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f}</li>)}
        </ul>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(h)
  }, [value, delay])
  return debounced
}

// ---------- Styles ----------

const containerStyle: React.CSSProperties = {
  maxWidth: 780,
  margin: '0 auto',
  padding: '24px 24px 56px',
  width: '100%',
  overflowY: 'auto',
  height: '100%',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 28,
}

const navRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 16, gap: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  marginTop: 4,
  maxHeight: 240,
  overflowY: 'auto',
  zIndex: 50,
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
}

const dropdownItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex', justifyContent: 'space-between',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-primary)',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
}

const warningBannerStyle: React.CSSProperties = {
  background: 'var(--amber-dim, rgba(245, 158, 11, 0.15))',
  border: '1px solid var(--amber)',
  color: 'var(--amber)',
  borderRadius: 4,
  padding: '10px 14px',
  marginBottom: 18,
  fontSize: 13,
}

const metricsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 14,
  marginBottom: 24,
}

const metricStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 16,
  minHeight: 130,
}

const disclaimerStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
  marginTop: -8,
  marginBottom: 18,
  fontStyle: 'italic',
}

const factorsRowStyle: React.CSSProperties = {
  display: 'flex', gap: 24,
  marginTop: 8,
  padding: '16px 0',
  borderTop: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
}

const shareRowStyle: React.CSSProperties = {
  display: 'flex', gap: 10, marginTop: 28,
}

const shareBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const secondaryShareBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
}

const substackLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 20,
  fontSize: 12,
  color: 'var(--text-muted)',
  textDecoration: 'none',
  borderBottom: '1px dotted var(--text-muted)',
  paddingBottom: 2,
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '9px 18px',
    background: disabled ? 'var(--bg-panel-hover)' : 'var(--accent)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '9px 18px',
    background: 'transparent',
    color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
