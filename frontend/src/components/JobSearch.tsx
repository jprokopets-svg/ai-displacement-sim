import { useState } from 'react'
import { searchOccupations } from '../utils/api'
import { getOccupationExposureColor, formatExposure } from '../utils/colors'

// Multi-term aliases: broad terms expand to comma-separated search across O*NET.
// Each alias lists semantically-related occupation words/phrases the backend
// should match against title words. Kept liberal so broad queries like
// "consultant" surface a dozen related business/finance occupations, not one.
const ALIASES: Record<string, string> = {
  doctor: 'physician,surgeon,surgical,psychiatrist,radiologist,anesthesiologist,dermatologist,cardiologist,neurologist,oncologist,orthopedic,pediatrician,obstetrician,gynecologist,urologist,ophthalmologist,internist,pathologist,podiatrist,chiropractor',
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
  attorney: 'attorney,counsel,lawyer,legal,paralegal,judicial',
  paralegal: 'paralegal,legal,attorney',
  judge: 'judge,magistrate,judicial,hearing officer,arbitrator,mediator',
  engineer: 'engineer,mechanical,electrical,civil,chemical,aerospace,industrial,structural,environmental,biomedical,nuclear,petroleum,materials,software engineer',
  teacher: 'teacher,professor,instructor,educator,tutor,principal,librarian,teaching assistant,lecturer',
  professor: 'professor,instructor,lecturer,postsecondary',
  trader: 'broker,trader,portfolio,investment,financial advisor,wealth manager,securities',
  programmer: 'software,programmer,developer,coder,web developer,applications,systems software',
  coder: 'software,programmer,developer,applications',
  developer: 'software,programmer,developer,applications,web',
  'software engineer': 'software,programmer,developer,applications,systems software',
  driver: 'driver,truck,chauffeur,taxi,bus driver,delivery,courier,uber,lyft',
  trucker: 'truck,driver,heavy tractor,delivery',
  cop: 'police,detective,sheriff,patrol,officer,correctional',
  police: 'police,detective,sheriff,patrol,correctional',
  firefighter: 'firefighter,fire,emergency',
  secretary: 'secretary,administrative assistant,receptionist,executive assistant,clerk',
  assistant: 'assistant,secretary,administrative,receptionist,clerk,aide',
  receptionist: 'receptionist,secretary,administrative,information clerk',
  janitor: 'janitor,custodian,cleaner,housekeeper,maid',
  plumber: 'plumber,pipefitter,steamfitter',
  electrician: 'electrician,wiring,electrical installer',
  hvac: 'heating,air conditioning,refrigeration,hvac,mechanic',
  chef: 'cook,chef,food preparation,baker',
  cook: 'cook,chef,food preparation,baker,short order',
  baker: 'baker,pastry,food preparation',
  waiter: 'waiter,waitress,server,food service,bartender,host',
  waitress: 'waiter,waitress,server,food service',
  bartender: 'bartender,beverage,server',
  banker: 'financial,banker,loan,teller,credit,branch manager',
  teller: 'teller,bank,cashier,clerk',
  realtor: 'real estate,appraiser,property,broker,leasing',
  nurse: 'nurse,nursing,registered nurse,nurse practitioner,lpn,cna,nursing assistant',
  caregiver: 'home health,personal care,nursing assistant,caregiver,aide,companion',
  accountant: 'accountant,auditor,bookkeep,tax preparer,financial analyst,controller',
  auditor: 'auditor,accountant,compliance,internal',
  bookkeeper: 'bookkeep,accounting clerk,auditing clerk',
  analyst: 'analyst,research analyst,data analyst,business analyst,financial analyst,operations,budget,credit,market research,intelligence',
  'data analyst': 'data,analyst,statistician,business intelligence,research',
  'data scientist': 'data scientist,statistician,mathematician,research,analyst',
  manager: 'manager,supervisor,director,executive,administrator,coordinator,chief',
  director: 'director,manager,executive,chief,administrator',
  supervisor: 'supervisor,manager,foreman,lead,coordinator',
  consultant: 'consultant,management analyst,advisory,business analyst,operations analyst,strategy,program analyst,policy analyst,management',
  'management consultant': 'management analyst,consultant,advisory,strategy,operations',
  executive: 'executive,chief,director,president,vice president,manager,officer',
  entrepreneur: 'executive,chief,owner,founder,business operations',
  pharmacist: 'pharmacist,pharmacy,dispensing',
  dentist: 'dentist,dental,orthodontist,prosthodontist,hygienist',
  pilot: 'pilot,airline,aircraft,aviation,flight',
  architect: 'architect,architectural,landscape architect',
  therapist: 'therapist,therapy,counselor,psychologist,social worker,clinical',
  counselor: 'counselor,therapist,social worker,psychologist,mental health',
  psychologist: 'psychologist,clinical,counseling,psychiatrist,psychotherapist',
  'social worker': 'social work,counselor,case manager,community,clinical',
  writer: 'writer,author,editor,journalist,reporter,copywriter,technical writer',
  journalist: 'journalist,reporter,news analyst,editor,correspondent',
  editor: 'editor,writer,proofreader,copy editor',
  designer: 'designer,graphic,ux,ui,interior design,fashion,industrial designer',
  'graphic designer': 'graphic,designer,visual,multimedia,art director',
  artist: 'artist,fine arts,illustrator,sculptor,painter,craft',
  photographer: 'photographer,camera,cinematographer',
  musician: 'musician,singer,composer,music director,audio',
  actor: 'actor,performer,dancer,choreographer,entertainer',
  scientist: 'scientist,researcher,biologist,chemist,physicist,geologist,microbiologist,zoologist',
  biologist: 'biologist,microbiologist,zoologist,biochemist,life scientist',
  chemist: 'chemist,biochemist,material scientist,chemical',
  physicist: 'physicist,astronomer,atmospheric',
  statistician: 'statistician,mathematician,actuary,data analyst',
  farmer: 'farmer,agricultural,farm,crop,livestock,rancher',
  construction: 'construction,carpenter,mason,roofer,installer,laborer,concrete',
  carpenter: 'carpenter,construction,finish,rough',
  mechanic: 'mechanic,repair,service technician,maintenance,installer',
  welder: 'welder,cutter,solderer,brazer',
  machinist: 'machinist,tool,die maker,cnc',
  warehouse: 'warehouse,packer,stock,freight,laborer,material handler,logistics',
  retail: 'retail,cashier,sales,counter clerk',
  cashier: 'cashier,counter clerk,teller,retail,customer service',
  salesperson: 'sales,retail,wholesale,sales representative,sales associate',
  marketing: 'marketing,advertising,promotions,public relations,brand',
  hr: 'human resources,recruiter,training,labor relations,compensation',
  recruiter: 'recruiter,human resources,talent acquisition',
  trucker_logistics: 'truck,driver,dispatcher,logistics,freight,shipping',
  translator: 'translator,interpreter,language',
  scheduler: 'scheduler,dispatcher,planner,coordinator',
}

