import { useState } from 'react'
import { searchOccupations } from '../utils/api'
import { getOccupationExposureColor, formatExposure } from '../utils/colors'

// Multi-term aliases: broad terms expand to comma-separated search across O*NET
const ALIASES: Record<string, string> = {
  doctor: 'physician,surgeon,surgical,psychiatrist,radiologist,anesthesiologist,dermatologist,cardiologist,neurologist,oncologist,orthopedic,pediatrician,obstetrician,gynecologist,urologist,ophthalmologist,internist,pathologist',
  surgeon: 'surgeon,surgical,orthopedic surgeon,cardiovascular,neurosurgeon',
  psychiatrist: 'psychiatrist,psychiatric',
  radiologist: 'radiologist,radiology',
  anesthesiologist: 'anesthesiologist',
  dermatologist: 'dermatologist',
  cardiologist: 'cardiologist,cardiovascular',
  neurologist: 'neurologist,neurology',
  oncologist: 'oncologist,oncology',
  orthopedic: 'orthopedic,orthopedist',
  pediatrician: 'pediatrician,pediatric',
  lawyer: 'attorney,counsel,lawyer,judge,magistrate,legal,paralegal,judicial',
  judge: 'judge,magistrate,judicial,hearing officer',
  engineer: 'engineer,mechanical engineer,electrical engineer,civil engineer,chemical engineer,aerospace engineer,industrial engineer,structural engineer,environmental engineer,biomedical engineer,nuclear engineer,petroleum engineer,materials engineer',
  teacher: 'teacher,professor,instructor,educator,tutor,principal,librarian,teaching assistant',
  trader: 'broker,trader,portfolio,investment,financial advisor,wealth manager',
  programmer: 'software,programmer,developer,coder,web developer',
  coder: 'software,programmer,developer',
  driver: 'driver,truck,chauffeur,taxi,bus driver',
  cop: 'police,detective,sheriff,patrol',
  firefighter: 'firefighter,fire',
  secretary: 'secretary,administrative assistant',
  janitor: 'janitor,custodian,cleaner',
  plumber: 'plumber,pipefitter',
  electrician: 'electrician',
  chef: 'cook,chef,food preparation',
  waiter: 'waiter,waitress,server,food service',
  waitress: 'waiter,waitress,server',
  banker: 'financial,banker,loan officer,teller',
  realtor: 'real estate,appraiser,property',
  nurse: 'nurse,nursing,registered nurse,nurse practitioner',
  accountant: 'accountant,auditor,bookkeep,tax preparer',
  analyst: 'analyst,research analyst,data analyst,business analyst',
  manager: 'manager,supervisor,director,executive',
  consultant: 'consultant,management analyst,advisory',
  pharmacist: 'pharmacist,pharmacy',
  dentist: 'dentist,dental,orthodontist',
  pilot: 'pilot,airline,aircraft,aviation',
  architect: 'architect,architectural',
  therapist: 'therapist,therapy,counselor,psychologist',
  writer: 'writer,author,editor,journalist,reporter',
  designer: 'designer,graphic,UX,UI,interior design',
  scientist: 'scientist,researcher,biologist,chemist,physicist',
}

