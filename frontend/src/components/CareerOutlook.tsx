import { useEffect, useState } from 'react'
import { searchOccupations } from '../utils/api'
import { getExposureColor } from '../utils/colors'

// ---------- Types + constants ----------

const START_YEARS = ['Fall 2025', 'Fall 2026', 'Fall 2027', 'Fall 2028'] as const
const DEGREE_LENGTHS = [
  { value: 2, label: '2 years (Associate)' },
  { value: 4, label: '4 years (Bachelor\'s)' },
  { value: 6, label: '6 years (Bachelor\'s + Master\'s)' },
  { value: 8, label: '8 years (Bachelor\'s + PhD/JD/MD)' },
] as const

type Temperature = 'HOT' | 'WARM' | 'COOLING' | 'COLD'

interface OccMatch {
  soc_code: string
  occupation_title: string
  ai_exposure: number
}

// Year modifier — simplified from scenarios.ts for standalone use.
function futureScore(base: number, year: number): number {
  if (year <= 2025) return base
  const yearsOut = year - 2025
  const timeBoost = yearsOut * 0.008
  const highBoost = base > 0.5 ? Math.min(1, yearsOut / 8) * 0.15 : 0
  const mod = 1.0 + timeBoost + highBoost
  return Math.min(1, Math.max(0, base * mod))
}

function getTemperature(gradScore: number): Temperature {
  if (gradScore < 0.30) return 'HOT'
  if (gradScore < 0.45) return 'WARM'
  if (gradScore < 0.60) return 'COOLING'
  return 'COLD'
}

const TEMP_META: Record<Temperature, { color: string; label: string }> = {
  HOT:     { color: '#10b981', label: 'High demand, low displacement pressure, good entry conditions' },
  WARM:    { color: '#f59e0b', label: 'Moderate demand, some AI pressure but still hiring' },
  COOLING: { color: '#f97316', label: 'Declining new-hire demand, AI compressing entry level' },
  COLD:    { color: '#ef4444', label: 'Significant displacement pressure, entry-level hiring contracting' },
}

// ---------- SOC group → outlook templates ----------