// Replacement mechanism: what LLM/AI tools are most likely to affect each occupation group.
// Eloundou-based exposure only measures cognitive/LLM displacement.
const REPLACEMENT_MAP: Record<string, string> = {
  '11': 'AI strategic planning tools, automated KPI dashboards, AI-driven decision support',
  '13': 'Financial AI agents (Bloomberg GPT, Kensho), automated audit and tax platforms',
  '15': 'AI code assistants (Copilot, Cursor, Devin), automated testing and deployment',
  '17': 'CAD/BIM AI (Autodesk AI, nTopology), generative design optimization',
  '19': 'AI lab assistants, automated hypothesis generation and literature review',
  '21': 'AI counseling chatbots, automated case management, benefits processing AI',
  '23': 'Legal AI agents (Harvey, CoCounsel), document review automation',
  '25': 'AI tutoring (Khanmigo, adaptive curriculum), automated grading',
  '27': 'Generative AI (DALL-E, Sora, Suno), automated content production',
  '29': 'Diagnostic AI (PathAI, Viz.ai), clinical decision support',
  '31': 'Limited current AI exposure; most tasks involve physical patient care and interpersonal support',
  '33': 'Limited current AI exposure; most tasks require physical presence and public trust mandates',
  '35': 'Limited current AI exposure; most tasks involve physical food preparation and in-person service',
  '37': 'Limited current AI exposure; most tasks involve physical cleaning and facility maintenance',
  '39': 'Limited current AI exposure; most tasks require personal presence and human interaction',
  '41': 'AI sales agents (Regie.ai, Outreach), recommendation engines',
  '43': 'RPA (UiPath, Automation Anywhere), AI document processing, chatbot customer service',
  '45': 'Limited current AI exposure; most tasks involve physical outdoor labor',
  '47': 'Limited current AI exposure; most tasks involve physical on-site construction work',
  '49': 'Predictive maintenance AI, AR-guided repair diagnostics',
  '51': 'Limited current AI exposure; most tasks involve physical production-line work',
  '53': 'Limited current AI exposure; most tasks involve physical vehicle operation and material handling',
}