// Replacement mechanism: what AI/automation is most likely to replace each occupation group
const REPLACEMENT_MAP: Record<string, string> = {
  '13': 'Financial AI agents (Bloomberg GPT, Kensho), automated audit & tax platforms',
  '15': 'AI code assistants (Copilot, Cursor, Devin), automated testing & deployment',
  '17': 'CAD/BIM AI (Autodesk AI, nTopology), generative design optimization',
  '19': 'AI lab assistants (Emerald Cloud Lab), automated hypothesis generation',
  '23': 'Legal AI agents (Harvey, CoCounsel), document review automation',
  '25': 'AI tutoring (Khan Academy, Khanmigo), automated grading & curriculum',
  '27': 'Generative AI (DALL-E, Sora, Suno), automated content production',
  '29': 'Diagnostic AI (PathAI, Viz.ai), robotic surgery (da Vinci), clinical decision support',
  '31': 'Companion robots, remote patient monitoring, automated care scheduling',
  '33': 'Surveillance AI, predictive policing, autonomous patrol drones',
  '35': 'Kitchen robotics (Miso, Flippy), automated ordering & inventory',
  '37': 'Autonomous cleaning robots (Brain Corp), facility management AI',
  '39': 'Service robots (SoftBank Pepper), AI personal assistants',
  '41': 'AI sales agents (Regie.ai, Outreach), recommendation engines',
  '43': 'RPA (UiPath, Automation Anywhere), AI document processing, chatbot customer service',
  '45': 'Agricultural robotics (John Deere See & Spray), autonomous harvesters',
  '47': 'Construction robotics (Built Robotics), prefab automation, drone surveys',
  '49': 'Predictive maintenance AI, diagnostic robots, AR-guided repair',
  '51': 'Industrial robotics (Fanuc, ABB), lights-out manufacturing, cobot assembly',
  '53': 'Autonomous vehicles (Waymo, Aurora), drone delivery, warehouse AGVs',
  '11': 'AI strategic planning tools, automated KPI dashboards, AI-driven decision support',
  '21': 'AI counseling chatbots, automated case management, benefits processing AI',
}

// Enhanced track breakdown with more lifespan model variables
function getTrackBreakdown(soc: string, exposure: number) {
  const group = soc.substring(0, 2)
  const isPhysical = ['35', '37', '45', '47', '49', '51', '53'].includes(group)
  const isKnowledge = ['13', '15', '17', '19', '23', '25', '27'].includes(group)
  const isOffice = ['43', '13', '15', '23'].includes(group)
  const isHealthcare = ['29', '31'].includes(group)

  const cognitive = isKnowledge ? exposure * 1.1 : exposure * 0.7
  const robotics = isPhysical ? 0.30 + exposure * 0.4 : 0.02 + exposure * 0.1
  const agentic = isKnowledge ? exposure * 0.9 : isOffice ? exposure * 0.7 : exposure * 0.3
  const offshoring = isOffice ? exposure * 0.8 : isPhysical ? 0.02 : exposure * 0.4

  // Regulatory friction by group
  const frictionMap: Record<string, number> = {
    '29': 0.75, '23': 0.70, '33': 0.65, '25': 0.55, '31': 0.35,
    '47': 0.30, '53': 0.35, '51': 0.30,
  }
  const friction = frictionMap[group] || 0.15

  // Active automation companies (how many companies are building solutions for this field)
  const automationCompaniesMap: Record<string, number> = {
    '15': 0.9, '43': 0.85, '53': 0.8, '51': 0.85, '41': 0.7,
    '13': 0.75, '23': 0.65, '27': 0.8, '29': 0.6, '25': 0.55,
    '35': 0.6, '47': 0.5, '45': 0.5, '33': 0.4, '37': 0.45,
  }
  const automationPressure = automationCompaniesMap[group] || 0.3

  // Ease of replacement (can tasks be fully automated or only partially?)
  const easeOfReplacement = isOffice ? 0.8 : isKnowledge ? 0.6 : isPhysical ? 0.5 : isHealthcare ? 0.3 : 0.5

  // Economic pressure to automate (labor cost as % of revenue)
  const laborCostPressure = isPhysical ? 0.7 : isOffice ? 0.65 : isKnowledge ? 0.5 : 0.4

  // Wage drop probability before full displacement
  const wageDropProb = exposure > 0.6 ? 0.8 : exposure > 0.4 ? 0.6 : 0.3

  // Business closure risk from competitive pressure
  const closureRisk = isKnowledge ? exposure * 0.5 : isOffice ? exposure * 0.6 : exposure * 0.3

  return {
    cognitive: Math.min(1, Math.max(0, cognitive)),
    robotics: Math.min(1, Math.max(0, robotics)),
    agentic: Math.min(1, Math.max(0, agentic)),
    offshoring: Math.min(1, Math.max(0, offshoring)),
    friction,
    automationPressure,
    easeOfReplacement,
    laborCostPressure,
    wageDropProb,
    closureRisk,
  }
}