const OUTLOOK_TEMPLATES: Record<string, (title: string, year: number, temp: Temperature) => string> = {
  '11': (t, y) => `Management roles like ${t} retain strong demand through ${y} — strategic judgment and cross-functional coordination are hard to automate. AI tools augment decision-making but don't replace the executive function. Entry conditions remain favorable for candidates who can demonstrate leadership.`,
  '13': (t, y, temp) => temp === 'COLD' ? `Financial AI agents are compressing entry-level ${t} demand. By ${y} automated audit, tax, and analysis platforms will handle much of what junior analysts do today. Specialize in advisory work requiring client trust and judgment.` : `Business and finance roles face moderate AI pressure by ${y}. ${t} roles that emphasize client relationships and complex judgment will fare better than pure analytical positions.`,
  '15': (t, y) => `AI coding tools are reshaping the entry-level software market. By ${y} junior ${t} roles face significant compression, but developers who can architect systems and work with AI tools are in growing demand. Your differentiation will be whether you use AI as a lever or compete against it.`,
  '17': (t, y) => `Engineering roles like ${t} face gradual AI pressure through ${y}. Generative design tools handle iteration-heavy work, but complex system design, regulatory compliance, and physical-world judgment remain human domains. The field is shifting, not disappearing.`,
  '19': (t, y) => `Research and science roles remain relatively protected through ${y}. AI accelerates hypothesis generation and data collection but cannot replace the creative insight that drives discovery. ${t} positions benefit from this dynamic.`,
  '21': (t, y) => `Community and social service roles like ${t} depend heavily on human empathy and trust — qualities AI cannot replicate. Demand through ${y} remains stable, though administrative portions of the work face automation.`,
  '23': (t, y, temp) => temp === 'COLD' ? `Legal AI tools like Harvey and CoCounsel are already compressing entry-level ${t} demand. By ${y} the entry-level market will be meaningfully smaller than today. Consider specializing in areas requiring human judgment — litigation strategy, client relationships, complex negotiations.` : `Legal roles face growing AI pressure but ${t} positions requiring courtroom presence, client trust, and strategic judgment retain strong demand through ${y}.`,
  '25': (t, y) => `Education roles like ${t} face moderate technology pressure through ${y}. AI tutoring platforms handle content delivery, but classroom management, mentorship, and social-emotional support remain deeply human. The role evolves more than it disappears.`,
  '27': (t, y) => `Creative and media roles face significant generative-AI pressure. By ${y} ${t} roles that compete on production volume will be compressed. Roles requiring original vision, brand strategy, and editorial judgment will command premium demand.`,
  '29': (t, y) => `Healthcare roles like ${t} remain among the most displacement-resistant fields through ${y}. Demand is projected to increase as the population ages faster than AI can replace clinical judgment. Entry conditions look favorable.`,
  '31': (t, y) => `Healthcare support roles like ${t} face limited AI displacement through ${y}. Physical patient care, emotional support, and clinical presence remain irreplaceable. Demand grows with an aging population.`,
  '33': (t, y) => `Protective service roles like ${t} benefit from physical presence requirements and public trust mandates. AI surveillance tools augment but do not replace these roles through ${y}.`,
  '35': (t, y) => `Food service roles like ${t} have limited current AI exposure — most tasks involve physical preparation and in-person service. Through ${y} the primary pressure comes from ordering automation and inventory AI, not LLMs. Positions requiring creativity and customer relationships hold value.`,
  '37': (t, y) => `Building and maintenance roles like ${t} have limited current AI exposure — most tasks involve physical work that LLMs cannot perform. Through ${y} demand remains steady for roles requiring on-site presence and hands-on skills.`,
  '39': (t, y) => `Personal service roles like ${t} depend on human interaction and trust. Through ${y} demand remains steady for roles requiring personal presence, though administrative booking and scheduling tasks move to AI.`,
  '41': (t, y) => `Sales roles face AI compression in prospecting and inside sales through ${y}. ${t} positions that depend on relationship-building, complex deal negotiation, and consultative selling remain strong. Pure transactional sales roles contract.`,
  '43': (t, y, temp) => temp === 'COLD' ? `Office and administrative support is among the most directly automatable categories. By ${y} ${t} roles face substantial compression from RPA, AI document processing, and chatbot customer service. Consider pivoting to roles with more judgment and less routine process.` : `Administrative roles face growing AI pressure. By ${y} ${t} positions emphasizing coordination, judgment, and human interaction fare better than routine process work.`,
  '45': (t, y) => `Agricultural roles like ${t} have limited current AI exposure — most tasks involve physical outdoor labor. Through ${y} roles requiring complex judgment, equipment management, and land stewardship retain strong demand.`,
  '47': (t, y) => `Construction trades like ${t} have limited current AI exposure — most tasks require on-site physical work. Through ${y} skilled trades requiring judgment and physical dexterity remain in strong demand. AI pressure is concentrated in planning and design, not field execution.`,
  '49': (t, y) => `Installation and repair roles like ${t} benefit from physical presence and diagnostic complexity. Predictive maintenance AI changes how problems are identified but not who fixes them. Demand through ${y} remains solid.`,
  '51': (t, y) => `Production and manufacturing roles like ${t} have limited current AI exposure — most tasks involve physical production-line work. Through ${y} quality control, complex fabrication, and equipment supervision roles adapt and retain demand.`,
  '53': (t, y) => `Transportation roles like ${t} have limited current AI exposure from LLMs — most tasks involve physical vehicle operation. Through ${y} the primary pressure comes from logistics optimization AI and route planning, not direct LLM displacement.`,
}

