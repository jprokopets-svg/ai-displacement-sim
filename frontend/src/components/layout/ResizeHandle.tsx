import { useCallback, useEffect, useRef } from 'react'

interface Props {
  /** Current width of the pane this handle resizes (in pixels). */
  width: number
  /** Which edge this handle sits on — 'left' handle resizes a left sidebar, 'right' resizes a right panel. */
  side: 'left' | 'right'
  min?: number
  max?: number
  onResize: (width: number) => void
}

const DEFAULT_MIN = 180
const DEFAULT_MAX = 480

export default function ResizeHandle({ width, side, min = DEFAULT_MIN, max = DEFAULT_MAX, onResize }: Props) {
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const draggingRef = useRef(false)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current) return
    const delta = e.clientX - startXRef.current
    const raw = side === 'left' ? startWidthRef.current + delta : startWidthRef.current - delta
    const clamped = Math.max(min, Math.min(max, raw))
    onResize(clamped)
  }, [side, min, max, onResize])

  const onMouseUp = useCallback(() => {
    draggingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      style={handleStyle}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-accent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--border)')}
    />
  )
}

const handleStyle: React.CSSProperties = {
  width: 4,
  flexShrink: 0,
  height: '100%',
  background: 'var(--border)',
  cursor: 'col-resize',
  transition: 'background var(--motion-fast)',
  zIndex: 10,
}
