/**
 * Personal displacement risk scoring.
 *
 * Pure function: takes form answers + matched occupation + county context,
 * returns a risk profile (probability, timeline, resilience, contributing
 * factors, action items, replacement mechanism).
 *
 * Base probability starts from the matched occupation's ai_exposure score
 * and is adjusted multiplicatively by each answered modifier. Resilience
 * is computed separately as the sum of protective factors.
 */

export type Industry =
  | 'Technology' | 'Finance' | 'Healthcare' | 'Legal' | 'Education'
  | 'Manufacturing' | 'Retail' | 'Government' | 'Media' | 'Transportation'
  | 'Other'

export type CompanySize = 'Under 50' | '50-500' | '500-5000' | 'Over 5000' | 'Public company'
export type Seniority = 'Entry level' | 'Mid level' | 'Senior' | 'Manager' | 'Director' | 'Executive'
export type YesNoSome = 'Yes' | 'No' | 'Some'
export type AiUsage = 'Yes' | 'No' | 'Learning'
export type TechLiteracy = 'Non-technical' | 'Some technical skills' | 'Technical' | 'Highly technical'
export type SkillsType =
  | 'Relational/interpersonal' | 'Creative/judgment-based' | 'Analytical/data'
  | 'Routine/process-based' | 'Physical/manual'
export type SalaryBand = 'Above median' | 'At median' | 'Below median'

export interface FormAnswers {
  // Screen 1
  jobTitle: string
  socCode: string | null        // resolved from autocomplete
  baseExposure: number | null   // 0-1, from matched occupation
  industry: Industry | ''
  specificFunction: string
  // Screen 2
  companyName: string
  companySize: CompanySize | ''
  sector: Industry | ''
  companyInFeed: boolean        // auto-computed
  // Screen 3
  yearsInRole: number           // 0-30
  seniority: Seniority | ''
  tacitKnowledge: YesNoSome | ''
  clientFacing: 'Yes' | 'No' | ''
  // Screen 4
  aiUsage: AiUsage | ''
  techLiteracy: TechLiteracy | ''
  professionalLicense: 'Yes' | 'No' | ''
  skillsType: SkillsType | ''
  // Screen 5
  countyFips: string | null
  countyName: string
  countyPercentile: number | null
  salaryBand: SalaryBand | ''
}

export interface RiskProfile {
  probability: number           // 0-100, displacement probability within 10y
  timelineYear: number          // calendar year significant pressure begins
  timelineLabel: string         // e.g. "2027–2030"
  resilience: number            // 0-100, higher = more protected
  positiveFactors: string[]     // protective
  negativeFactors: string[]     // risk-amplifying
  actionItems: string[]         // 3 tailored suggestions
  replacementMechanism: string  // 1–2 sentence description
  countyContextLabel: string    // "Your role ranks in the Xth percentile …"
}

export const DEFAULT_ANSWERS: FormAnswers = {
  jobTitle: '', socCode: null, baseExposure: null, industry: '', specificFunction: '',
  companyName: '', companySize: '', sector: '', companyInFeed: false,
  yearsInRole: 3, seniority: '', tacitKnowledge: '', clientFacing: '',
  aiUsage: '', techLiteracy: '', professionalLicense: '', skillsType: '',
  countyFips: null, countyName: '', countyPercentile: null, salaryBand: '',
}