function getOutlook(socCode: string, title: string, year: number, temp: Temperature): string {
  const group = socCode.substring(0, 2)
  const fn = OUTLOOK_TEMPLATES[group]
  if (fn) return fn(title, year, temp)
  return `The outlook for ${title} through ${year} depends on how much of the role is routine and documentable versus judgment-based and relational. AI pressure increases across most fields, but roles requiring physical presence, client trust, or creative judgment face less displacement.`
}

// ---------- Actions per SOC group ----------

const ACTION_TEMPLATES: Record<string, string[]> = {
  '13': ['Get proficient with financial AI platforms (Bloomberg GPT, Kensho) during your degree', 'Build client advisory skills through internships — the human trust layer is your moat', 'Develop expertise in regulatory compliance — AI struggles with evolving legal interpretation'],
  '15': ['Build projects that use AI tools as components, not just learn to code', 'Develop system design and architecture skills — less automatable than implementation', 'Gain domain expertise in a specific industry — healthcare software, fintech, defense'],
  '17': ['Learn to work with generative design and simulation tools early', 'Focus on system-level thinking and physical-world constraints that AI cannot model well', 'Pursue internships that expose you to regulatory environments — compliance creates moats'],
  '23': ['Specialize in courtroom advocacy, client negotiation, or regulatory strategy', 'Learn to supervise AI legal tools — the future is human-AI legal teams, not replacement', 'Build domain expertise in an area with evolving regulation (AI law, crypto, biotech)'],
  '25': ['Develop curriculum design and assessment creation skills, not just content delivery', 'Learn to integrate AI tutoring platforms into teaching — augmentation, not competition', 'Build social-emotional learning expertise — the portion AI cannot touch'],
  '27': ['Develop a distinct creative voice and editorial perspective that AI cannot replicate', 'Learn to direct and curate AI-generated content rather than compete with it on volume', 'Build expertise in brand strategy and audience relationships, not just production'],
  '29': ['Pursue clinical specializations that require physical presence and complex judgment', 'Learn to work with diagnostic AI as a decision-support tool, not a competitor', 'Develop patient communication and trust-building skills — irreplaceable in healthcare'],
  '41': ['Focus on consultative and relationship-based selling skills, not transactional methods', 'Learn the AI tools your industry is adopting — become the rep who sells AI solutions', 'Build deep domain expertise in one industry vertical'],
  '43': ['Shift toward coordination, project management, and decision-support functions', 'Learn RPA and automation tools — become the person who deploys them, not the person they replace', 'Develop data literacy and reporting skills beyond basic spreadsheet work'],
  '47': ['Pursue specialized certifications in high-demand trades', 'Learn to work alongside robotics and automated construction equipment', 'Develop project estimation and management skills — harder to automate than physical execution'],
  '51': ['Learn robotics operation and maintenance — the factory of the future still needs people', 'Pursue quality control and process engineering skills', 'Gain expertise in complex fabrication that resists standardized automation'],
  '53': ['Prepare for a hybrid role managing autonomous systems rather than operating vehicles manually', 'Develop logistics coordination and fleet management skills', 'Consider specializing in complex-route or last-mile operations that automate later'],
}

function getActions(socCode: string): string[] {
  const group = socCode.substring(0, 2)
  return ACTION_TEMPLATES[group] ?? [
    'Develop skills that emphasize judgment, creativity, and human interaction',
    'Learn to use AI tools in your field as augmentation rather than competing with them',
    'Build domain expertise in a niche where training data is thin — specialization compounds',
  ]
}

// ---------- Main component ----------

