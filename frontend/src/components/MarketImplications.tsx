import { useState } from 'react'

type Track = 'all' | 'cognitive' | 'robotics' | 'agentic' | 'offshoring'

interface Beneficiary {
  name: string
  ticker: string
  why: string
  track: Track
  confidence: 'high' | 'medium' | 'speculative'
}

interface Headwind {
  sector: string
  why: string
  track: Track
  severity: 'high' | 'medium' | 'moderate'
}

const BENEFICIARIES: Beneficiary[] = [
  {
    name: 'Nvidia',
    ticker: 'NVDA',
    why: 'GPU compute monopoly powers all AI training and inference. Every displacement track runs on Nvidia hardware.',
    track: 'cognitive',
    confidence: 'high',
  },
  {
    name: 'Aurora Innovation',
    ticker: 'AUR',
    why: 'Autonomous trucking platform. Direct beneficiary of 3.5M US truck driver displacement as self-driving scales.',
    track: 'robotics',
    confidence: 'medium',
  },
  {
    name: 'Fanuc',
    ticker: 'FANUY',
    why: 'World\'s largest maker of industrial robots. Benefits from every tariff-driven reshoring investment that requires automation.',
    track: 'robotics',
    confidence: 'high',
  },
  {
    name: 'ABB',
    ticker: 'ABB',
    why: 'Industrial automation and robotics. Cobots and warehouse automation positioned for logistics displacement.',
    track: 'robotics',
    confidence: 'high',
  },
  {
    name: 'Salesforce',
    ticker: 'CRM',
    why: 'Agentforce platform enables agentic AI workflows. Positioned to replace junior sales, service, and admin roles.',
    track: 'agentic',
    confidence: 'medium',
  },
  {
    name: 'Thomson Reuters',
    ticker: 'TRI',
    why: 'CoCounsel AI legal assistant. Monopoly on legal data positions them to capture paralegal/associate displacement.',
    track: 'cognitive',
    confidence: 'high',
  },
  {
    name: 'Palantir',
    ticker: 'PLTR',
    why: 'AI decision platforms for government and enterprise. Reduces need for human analysts across defense and intelligence.',
    track: 'agentic',
    confidence: 'medium',
  },
  {
    name: 'Constellation Energy',
    ticker: 'CEG',
    why: 'Nuclear power for AI data centers. Structural electricity demand from compute regardless of which AI companies win.',
    track: 'all',
    confidence: 'high',
  },
  {
    name: 'Symbotic',
    ticker: 'SYM',
    why: 'AI-powered warehouse automation. Walmart and other major retailers deploying to replace warehouse workers.',
    track: 'robotics',
    confidence: 'medium',
  },
  {
    name: 'Intuitive Surgical',
    ticker: 'ISRG',
    why: 'da Vinci robotic surgery platform. Augments surgeons today, autonomous capabilities expanding over time.',
    track: 'robotics',
    confidence: 'high',
  },
]

const HEADWINDS: Headwind[] = [
  {
    sector: 'Staffing Agencies (Robert Half, Hays, Adecco)',
    why: 'Core business model disrupted as AI fills temp/contract roles. Administrative and office staffing most vulnerable.',
    track: 'agentic',
    severity: 'high',
  },
  {
    sector: 'Traditional Legal Services (small/mid law firms)',
    why: 'Document review, contract analysis, and legal research automating rapidly. Harvey and CoCounsel compress billable hours.',
    track: 'cognitive',
    severity: 'high',
  },
  {
    sector: 'Regional Banks in High-Displacement Counties',
    why: 'Loan defaults rise as local employment declines. Commercial real estate exposure compounds with remote work trends.',
    track: 'all',
    severity: 'medium',
  },
  {
    sector: 'Middle-Market Commercial Real Estate',
    why: 'Office demand structurally declining as knowledge workers displaced or go remote. Class B/C office most exposed.',
    track: 'cognitive',
    severity: 'high',
  },
  {
    sector: 'Call Center Operators (Teleperformance, Concentrix)',
    why: 'AI voice agents and chatbots replacing Tier 1 and Tier 2 support. Offshore cost advantage eliminated by AI.',
    track: 'agentic',
    severity: 'high',
  },
  {
    sector: 'Traditional Consulting (mid-tier firms)',
    why: 'AI tools automate junior analyst work product. Slide decks, data analysis, and benchmarking commoditized.',
    track: 'cognitive',
    severity: 'medium',
  },
  {
    sector: 'Freight Brokerage (legacy players)',
    why: 'AI-powered freight matching and autonomous trucking compress margins for traditional broker intermediaries.',
    track: 'robotics',
    severity: 'moderate',
  },
  {
    sector: 'Tax Preparation Services',
    why: 'AI tax assistants and automated filing expanding capabilities. Professional preparer demand declining for standard returns.',
    track: 'cognitive',
    severity: 'medium',
  },
]