function getTimelineScores(exposure: number, soc: string) {
  const tracks = getTrackBreakdown(soc, exposure)
  const isPhysical = tracks.robotics > 0.3
  // Enhanced: factor in automation pressure and ease of replacement
  const accelerator = 1.0 + (tracks.automationPressure - 0.5) * 0.3 + (tracks.easeOfReplacement - 0.5) * 0.2
  return [
    { year: 2025, score: exposure },
    { year: 2028, score: Math.min(1, exposure * (1 + (isPhysical ? 0.08 : 0.05) * accelerator + (tracks.agentic > 0.5 ? 0.10 : 0))) },
    { year: 2032, score: Math.min(1, exposure * (1 + (isPhysical ? 0.15 : 0.10) * accelerator + (tracks.agentic > 0.5 ? 0.20 : 0.05))) },
    { year: 2035, score: Math.min(1, exposure * (1 + (isPhysical ? 0.20 : 0.15) * accelerator + (tracks.agentic > 0.5 ? 0.25 : 0.10))) },
  ]
}

export default function JobSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)

  const handleSearch = async () => {
    if (query.length < 2) return
    setLoading(true)
    setSelected(null)

    const aliasMatch = ALIASES[query.toLowerCase().trim()]
    const searchTerm = aliasMatch || query

    try {
      let data = await searchOccupations(searchTerm)
      // If alias didn't help, try the raw query
      if (data.occupations.length === 0 && aliasMatch) {
        data = await searchOccupations(query)
      }
      setResults(data.occupations)
      if (data.occupations.length === 1) {
        setSelected(data.occupations[0])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check Your Job</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        Enter your occupation to see its AI displacement risk with full track breakdown,
        time-aware projections, and replacement mechanism analysis.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="e.g. doctor, lawyer, truck driver, accountant, programmer"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 6,
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', fontSize: 14,
          }}
        />
        <button onClick={handleSearch} disabled={loading} style={{
          padding: '8px 16px', borderRadius: 6,
          background: 'var(--accent)', color: '#fff',
          border: 'none', fontSize: 14, cursor: 'pointer',
        }}>
          {loading ? '...' : 'Search'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        Search returns all matching O*NET occupations. Scores include composite displacement with all four tracks.
      </div>

      {/* Results list */}
      {results.length > 0 && !selected && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            {results.length} occupation{results.length !== 1 ? 's' : ''} found -- click for details
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {results.map((occ, i) => {
            const soc = occ.soc_code as string
            const group = soc.substring(0, 2)
            const replacement = REPLACEMENT_MAP[group]
            return (
              <div key={i} onClick={() => setSelected(occ)} style={{
                padding: '8px 12px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{occ.occupation_title as string}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SOC: {soc}</div>
                  </div>
                  <div style={{
                    fontSize: 18, fontWeight: 700,
                    color: getOccupationExposureColor(occ.ai_exposure as number),
                  }}>
                    {formatExposure(occ.ai_exposure as number)}
                  </div>
                </div>
                {replacement && (
                  <div style={{
                    fontSize: 11, color: 'var(--warning)', marginTop: 4,
                    padding: '3px 6px', background: 'rgba(255,168,74,0.08)', borderRadius: 3,
                  }}>
                    Most exposed to: {replacement}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* Detailed breakdown for selected occupation */}
      {selected && (
        <OccupationDetail
          occ={selected}
          onBack={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function OccupationDetail({ occ, onBack }: { occ: Record<string, unknown>; onBack: () => void }) {
  const exposure = occ.ai_exposure as number
  const soc = occ.soc_code as string
  const title = occ.occupation_title as string
  const group = soc.substring(0, 2)
  const tracks = getTrackBreakdown(soc, exposure)
  const timeline = getTimelineScores(exposure, soc)
  const replacement = REPLACEMENT_MAP[group]

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={onBack} style={{
        background: 'none', border: '1px solid var(--border)',
        color: 'var(--text-secondary)', borderRadius: 4,
        padding: '4px 10px', cursor: 'pointer', fontSize: 12, marginBottom: 12,
      }}>
        Back to results
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>SOC: {soc}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 32, fontWeight: 800,
            color: getOccupationExposureColor(exposure),
          }}>
            {formatExposure(exposure)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Composite Displacement</div>
        </div>
      </div>

      {/* Replacement mechanism */}
      {replacement && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'rgba(255,168,74,0.08)', border: '1px solid rgba(255,168,74,0.2)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>
            Primary Displacement Mechanism
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            {replacement}
          </div>
        </div>
      )}

      {/* Track breakdown bars */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Track Breakdown
        </div>
        <TrackBar label="Cognitive AI" value={tracks.cognitive} color="#4a9eff" />
        <TrackBar label="Industrial Robotics" value={tracks.robotics} color="#f97316" />
        <TrackBar label="Agentic AI (2026+)" value={tracks.agentic} color="#b44aff" />
        <TrackBar label="Offshoring Risk" value={tracks.offshoring} color="#4ade80" />
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Score Over Time
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {timeline.map(t => (
            <div key={t.year} style={{
              flex: 1, textAlign: 'center', padding: '6px 4px',
              background: 'var(--bg-secondary)', borderRadius: 4,
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.year}</div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: getOccupationExposureColor(t.score),
              }}>
                {(t.score * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lifespan model factors */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Displacement Risk Factors
        </div>
        <FactorBar label="Automation companies in field" value={tracks.automationPressure}
          hint="How many AI companies target this occupation" />
        <FactorBar label="Ease of replacement" value={tracks.easeOfReplacement}
          hint="Can tasks be fully automated or only partially" />
        <FactorBar label="Economic pressure to automate" value={tracks.laborCostPressure}
          hint="Labor cost as % of revenue driving automation ROI" />
        <FactorBar label="Wage drop probability" value={tracks.wageDropProb}
          hint="Likelihood of wage compression before full displacement" />
        <FactorBar label="Business closure risk" value={tracks.closureRisk}
          hint="Risk of employer closure from competitive pressure" />
      </div>

      {/* Regulatory friction */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Regulatory Friction
        </div>
        <div style={{
          height: 8, background: '#1a1a25', borderRadius: 4, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${tracks.friction * 100}%`,
            background: tracks.friction > 0.5 ? '#22c55e' : tracks.friction > 0.25 ? '#eab308' : '#ef4444',
            borderRadius: 4,
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {tracks.friction > 0.5 ? 'High -- licensing, unions, regulation slow automation'
            : tracks.friction > 0.25 ? 'Moderate -- some regulatory barriers'
            : 'Low -- minimal barriers to automation'}
        </div>
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 16 }}>
        Source: O*NET 29.1, Felten-Raj-Rock 2021, Frey-Osborne 2017.
        Track breakdown is directional -- derived from occupation group characteristics.
        Displacement risk factors are model estimates, not precise predictions.
      </div>
    </div>
  )
}

function TrackBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: '#1a1a25', borderRadius: 3, marginTop: 2 }}>
        <div style={{
          height: '100%', width: `${value * 100}%`,
          background: color, borderRadius: 3,
        }} />
      </div>
    </div>
  )
}

function FactorBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  const color = value > 0.7 ? '#ef4444' : value > 0.4 ? '#eab308' : '#22c55e'
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 4, background: '#1a1a25', borderRadius: 2, marginTop: 1 }}>
        <div style={{ height: '100%', width: `${value * 100}%`, background: color, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{hint}</div>
    </div>
  )
}
