/**
 * Canvas rendering for the 50K simulation fiber-bundle.
 *
 * Performance plan: one Path2D with 50K subpaths, stroked once. Then the
 * 90%/50% CI bands and the median line are overlaid. Axes are drawn last.
 */
import { N_SIMS, N_YEARS, YEAR_START, YEAR_END, type SimulationResult } from './model'

export const AXIS_LEFT = 44        // room for Y labels
export const AXIS_BOTTOM = 26      // room for X labels
export const AXIS_TOP = 8
export const AXIS_RIGHT = 10

/** Reverse-map a CSS-pixel position on the canvas to year + displacement %. */
export function canvasToData(
  cssX: number,
  cssY: number,
  canvasEl: HTMLCanvasElement,
): { year: number; pct: number; inPlot: boolean } {
  const cssW = canvasEl.clientWidth
  const cssH = canvasEl.clientHeight
  const plotX = AXIS_LEFT
  const plotY = AXIS_TOP
  const plotW = cssW - AXIS_LEFT - AXIS_RIGHT
  const plotH = cssH - AXIS_TOP - AXIS_BOTTOM

  const xRatio = Math.max(0, Math.min(1, (cssX - plotX) / plotW))
  const yearIdx = Math.round(xRatio * (N_YEARS - 1))
  const year = YEAR_START + yearIdx

  const yRatio = Math.max(0, Math.min(1, (cssY - plotY) / plotH))
  const pct = (1 - yRatio) * 100

  const inPlot = cssX >= plotX && cssX <= plotX + plotW &&
                 cssY >= plotY && cssY <= plotY + plotH
  return { year, pct, inPlot }
}

export function drawSimulation(
  canvas: HTMLCanvasElement,
  result: SimulationResult,
  opts: { thresholdPct: number },
): void {
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cssW, cssH)

  const plotX = AXIS_LEFT
  const plotY = AXIS_TOP
  const plotW = cssW - AXIS_LEFT - AXIS_RIGHT
  const plotH = cssH - AXIS_TOP - AXIS_BOTTOM

  // Coordinate helpers — year index → x px, displacement 0-1 → y px.
  const xOf = (i: number) => plotX + (i / (N_YEARS - 1)) * plotW
  const yOf = (v: number) => plotY + (1 - v) * plotH

  // ---- Grid ----
  ctx.strokeStyle = '#1f2942'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let pct = 0; pct <= 100; pct += 20) {
    const y = yOf(pct / 100)
    ctx.moveTo(plotX, y)
    ctx.lineTo(plotX + plotW, y)
  }
  ctx.stroke()

  // ---- Stability threshold line ----
  const thresholdY = yOf(opts.thresholdPct / 100)
  ctx.setLineDash([3, 4])
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(plotX, thresholdY)
  ctx.lineTo(plotX + plotW, thresholdY)
  ctx.stroke()
  ctx.setLineDash([])

  // ---- 50K simulation paths (fiber bundle) ----
  // Single large path, stroked once — dramatically cheaper than 50K stroke calls.
  const paths = result.paths
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.03)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let s = 0; s < N_SIMS; s++) {
    const base = s * N_YEARS
    ctx.moveTo(xOf(0), yOf(paths[base]))
    for (let i = 1; i < N_YEARS; i++) {
      ctx.lineTo(xOf(i), yOf(paths[base + i]))
    }
  }
  ctx.stroke()

  // ---- 90% CI band (p05–p95) ----
  const { p05, p25, p50, p75, p95 } = result.percentiles
  ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(p05[0]))
  for (let i = 1; i < N_YEARS; i++) ctx.lineTo(xOf(i), yOf(p05[i]))
  for (let i = N_YEARS - 1; i >= 0; i--) ctx.lineTo(xOf(i), yOf(p95[i]))
  ctx.closePath()
  ctx.fill()

  // ---- 50% CI band (p25–p75) ----
  ctx.fillStyle = 'rgba(245, 158, 11, 0.25)'
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(p25[0]))
  for (let i = 1; i < N_YEARS; i++) ctx.lineTo(xOf(i), yOf(p25[i]))
  for (let i = N_YEARS - 1; i >= 0; i--) ctx.lineTo(xOf(i), yOf(p75[i]))
  ctx.closePath()
  ctx.fill()

  // ---- Median line ----
  ctx.strokeStyle = '#e6ebf5'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(p50[0]))
  for (let i = 1; i < N_YEARS; i++) ctx.lineTo(xOf(i), yOf(p50[i]))
  ctx.stroke()

  // ---- Axes ----
  ctx.fillStyle = '#5e6a85'
  ctx.font = '11px Inter, -apple-system, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  // Y labels
  for (let pct = 0; pct <= 100; pct += 20) {
    ctx.fillText(`${pct}%`, plotX - 6, yOf(pct / 100))
  }
  // X labels — every 5 years
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let y = YEAR_START; y <= YEAR_END; y += 5) {
    const i = y - YEAR_START
    ctx.fillText(String(y), xOf(i), plotY + plotH + 6)
  }
  // Final year explicit
  if ((YEAR_END - YEAR_START) % 5 !== 0) {
    ctx.fillText(String(YEAR_END), xOf(N_YEARS - 1), plotY + plotH + 6)
  }

  // Threshold label
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'
  ctx.fillText(`Stability threshold ${opts.thresholdPct}%`, plotX + 6, thresholdY - 3)
}