const TRACK_COLORS: Record<Track, string> = {
  all: '#9a9ab0',
  cognitive: '#4a9eff',
  robotics: '#f97316',
  agentic: '#b44aff',
  offshoring: '#4ade80',
}

const TRACK_LABELS: Record<Track, string> = {
  all: 'All Tracks',
  cognitive: 'Cognitive AI',
  robotics: 'Robotics',
  agentic: 'Agentic AI',
  offshoring: 'Offshoring',
}

const CONFIDENCE_COLORS = {
  high: '#4aff8a',
  medium: '#ffa84a',
  speculative: '#ff4a4a',
}

const SEVERITY_COLORS = {
  high: '#ff4a4a',
  medium: '#ffa84a',
  moderate: '#f1c40f',
}

export default function MarketImplications() {
  const [trackFilter, setTrackFilter] = useState<Track>('all')

  const filteredBeneficiaries = trackFilter === 'all'
    ? BENEFICIARIES
    : BENEFICIARIES.filter(b => b.track === trackFilter || b.track === 'all')

  const filteredHeadwinds = trackFilter === 'all'
    ? HEADWINDS
    : HEADWINDS.filter(h => h.track === trackFilter || h.track === 'all')

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Disclaimer */}
      <div style={{
        background: 'rgba(255,74,74,0.08)', border: '1px solid rgba(255,74,74,0.3)',
        borderRadius: 8, padding: '12px 16px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>
          Structural Macro Analysis Only
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          This section identifies structural beneficiaries and headwinds from AI workforce displacement.
          It is <strong style={{ color: 'var(--text-primary)' }}>not financial or investment advice</strong>.
          Market prices already reflect some of these dynamics. Timing, valuation, and execution risk
          are not modeled here. Consult a licensed financial advisor before making investment decisions.
        </div>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Market Implications</h2>

      {/* Track filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {(Object.keys(TRACK_LABELS) as Track[]).map(t => (
          <button
            key={t}
            onClick={() => setTrackFilter(t)}
            style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 500,
              border: `1px solid ${trackFilter === t ? TRACK_COLORS[t] : 'var(--border)'}`,
              background: trackFilter === t ? `${TRACK_COLORS[t]}15` : 'transparent',
              color: trackFilter === t ? TRACK_COLORS[t] : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {TRACK_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Section A: Structural Beneficiaries */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--success)' }}>
        Structural Beneficiaries
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Companies positioned to gain from AI displacement trends.
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
        {filteredBeneficiaries.map((b, i) => (
          <div key={i} style={{
            background: 'var(--bg-panel)', borderRadius: 6, padding: '10px 14px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{b.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{b.ticker}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: `${TRACK_COLORS[b.track]}20`,
                  color: TRACK_COLORS[b.track],
                }}>
                  {TRACK_LABELS[b.track]}
                </span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: `${CONFIDENCE_COLORS[b.confidence]}15`,
                  color: CONFIDENCE_COLORS[b.confidence],
                }}>
                  {b.confidence}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {b.why}
            </div>
          </div>
        ))}
      </div>

      {/* Section B: Structural Headwinds */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--danger)' }}>
        Structural Headwinds
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Sectors facing pressure from AI workforce displacement.
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        {filteredHeadwinds.map((h, i) => (
          <div key={i} style={{
            background: 'var(--bg-panel)', borderRadius: 6, padding: '10px 14px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{h.sector}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: `${TRACK_COLORS[h.track]}20`,
                  color: TRACK_COLORS[h.track],
                }}>
                  {TRACK_LABELS[h.track]}
                </span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: `${SEVERITY_COLORS[h.severity]}15`,
                  color: SEVERITY_COLORS[h.severity],
                }}>
                  {h.severity}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {h.why}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