// Displacement risk factors — computed from SOC group characteristics.
function getRiskFactors(soc: string, exposure: number) {
  const group = soc.substring(0, 2)
  const isKnowledge = ['13', '15', '17', '19', '23', '25', '27'].includes(group)
  const isOffice = ['43', '13', '15', '23'].includes(group)
  const isPhysical = ['35', '37', '45', '47', '49', '51', '53'].includes(group)
  const isHealthcare = ['29', '31'].includes(group)

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

  const easeOfReplacement = isOffice ? 0.8 : isKnowledge ? 0.6 : isPhysical ? 0.5 : isHealthcare ? 0.3 : 0.5
  const laborCostPressure = isPhysical ? 0.7 : isOffice ? 0.65 : isKnowledge ? 0.5 : 0.4
  const wageDropProb = exposure > 0.6 ? 0.8 : exposure > 0.4 ? 0.6 : 0.3
  const closureRisk = isKnowledge ? exposure * 0.5 : isOffice ? exposure * 0.6 : exposure * 0.3

  return { friction, automationPressure, easeOfReplacement, laborCostPressure, wageDropProb, closureRisk }
}

function getTimelineScores(exposure: number, soc: string) {
  const factors = getRiskFactors(soc, exposure)
  const isHighExposure = exposure > 0.5
  const accelerator = 1.0 + (factors.automationPressure - 0.5) * 0.3 + (factors.easeOfReplacement - 0.5) * 0.2
  const boost = isHighExposure ? 0.05 : 0.03
  return [
    { year: 2025, score: exposure },
    { year: 2028, score: Math.min(1, exposure * (1 + boost * accelerator)) },
    { year: 2032, score: Math.min(1, exposure * (1 + boost * 2 * accelerator)) },
    { year: 2035, score: Math.min(1, exposure * (1 + boost * 3 * accelerator)) },
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
        Enter your occupation to see its AI displacement risk based on Eloundou LLM exposure,
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
        Search returns all matching O*NET occupations. Scores reflect Eloundou LLM exposure.
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
  const factors = getRiskFactors(soc, exposure)
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI Exposure</div>
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
        <FactorBar label="Automation companies in field" value={factors.automationPressure}
          hint="How many AI companies target this occupation" />
        <FactorBar label="Ease of replacement" value={factors.easeOfReplacement}
          hint="Can tasks be fully automated or only partially" />
        <FactorBar label="Economic pressure to automate" value={factors.laborCostPressure}
          hint="Labor cost as % of revenue driving automation ROI" />
        <FactorBar label="Wage drop probability" value={factors.wageDropProb}
          hint="Likelihood of wage compression before full displacement" />
        <FactorBar label="Business closure risk" value={factors.closureRisk}
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
            height: '100%', width: `${factors.friction * 100}%`,
            background: factors.friction > 0.5 ? '#22c55e' : factors.friction > 0.25 ? '#eab308' : '#ef4444',
            borderRadius: 4,
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {factors.friction > 0.5 ? 'High -- licensing, unions, regulation slow automation'
            : factors.friction > 0.25 ? 'Moderate -- some regulatory barriers'
            : 'Low -- minimal barriers to automation'}
        </div>
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 16 }}>
        Source: O*NET 29.1, Eloundou et al. 2023 (LLM exposure).
        Displacement risk factors are model estimates, not precise predictions.
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
