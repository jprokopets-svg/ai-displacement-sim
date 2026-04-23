/**
 * Generate a shareable PNG card using the native Canvas API.
 * No extra dependencies. Produces a 1200×630 card (OG-image sized).
 */

export interface CardInput {
  jobTitle: string
  probability: number
  timelineLabel: string
  countyName: string
  siteUrl: string
}

const W = 1200
const H = 630

export function renderShareCard(input: CardInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0a0e1a')
  bg.addColorStop(1, '#141b30')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Grid lines for texture
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.06)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Header eyebrow
  ctx.fillStyle = '#f59e0b'
  ctx.font = '500 18px "DM Mono", ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText('AI DISPLACEMENT SIMULATOR', 60, 74)

  // Job title
  ctx.fillStyle = '#e6ebf5'
  ctx.font = '600 44px Inter, -apple-system, sans-serif'
  wrapText(ctx, truncate(input.jobTitle, 50), 60, 140, W - 120, 52)

  // Divider
  ctx.strokeStyle = '#1f2942'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(60, 210)
  ctx.lineTo(W - 60, 210)
  ctx.stroke()

  // Main metric: probability
  ctx.fillStyle = '#b0bcd4'
  ctx.font = '500 16px Inter, sans-serif'
  ctx.fillText('DISPLACEMENT PROBABILITY (10 YEAR HORIZON)', 60, 260)

  const probColor = input.probability >= 70 ? '#ef4444'
    : input.probability >= 45 ? '#f59e0b' : '#10b981'
  ctx.fillStyle = probColor
  ctx.font = '500 160px "DM Mono", ui-monospace, monospace'
  ctx.fillText(`${input.probability}%`, 60, 420)

  // Right-side stack
  const rightX = 760
  ctx.fillStyle = '#b0bcd4'
  ctx.font = '500 14px Inter, sans-serif'
  ctx.fillText('TIMELINE', rightX, 260)
  ctx.fillStyle = '#e6ebf5'
  ctx.font = '500 40px "DM Mono", ui-monospace, monospace'
  ctx.fillText(input.timelineLabel, rightX, 304)

  if (input.countyName) {
    ctx.fillStyle = '#b0bcd4'
    ctx.font = '500 14px Inter, sans-serif'
    ctx.fillText('LOCATION', rightX, 360)
    ctx.fillStyle = '#e6ebf5'
    ctx.font = '500 24px Inter, sans-serif'
    wrapText(ctx, truncate(input.countyName, 32), rightX, 390, W - rightX - 60, 28)
  }

  // Footer
  ctx.strokeStyle = '#1f2942'
  ctx.beginPath()
  ctx.moveTo(60, H - 90)
  ctx.lineTo(W - 60, H - 90)
  ctx.stroke()

  ctx.fillStyle = '#8fa0b8'
  ctx.font = '500 14px "DM Mono", ui-monospace, monospace'
  ctx.fillText('CHECK YOURS', 60, H - 50)
  ctx.fillStyle = '#e6ebf5'
  ctx.font = '500 18px "DM Mono", ui-monospace, monospace'
  ctx.fillText(input.siteUrl, 60, H - 26)

  // Accent dot
  ctx.fillStyle = '#3b82f6'
  ctx.beginPath()
  ctx.arc(W - 80, H - 40, 8, 0, Math.PI * 2)
  ctx.fill()

  return canvas
}

export function downloadCard(input: CardInput, filename = 'my-ai-risk.png'): void {
  const canvas = renderShareCard(input)
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

export function shareTextFor(input: CardInput): string {
  const year = input.timelineLabel.split('–')[0]
  const title = input.jobTitle || 'my role'
  const county = input.countyName ? ` in ${input.countyName.split(',')[0].trim()}` : ''
  return `I just checked my AI displacement risk as a ${title}. ${input.probability}% probability of significant job change by ${year}${county}. Check yours: ${input.siteUrl}`
}

export function twitterShareUrl(input: CardInput): string {
  const text = encodeURIComponent(shareTextFor(input))
  return `https://twitter.com/intent/tweet?text=${text}`
}

export function linkedinShareUrl(siteUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://' + siteUrl)}`
}

export function facebookShareUrl(siteUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://' + siteUrl)}`
}

export function redditShareUrl(input: CardInput): string {
  const title = `My job as a ${input.jobTitle || 'my role'} has a ${input.probability}% AI displacement risk by ${input.timelineLabel.split('–')[0]} — county-level simulator with 3,204 counties`
  return `https://reddit.com/submit?url=${encodeURIComponent('https://' + input.siteUrl)}&title=${encodeURIComponent(title)}`
}

export function coworkerShareUrl(jobTitle: string, siteUrl: string): string {
  return `https://${siteUrl}?prefill=${encodeURIComponent(jobTitle)}#my-risk`
}

export function coworkerShareText(input: CardInput): string {
  return `My job as a ${input.jobTitle || 'my role'} has a ${input.probability}% AI displacement risk. What's yours? We can compare: ${coworkerShareUrl(input.jobTitle, input.siteUrl)}`
}

// --- helpers ---

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ')
  let line = ''
  let cursorY = y
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY)
      line = word
      cursorY += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, cursorY)
}
