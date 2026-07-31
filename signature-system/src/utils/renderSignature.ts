import type { SignatureArtifacts, SignatureContext, SignatureRecord, SignatureStroke } from '../types/signature'

const RATIO = 3
const TERMINAL_ID = import.meta.env.VITE_TERMINAL_ID || 'Z1-01'

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character] ?? character)
}

function strokePath(stroke: SignatureStroke, width: number, height: number) {
  if (!stroke.points.length) return ''
  const points = stroke.points.map((point) => ({ x: point.x * width, y: point.y * height }))
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} l 0.01 0`

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const midpoint = {
      x: (points[i].x + points[i + 1].x) / 2,
      y: (points[i].y + points[i + 1].y) / 2,
    }
    path += ` Q ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} ${midpoint.x.toFixed(2)} ${midpoint.y.toFixed(2)}`
  }
  const last = points.at(-1)!
  path += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  return path
}

export function renderStrokes(
  context: CanvasRenderingContext2D,
  strokes: SignatureStroke[],
  width: number,
  height: number,
  clear = true,
) {
  if (clear) context.clearRect(0, 0, width, height)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const scale = height / 400

  for (const stroke of strokes) {
    if (!stroke.points.length) continue
    context.strokeStyle = stroke.color
    const points = stroke.points
    if (points.length === 1) {
      const point = points[0]
      context.beginPath()
      context.arc(point.x * width, point.y * height, (stroke.width * scale) / 2, 0, Math.PI * 2)
      context.fillStyle = stroke.color
      context.fill()
      continue
    }

    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1]
      const current = points[i]
      const pressure = (previous.pressure + current.pressure) / 2
      context.lineWidth = stroke.width * scale * (0.65 + pressure * 0.55)
      context.beginPath()
      context.moveTo(previous.x * width, previous.y * height)
      context.lineTo(current.x * width, current.y * height)
      context.stroke()
    }
  }
}

export function createSvg(strokes: SignatureStroke[], width = 1200, height = 400) {
  const paths = strokes.map((stroke) => {
    const averagePressure = stroke.points.reduce((sum, point) => sum + point.pressure, 0) / Math.max(1, stroke.points.length)
    const strokeWidth = stroke.width * (0.65 + averagePressure * 0.55)
    return `<path d="${strokePath(stroke, width, height)}" fill="none" stroke="${escapeXml(stroke.color)}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths}</svg>`
}

function createImage(strokes: SignatureStroke[], width: number, height: number, mime: 'image/png' | 'image/jpeg', background?: string) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前终端不支持 Canvas')
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
  }
  renderStrokes(context, strokes, width, height, false)
  return canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.92 : undefined)
}

export function createArtifacts(strokes: SignatureStroke[], startedAt: number, context: SignatureContext): SignatureArtifacts {
  const now = new Date()
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5)
  const id = `SIG-${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${random.toUpperCase()}`
  const pointCount = strokes.reduce((total, stroke) => total + stroke.points.length, 0)
  const pathLength = strokes.reduce((total, stroke) => total + stroke.points.slice(1).reduce((sum, point, index) => {
    const previous = stroke.points[index]
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y)
  }, 0), 0)

  const record: SignatureRecord = {
    id,
    trace_id: crypto.randomUUID(),
    created_at: now.toISOString(),
    terminal_id: TERMINAL_ID,
    canvas_ratio: RATIO,
    duration_ms: Math.max(0, Date.now() - startedAt),
    context: { ...context },
    strokes: strokes.map((stroke) => ({
      stroke_id: stroke.stroke_id,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    metrics: {
      stroke_count: strokes.length,
      point_count: pointCount,
      normalized_path_length: Number(pathLength.toFixed(5)),
    },
  }

  return {
    record,
    svg: createSvg(strokes),
    displayPng: createImage(strokes, 1200, 400, 'image/png'),
    displayJpg: createImage(strokes, 1200, 400, 'image/jpeg', '#ffffff'),
    printPng: createImage(strokes, 3000, 1000, 'image/png', '#ffffff'),
    thumbnailPng: createImage(strokes, 360, 120, 'image/png'),
  }
}
