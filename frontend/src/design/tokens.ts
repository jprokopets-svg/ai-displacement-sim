/**
 * Design tokens — single source of truth for colors, typography, spacing.
 * CSS variables in index.css mirror these; update both in lockstep.
 */

export const color = {
  // Surfaces
  bg: '#0a0e1a',
  bgElevated: '#10162a',
  bgPanel: '#141b30',
  bgPanelHover: '#1a2340',
  bgInset: '#0c1120',

  // Borders
  border: '#1f2942',
  borderStrong: '#2a3555',
  borderAccent: 'rgba(59, 130, 246, 0.4)',

  // Text
  textPrimary: '#e6ebf5',
  textSecondary: '#c6cfdf', // 10.9:1 on panel
  textMuted: '#aab7cb',     //  8.4:1 on panel
  textDim: '#8c9db6',       //  6.2:1 on panel

  // Accents
  accent: '#3b82f6',
  accentHover: '#60a5fa',
  accentDim: 'rgba(59, 130, 246, 0.15)',

  amber: '#f59e0b',
  amberDim: 'rgba(245, 158, 11, 0.15)',

  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  dangerDim: 'rgba(239, 68, 68, 0.18)',

  // Data / choropleth stops (percentile-based, extended upper range)
  ramp: {
    p0: '#2ecc71',
    p25: '#f1c40f',
    p50: '#e67e22',
    p75: '#e74c3c',
    p90: '#c0392b',
    p97: '#7b241c',
  },

  // Confidence tints for ticker entries
  confidenceHigh: '#ef4444',   // confidence 4-5 (most certain / most severe)
  confidenceMed: '#f59e0b',    // confidence 3
  confidenceLow: '#9aa6be',    // confidence 1-2
} as const

export const font = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'DM Mono', 'SF Mono', Menlo, Consolas, monospace",
} as const

export const fontSize = {
  micro: '10px',
  label: '11px',      // section headers, small-caps eyebrows
  small: '12px',      // data labels
  body: '14px',       // body text
  md: '16px',         // small data values
  lg: '20px',         // medium data values
  xl: '24px',         // large data values
  xxl: '32px',        // hero data values
} as const

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export const space = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const

export const radius = {
  sm: '3px',
  md: '4px',
  lg: '6px',
  xl: '8px',
} as const

export const layout = {
  headerHeight: '56px',
  tickerHeight: '28px',
  footerHeight: '32px',
  sidebarWidth: '280px',
  rightPanelWidth: '320px',
} as const

export const motion = {
  fast: '120ms cubic-bezier(0.2, 0, 0.1, 1)',
  base: '200ms cubic-bezier(0.2, 0, 0.1, 1)',
  slow: '320ms cubic-bezier(0.2, 0, 0.1, 1)',
} as const

export const shadow = {
  panel: '0 1px 2px rgba(0, 0, 0, 0.4)',
  raised: '0 4px 12px rgba(0, 0, 0, 0.5)',
  focus: '0 0 0 2px rgba(59, 130, 246, 0.4)',
} as const

export const z = {
  map: 1,
  overlay: 10,
  panel: 50,
  header: 100,
  tooltip: 9999,
  modal: 10000,
} as const
