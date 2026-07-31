import { findTemplate } from '../data/templates'
import type { PostcardDraft } from '../types'

export const OUTPUT_WIDTH = 1748
export const OUTPUT_HEIGHT = 1240

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = src
  })
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, scale = 1) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight) * scale
  const drawWidth = image.naturalWidth * ratio
  const drawHeight = image.naturalHeight * ratio
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 4) {
  const chars = [...text]
  const lines: string[] = []
  let line = ''
  for (const char of chars) {
    const next = line + char
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = char
      if (lines.length === maxLines - 1) break
    } else line = next
  }
  const used = lines.join('').length
  if (line && lines.length < maxLines) lines.push(line + (used + line.length < chars.length ? '…' : ''))
  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight))
}

function drawMotif(context: CanvasRenderingContext2D, motif: string, accent: string, muted: string) {
  context.save()
  if (motif === 'grid') {
    context.strokeStyle = `${muted}33`
    context.lineWidth = 1
    for (let x = 0; x <= OUTPUT_WIDTH; x += 62) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, OUTPUT_HEIGHT); context.stroke() }
    for (let y = 0; y <= OUTPUT_HEIGHT; y += 62) { context.beginPath(); context.moveTo(0, y); context.lineTo(OUTPUT_WIDTH, y); context.stroke() }
  } else if (motif === 'rings') {
    context.strokeStyle = `${muted}44`
    context.lineWidth = 2
    for (let radius = 120; radius < 760; radius += 92) { context.beginPath(); context.arc(1700, 70, radius, 0, Math.PI * 2); context.stroke() }
  } else if (motif === 'mountain') {
    context.globalAlpha = 0.14
    context.fillStyle = muted
    context.beginPath()
    context.moveTo(0, 1000); context.bezierCurveTo(260, 810, 420, 1000, 670, 830); context.bezierCurveTo(900, 660, 1040, 950, 1260, 780); context.bezierCurveTo(1460, 630, 1610, 820, 1748, 710); context.lineTo(1748, 1240); context.lineTo(0, 1240); context.fill()
  } else if (motif === 'window') {
    context.strokeStyle = `${muted}38`
    context.lineWidth = 3
    for (let index = 0; index < 4; index += 1) context.strokeRect(1110 + index * 136, 100, 110, 340)
  } else {
    context.strokeStyle = accent
    context.globalAlpha = 0.16
    context.lineWidth = 10
    context.beginPath(); context.arc(1510, 235, 150, 0, Math.PI * 2); context.stroke()
    context.font = '700 130px "Songti SC", STSong, SimSun, serif'
    context.textAlign = 'center'; context.fillStyle = accent; context.fillText('淳', 1510, 280)
  }
  context.restore()
}