// SOC major-group → replacement mechanism description.
const REPLACEMENT_MAP: Record<string, string> = {
  '11': 'AI strategic-planning tools and automated KPI dashboards are taking over routine management decisions; roles that survive shift toward cross-functional coordination.',
  '13': 'Financial AI agents like Bloomberg GPT and Kensho, plus automated audit and tax platforms, are already handling the analytical work.',
  '15': 'AI code assistants (Copilot, Cursor, Devin) and agentic engineering tools are compressing feature delivery into a fraction of prior headcount.',
  '17': 'Generative design and CAD/BIM AI (Autodesk AI, nTopology) are automating iteration-heavy engineering work.',
  '19': 'AI lab assistants and automated hypothesis-generation platforms are taking over data collection and literature review.',
  '21': 'AI counseling chatbots and automated case management are reducing the scope of routine casework.',
  '23': 'Legal AI agents (Harvey, CoCounsel) handle document review, discovery, and first-draft contracts at a fraction of associate hours.',
  '25': 'AI tutoring platforms (Khanmigo, adaptive curriculum) and automated grading are restructuring classroom economics.',
  '27': 'Generative AI (DALL-E, Sora, Suno) is producing content at volume that a human artist cannot match on throughput.',
  '29': 'Diagnostic AI (PathAI, Viz.ai) and clinical decision support are augmenting (and displacing) clinical decision-making.',
  '31': 'Companion robots, remote patient monitoring, and automated care scheduling are absorbing the routine portions of healthcare support.',
  '33': 'Surveillance AI, predictive policing, and autonomous patrol drones are reshaping protective services.',
  '35': 'Kitchen robotics (Miso, Flippy) and automated ordering absorb routine food-prep and front-of-house functions.',
  '37': 'Autonomous cleaning robots and facility-management AI are replacing standardized cleaning routes.',
  '39': 'Service robots and AI personal assistants absorb routine concierge and attendant work.',
  '41': 'AI sales agents (Regie.ai, Outreach) and recommendation engines automate prospecting and first-touch selling.',
  '43': 'RPA (UiPath, Automation Anywhere), AI document processing, and chatbots dissolve traditional office-support roles quickly.',
  '45': 'Agricultural robotics (John Deere See & Spray) and autonomous harvesters are replacing field labor.',
  '47': 'Construction robotics (Built Robotics), prefabrication automation, and drone surveys compress site labor.',
  '49': 'Predictive-maintenance AI, diagnostic robots, and AR-guided repair tools are squeezing field-service roles.',
  '51': 'Industrial robotics (Fanuc, ABB), lights-out manufacturing, and cobot assembly replace production-line labor.',
  '53': 'Autonomous vehicles (Waymo, Aurora), drone delivery, and warehouse AGVs reshape transportation and logistics.',
}

function getReplacementMechanism(socCode: string | null): string {
  if (!socCode) {
    return 'AI and automation pressure in this role will depend on how much of the work is routine, documentable, and performed without direct client presence.'
  }
  const group = socCode.substring(0, 2)
  return REPLACEMENT_MAP[group]
    ?? 'AI and automation pressure will depend on how much of the work is routine, documentable, and performed without direct client presence.'
}