export default function CareerOutlook() {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<OccMatch[]>([])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<OccMatch | null>(null)
  const [startYear, setStartYear] = useState(2025)
  const [degreeLen, setDegreeLen] = useState(4)
  const [copied, setCopied] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const debounced = useDebounce(query, 300)

  useEffect(() => {
    if (debounced.length < 2) { setOptions([]); return }
    let cancelled = false
    searchOccupations(debounced)
      .then(d => { if (!cancelled) setOptions(((d.occupations || []) as OccMatch[]).slice(0, 8)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [debounced])

  const gradYear = startYear + degreeLen
  const baseScore = selected?.ai_exposure ?? null
  const gradScore = baseScore != null ? futureScore(baseScore, gradYear) : null
  const todayScore = baseScore
  const temperature = gradScore != null ? getTemperature(gradScore) : null

  const demandChange = todayScore != null && gradScore != null
    ? -((gradScore - todayScore) / Math.max(todayScore, 0.01)) * 100
    : null

  return (
    <div style={wrapStyle}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 6 }}>Career Outlook</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
          Choosing a major?
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 520, margin: '8px auto 0' }}>
          See what the job market looks like when you graduate — before you commit four years and a tuition bill.
        </p>
      </div>

      {/* Input form */}
      <div style={formCardStyle}>
        <Field label="Career or major you're considering">
          <div style={{ position: 'relative' }}>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); setAnalyzed(false); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="e.g. nursing, computer science, paralegal, accounting"
              style={inputStyle}
            />
            {open && options.length > 0 && (
              <div style={dropdownStyle}>
                {options.map(o => (
                  <div
                    key={o.soc_code}
                    onMouseDown={() => {
                      setQuery(o.occupation_title)
                      setSelected(o)
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
        </Field>

        <div style={{ display: 'flex', gap: 14 }}>
          <Field label="When do you start?">
            <select
              value={startYear}
              onChange={e => setStartYear(Number(e.target.value))}
              style={selectStyle}
            >
              {START_YEARS.map(sy => (
                <option key={sy} value={Number(sy.split(' ')[1])}>{sy}</option>
              ))}
            </select>
          </Field>
          <Field label="Degree length">
            <select
              value={degreeLen}
              onChange={e => setDegreeLen(Number(e.target.value))}
              style={selectStyle}
            >
              {DEGREE_LENGTHS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{
          fontSize: 13, color: 'var(--text-secondary)', marginTop: 4,
          fontFamily: 'var(--font-mono)', textAlign: 'center',
        }}>
          You would graduate in <strong style={{ color: 'var(--text-primary)' }}>{gradYear}</strong>
        </div>

        {selected && !analyzed && (
          <button
            onClick={() => setAnalyzed(true)}
            style={{ ...analyzeBtnStyle, marginTop: 16, width: '100%' }}
          >
            Analyze →
          </button>
        )}
      </div>

      {/* Results — only after clicking Analyze */}
      {selected && analyzed && temperature && gradScore != null && todayScore != null && (
        <div style={{ marginTop: 28 }}>
          {/* Temperature gauge */}
          <div style={resultCardStyle}>
            <div style={{ textAlign: 'center' }}>
              <TemperatureGauge score={gradScore} temperature={temperature} />
              <div style={{
                fontSize: 13, color: TEMP_META[temperature].color, marginTop: 12, fontWeight: 500,
              }}>
                {TEMP_META[temperature].label}
              </div>
            </div>
          </div>

          {/* Demand comparison */}
          <div style={{ ...resultCardStyle, display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', marginTop: 14 }}>
            <DemandBox
              label="New hire demand TODAY"
              score={todayScore}
              year={2025}
            />
            <div style={{ textAlign: 'center' }}>
              {demandChange != null && (
                <div className="data-value" style={{
                  fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500,
                  color: demandChange >= 0 ? 'var(--success)' : 'var(--danger)',
                }}>
                  {demandChange >= 0 ? '+' : ''}{demandChange.toFixed(0)}%
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                projected change
              </div>
            </div>
            <DemandBox
              label={`New hire demand in ${gradYear}`}
              score={gradScore}
              year={gradYear}
            />
          </div>

          {/* Honest outlook */}
          <div style={{ ...resultCardStyle, marginTop: 14 }}>
            <SectionLabel>The Honest Outlook</SectionLabel>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {getOutlook(selected.soc_code, selected.occupation_title, gradYear, temperature)}
            </p>
          </div>

          {/* Actions */}
          <div style={{ ...resultCardStyle, marginTop: 14 }}>
            <SectionLabel>Three things to do during your degree</SectionLabel>
            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
              {getActions(selected.soc_code).map((a, i) => <li key={i} style={{ marginBottom: 8 }}>{a}</li>)}
            </ol>
          </div>

          {/* Share */}
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <button
              onClick={async () => {
                const text = `I checked the job market for ${selected.occupation_title} in ${gradYear}. The outlook is ${temperature}. ${TEMP_META[temperature].label}. Check yours: https://yourjobrisk.com`
                try {
                  await navigator.clipboard.writeText(text)
                  setCopied(true); setTimeout(() => setCopied(false), 2000)
                } catch { /* ignore */ }
              }}
              style={shareBtnStyle}
            >
              {copied ? 'Copied!' : 'Share this outlook →'}
            </button>
          </div>
        </div>
      )}

      <div style={disclaimerStyle}>
        Projections are estimates based on occupational task composition and AI deployment
        trajectories. Not a guarantee of future employment outcomes.
      </div>
    </div>
  )
}

// ---------- Temperature gauge (D3 arc) ----------

function TemperatureGauge({ score, temperature }: { score: number; temperature: Temperature }) {
  const W = 200, H = 110
  const cx = W / 2, cy = H - 8
  const r = 80
  const startAngle = Math.PI
  const endAngle = 2 * Math.PI
  const needleAngle = startAngle + score * (endAngle - startAngle)

  const arcPath = (a1: number, a2: number) => {
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const largeArc = a2 - a1 > Math.PI ? 1 : 0
    return `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}`
  }

  const nX = cx + (r - 20) * Math.cos(needleAngle)
  const nY = cy + (r - 20) * Math.sin(needleAngle)

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Background arc */}
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="var(--bg-inset)" strokeWidth={16} strokeLinecap="round" />
      {/* Colored arc — green to red */}
      <defs>
        <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="35%" stopColor="#f59e0b" />
          <stop offset="65%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="url(#gauge-grad)" strokeWidth={12} strokeLinecap="round" />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nX} y2={nY} stroke={TEMP_META[temperature].color} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={TEMP_META[temperature].color} />
      {/* Labels */}
      <text x={20} y={H - 4} fontSize={10} fill="var(--text-muted)" textAnchor="start">HOT</text>
      <text x={W - 20} y={H - 4} fontSize={10} fill="var(--text-muted)" textAnchor="end">COLD</text>
      {/* Center value */}
      <text x={cx} y={cy - 20} fontSize={32} fontWeight={500} fill={TEMP_META[temperature].color}
        textAnchor="middle" fontFamily="var(--font-mono, 'DM Mono', ui-monospace, monospace)">
        {temperature}
      </text>
    </svg>
  )
}

function DemandBox({ label, score, year }: { label: string; score: number; year: number }) {
  const hiringIndex = Math.round((1 - score) * 100)
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div className="data-value" style={{
        fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500,
        color: getExposureColor((1 - score) * 100),
        lineHeight: 1,
      }}>
        {hiringIndex}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
        hiring index · {year}
      </div>
    </div>
  )
}

// ---------- Small pieces ----------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10,
    }}>
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

const wrapStyle: React.CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  padding: '20px 24px 40px',
  width: '100%',
  boxSizing: 'border-box',
  height: '100%',
  overflowY: 'auto',
}

const formCardStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '20px 24px',
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  backgroundImage: 'linear-gradient(45deg, transparent 50%, #d0d8e4 50%), linear-gradient(135deg, #d0d8e4 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
  backgroundSize: '5px 5px, 5px 5px',
  backgroundRepeat: 'no-repeat',
  cursor: 'pointer',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  marginTop: 4,
  maxHeight: 240, overflowY: 'auto',
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

const resultCardStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '20px 24px',
}

const shareBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const analyzeBtnStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

const disclaimerStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  marginTop: 28,
  textAlign: 'center',
  lineHeight: 1.5,
}