export async function renderPostcard(draft: PostcardDraft, mime: 'image/png' | 'image/jpeg' = 'image/png', quality = 0.94) {
  const template = findTemplate(draft.templateId)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_WIDTH
  canvas.height = OUTPUT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前设备不支持图片合成')

  context.fillStyle = template.background
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
  drawMotif(context, template.motif, template.accent, template.muted)
  context.strokeStyle = `${template.accent}80`
  context.lineWidth = 3
  context.strokeRect(38, 38, OUTPUT_WIDTH - 76, OUTPUT_HEIGHT - 76)
  context.strokeStyle = `${template.muted}65`
  context.lineWidth = 1
  context.strokeRect(55, 55, OUTPUT_WIDTH - 110, OUTPUT_HEIGHT - 110)

  context.textAlign = 'left'
  context.fillStyle = template.accent
  context.font = '600 22px "Microsoft YaHei", sans-serif'
  context.letterSpacing = '8px'
  context.fillText('CHUNAN NO.3 MIDDLE SCHOOL', 112, 126)
  context.letterSpacing = '0px'
  context.fillStyle = template.ink
  context.font = '600 74px "Songti SC", STSong, SimSun, serif'
  context.fillText(template.title, 108, 220)
  context.font = '28px "Songti SC", STSong, SimSun, serif'
  context.fillStyle = template.muted
  context.fillText(template.subtitle, 112, 274)
  context.textAlign = 'right'
  context.fillStyle = template.accent
  context.font = '500 34px Georgia, serif'
  context.fillText(template.year, OUTPUT_WIDTH - 112, 126)

  const photoX = 105 + (draft.photo.x - 0.24) * 240
  const photoY = 330 + (draft.photo.y - 0.48) * 170
  const photoWidth = 820
  const photoHeight = 690
  context.save()
  roundedRect(context, photoX, photoY, photoWidth, photoHeight, 12)
  context.clip()
  if (draft.photoDataUrl) {
    const photo = await loadImage(draft.photoDataUrl)
    drawCover(context, photo, photoX, photoY, photoWidth, photoHeight, draft.photo.scale)
  } else {
    context.fillStyle = '#ffffff72'
    context.fillRect(photoX, photoY, photoWidth, photoHeight)
    context.fillStyle = `${template.muted}88`
    context.textAlign = 'center'
    context.font = '30px "Microsoft YaHei", sans-serif'
    context.fillText('在这里留下一张今日影像', photoX + photoWidth / 2, photoY + photoHeight / 2)
  }
  context.restore()
  context.strokeStyle = `${template.muted}77`
  context.lineWidth = 2
  roundedRect(context, photoX, photoY, photoWidth, photoHeight, 12)
  context.stroke()

  const textX = 1010
  context.textAlign = 'left'
  context.fillStyle = template.accent
  context.font = '600 20px "Microsoft YaHei", sans-serif'
  context.fillText('A LETTER TO THE FUTURE', textX, 382)
  context.fillStyle = template.ink
  context.font = '38px "Songti SC", STSong, SimSun, serif'
  wrapText(context, draft.message || '愿此刻被温柔珍藏。', textX, 456, 600, 62, 5)
  context.strokeStyle = `${template.muted}55`
  context.beginPath(); context.moveTo(textX, 780); context.lineTo(1618, 780); context.stroke()
  context.fillStyle = template.muted
  context.font = '22px "Microsoft YaHei", sans-serif'
  context.fillText(draft.graduationYear ? `${draft.graduationYear}届` : '淳安三中校友', textX, 832)

  if (draft.signature?.imageUrl) {
    const signature = await loadImage(draft.signature.imageUrl)
    const width = 410 * draft.signatureTransform.scale
    const height = Math.min(180, width * signature.naturalHeight / signature.naturalWidth)
    const x = 990 + (draft.signatureTransform.x - 0.73) * 300
    const y = 850 + (draft.signatureTransform.y - 0.72) * 180
    context.drawImage(signature, x, y, width, height)
  } else {
    context.fillStyle = template.ink
    context.font = '46px "STKaiti", "KaiTi", cursive'
    context.fillText(draft.sender || '一位三中人', textX, 934)
  }
  context.fillStyle = template.muted
  context.font = '20px "Microsoft YaHei", sans-serif'
  context.fillText(new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date()), textX, 1080)
  context.textAlign = 'right'
  context.font = '18px "Microsoft YaHei", sans-serif'
  context.fillText(`NO. ${draft.id}`, OUTPUT_WIDTH - 112, OUTPUT_HEIGHT - 88)

  return canvas.toDataURL(mime, quality)
}

export async function createArtifacts(draft: PostcardDraft) {
  const pngDataUrl = await renderPostcard(draft, 'image/png')
  const jpegDataUrl = await renderPostcard(draft, 'image/jpeg', 0.94)
  const source = await loadImage(pngDataUrl)
  const thumb = document.createElement('canvas')
  thumb.width = 480
  thumb.height = Math.round(480 * OUTPUT_HEIGHT / OUTPUT_WIDTH)
  thumb.getContext('2d')?.drawImage(source, 0, 0, thumb.width, thumb.height)
  return { draft: JSON.parse(JSON.stringify(draft)) as PostcardDraft, pngDataUrl, jpegDataUrl, thumbnailDataUrl: thumb.toDataURL('image/jpeg', 0.82) }
}