export function computeRisk(a: FormAnswers): RiskProfile {
  // Base exposure: if no occupation matched, fall back to a mild prior.
  const base = a.baseExposure != null ? a.baseExposure : 0.45

  let probability = base * 100  // start at 0-100 scale
  const pos: string[] = []
  const neg: string[] = []

  // Company size
  if (a.companySize === 'Over 5000' || a.companySize === 'Public company') {
    probability *= 1.10
    neg.push('Large/public employer — aggressive automation investment')
  } else if (a.companySize === 'Under 50') {
    probability *= 0.90
    pos.push('Small employer — less aggressive automation pressure')
  }

  // Company in displacement feed
  if (a.companyInFeed) {
    probability *= 1.15
    neg.push('Employer has documented AI-driven workforce activity')
  }

  // Seniority
  if (a.seniority === 'Entry level') {
    probability *= 1.15
    neg.push('Entry-level role — most exposed to junior-task automation')
  } else if (a.seniority === 'Senior' || a.seniority === 'Executive') {
    probability *= 0.90
    pos.push('Senior/executive role — judgment and authority hard to automate')
  }

  // Years in role
  if (a.yearsInRole < 2) {
    probability *= 1.10
    neg.push('Short tenure — less accumulated firm-specific knowledge')
  } else if (a.yearsInRole > 10) {
    probability *= 0.85
    pos.push('Long tenure — deep firm-specific tacit knowledge')
  }

  // Tacit knowledge
  if (a.tacitKnowledge === 'Yes') {
    probability *= 0.85
    pos.push('Significant tacit/undocumented knowledge')
  } else if (a.tacitKnowledge === 'No') {
    probability *= 1.10
    neg.push('Most of the work is documentable — easier to train AI on')
  }

  // Client-facing
  if (a.clientFacing === 'Yes') {
    probability *= 0.90
    pos.push('Direct client/customer relationships')
  }

  // AI tool usage
  if (a.aiUsage === 'Yes') {
    probability *= 0.80
    pos.push('Already uses AI tools daily — moves up the value stack')
  } else if (a.aiUsage === 'Learning') {
    probability *= 0.90
    pos.push('Actively learning AI tools')
  } else if (a.aiUsage === 'No') {
    probability *= 1.05
    neg.push('Not yet adopting AI tools — falling behind peers')
  }

  // Technical literacy
  if (a.techLiteracy === 'Highly technical') {
    probability *= 0.85
    pos.push('High technical literacy — can adapt as tooling shifts')
  } else if (a.techLiteracy === 'Non-technical') {
    probability *= 1.10
    neg.push('Non-technical — slower to adopt new tooling')
  }

  // Professional license
  if (a.professionalLicense === 'Yes') {
    probability *= 0.80
    pos.push('Legally-required professional license — strong regulatory moat')
  }

  // Skills type
  if (a.skillsType === 'Routine/process-based') {
    probability *= 1.20
    neg.push('Routine/process-heavy work — highest automation target')
  } else if (a.skillsType === 'Relational/interpersonal') {
    probability *= 0.85
    pos.push('Relational work — durable advantage over AI')
  } else if (a.skillsType === 'Creative/judgment-based') {
    probability *= 0.90
    pos.push('Creative/judgment-based work — harder to fully automate')
  }

  // Salary band
  if (a.salaryBand === 'Above median') {
    probability *= 0.95
    pos.push('Above-median salary — harder to cost-justify immediate replacement')
  } else if (a.salaryBand === 'Below median') {
    probability *= 1.10
    neg.push('Below-median salary — cost pressure to automate')
  }

  probability = Math.max(5, Math.min(95, probability))

  // Timeline — pressure starts sooner for higher probability.
  const now = new Date().getFullYear()
  let timelineYear: number
  if (probability >= 75) timelineYear = now + 1
  else if (probability >= 60) timelineYear = now + 2
  else if (probability >= 45) timelineYear = now + 4
  else if (probability >= 30) timelineYear = now + 6
  else timelineYear = now + 9

  const timelineLabel = `${timelineYear}–${Math.min(2040, timelineYear + 3)}`

  // Resilience — reward protective answers.
  let resilience = 30  // baseline
  if (a.tacitKnowledge === 'Yes') resilience += 12
  else if (a.tacitKnowledge === 'Some') resilience += 5
  if (a.clientFacing === 'Yes') resilience += 10
  if (a.aiUsage === 'Yes') resilience += 14
  else if (a.aiUsage === 'Learning') resilience += 7
  if (a.professionalLicense === 'Yes') resilience += 15
  if (a.techLiteracy === 'Highly technical') resilience += 10
  else if (a.techLiteracy === 'Technical') resilience += 5
  if (a.skillsType === 'Relational/interpersonal') resilience += 10
  else if (a.skillsType === 'Creative/judgment-based') resilience += 8
  if (a.yearsInRole > 10) resilience += 6
  if (a.seniority === 'Senior' || a.seniority === 'Executive') resilience += 6
  resilience = Math.max(0, Math.min(100, resilience))

  // Tailored action items — pick the three most impactful given answers.
  const actions: string[] = []
  if (a.aiUsage !== 'Yes') {
    actions.push('Integrate AI tools into your daily workflow — the fastest single move to lower displacement risk.')
  }
  if (a.skillsType === 'Routine/process-based') {
    actions.push('Shift the balance of your work toward judgment, client relationships, or creative outputs — the portions AI cannot replicate.')
  }
  if (a.techLiteracy === 'Non-technical' || a.techLiteracy === 'Some technical skills') {
    actions.push('Build technical fluency with the specific AI tools in your field — not general AI, but what your industry is adopting.')
  }
  if (a.clientFacing === 'No' && actions.length < 3) {
    actions.push('Develop direct customer/client exposure — relationships and trust are durable advantages.')
  }
  if (a.tacitKnowledge !== 'Yes' && actions.length < 3) {
    actions.push('Move toward work where context and judgment matter more than documentable procedure.')
  }
  if (a.professionalLicense !== 'Yes' && actions.length < 3 && (a.industry === 'Healthcare' || a.industry === 'Legal' || a.industry === 'Finance')) {
    actions.push('Pursue a professional credential with legal weight in your field — regulated roles have the strongest moat.')
  }
  while (actions.length < 3) {
    actions.push('Deepen domain expertise in a niche where AI training data is thin — specialization compounds.')
  }

  const countyContextLabel = a.countyName && a.countyPercentile != null
    ? `Your role ranks in the ${Math.round(a.countyPercentile)}th percentile of AI exposure for ${a.countyName}.`
    : 'Add your county on the last screen to see local context.'

  return {
    probability: Math.round(probability),
    timelineYear,
    timelineLabel,
    resilience: Math.round(resilience),
    positiveFactors: pos,
    negativeFactors: neg,
    actionItems: actions.slice(0, 3),
    replacementMechanism: getReplacementMechanism(a.socCode),
    countyContextLabel,
  }
}

export function probabilityColor(p: number): string {
  if (p >= 70) return 'var(--danger)'
  if (p >= 45) return 'var(--amber)'
  return 'var(--success)'
}

export function resilienceColor(r: number): string {
  if (r >= 60) return 'var(--success)'
  if (r >= 35) return 'var(--amber)'
  return 'var(--danger)'
}
