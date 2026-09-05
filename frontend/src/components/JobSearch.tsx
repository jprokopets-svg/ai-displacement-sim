import { useEffect, useRef, useState } from 'react'
import { searchOccupations } from '../utils/api'
import { BUCKET_BLURBS, bucketColor, bucketLabel, formatExposure, occupationBucket } from '../utils/buckets'

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

interface Occupation {
  soc_code: string
  occupation_title: string
  ai_exposure: number
}

/** Typeahead over the O*NET occupation list, with the matched job's exposure. */
export default function JobSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Occupation[]>([])
  const [selected, setSelected] = useState<Occupation | null>(null)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  // Set when `query` was filled in by picking a suggestion, so that write
  // doesn't fire a fresh search and reopen the list over the result.
  const skipSearch = useRef(false)

  // Debounced search. `stale` guards against out-of-order responses.
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false
      return
    }
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let stale = false
    const timer = setTimeout(async () => {
      const alias = ALIASES[q.toLowerCase()]
      try {
        let data = await searchOccupations(alias || q)
        if (alias && data.occupations.length === 0) data = await searchOccupations(q)
        if (!stale) {
          setResults(data.occupations)
          setOpen(true)
        }
      } catch {
        if (!stale) setResults([])
      }
    }, 200)
    return () => { stale = true; clearTimeout(timer) }
  }, [query])

  // Close the suggestion list on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function choose(occ: Occupation) {
    skipSearch.current = true
    setSelected(occ)
    setQuery(occ.occupation_title)
    setResults([])
    setOpen(false)
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Check my job</h2>
      <div ref={boxRef} style={{ position: 'relative', maxWidth: 420 }}>
        <input
          type="text"
          placeholder="Start typing an occupation"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null) }}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          style={inputStyle}
        />
        {open && results.length > 0 && (
          <ul style={listStyle}>
            {results.map(occ => (
              <li key={occ.soc_code}>
                <button type="button" onClick={() => choose(occ)} style={optionStyle}>
                  <span>{occ.occupation_title}</span>
                  <span style={{ color: '#555' }}>{formatExposure(occ.ai_exposure)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && <Result occ={selected} />}
    </div>
  )
}

function Result({ occ }: { occ: Occupation }) {
  const bucket = occupationBucket(occ.ai_exposure)
  return (
    <div style={{ marginTop: 14, maxWidth: 420 }}>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{occ.occupation_title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{
          background: bucketColor(bucket), color: bucket >= 3 ? '#fff' : '#111',
          padding: '2px 8px', fontSize: 13, fontWeight: 600,
        }}>
          {bucketLabel(bucket)} exposure
        </span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{formatExposure(occ.ai_exposure)}</span>
      </div>
      <p style={{ fontSize: 13, color: '#333', marginTop: 8 }}>{BUCKET_BLURBS[bucket]}</p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #999',
  background: '#fff',
  color: '#111',
}

const listStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  left: 0,
  right: 0,
  maxHeight: 280,
  overflowY: 'auto',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  background: '#fff',
  border: '1px solid #999',
  borderTop: 'none',
}

const optionStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  width: '100%',
  textAlign: 'left',
  padding: '6px 10px',
  fontSize: 13,
  color: '#111',
  cursor: 'pointer',
}
