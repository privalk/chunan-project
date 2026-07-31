import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { audit, dataDir, db, getSettings, hashPassword, hashText, nowIso, postcardDir, runMaintenance, signatureDir, verifyPassword } from './database.mjs'
import { chooseLocalAddress, publicBaseUrl } from './network-address.mjs'
import { createZip } from './zip.mjs'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.dirname(serverDir)
const distDir = path.join(projectDir, 'dist')
const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'
const publicAddress = chooseLocalAddress(networkInterfaces(), process.env.ADMIN_PUBLIC_HOST)
const postcardPublicBaseUrl = publicBaseUrl({
  configuredBaseUrl: process.env.POSTCARD_PUBLIC_BASE_URL,
  address: publicAddress,
  port,
})
const sessionHours = Number(process.env.SESSION_HOURS || 8)
const secureCookies = process.env.HTTPS === 'true'
const loginAttempts = new Map()

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json; charset=utf-8',
}

function json(res, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length, ...headers })
  res.end(data)
}

function fail(res, status, code, message, detail) {
  json(res, status, { error: { code, message, ...(detail ? { detail } : {}) } })
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter((parts) => parts.length === 2))
}

async function parseJson(req, maxBytes = 30 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw Object.assign(new Error('请求内容过大'), { status: 413 })
    chunks.push(chunk)
  }
  if (!size) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('JSON 格式无效'), { status: 400 })
  }
}

function setSessionCookie(res, token) {
  const attributes = [`sid=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${sessionHours * 3600}`]
  if (secureCookies) attributes.push('Secure')
  res.setHeader('Set-Cookie', attributes.join('; '))
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies ? '; Secure' : ''}`)
}

function currentUser(req) {
  const token = parseCookies(req).sid
  if (!token) return null
  const tokenHash = hashText(token)
  const row = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.role, u.status, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?
  `).get(tokenHash)
  if (!row || row.status !== 'active' || row.expires_at < nowIso()) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    return null
  }
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), tokenHash)
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role }
}

function requireUser(req, res, roles = ['admin', 'operator', 'auditor']) {
  const user = currentUser(req)
  if (!user) {
    fail(res, 401, 'UNAUTHORIZED', '登录状态已失效，请重新登录')
    return null
  }
  if (!roles.includes(user.role)) {
    fail(res, 403, 'FORBIDDEN', '当前账号没有执行此操作的权限')
    return null
  }
  return user
}

function terminalAuth(req, res) {
  const terminalId = String(req.headers['x-terminal-id'] || '')
  const apiKey = String(req.headers['x-terminal-key'] || '')
  if (!terminalId || !apiKey) {
    fail(res, 401, 'TERMINAL_AUTH_REQUIRED', '缺少终端身份信息')
    return null
  }
  const terminal = db.prepare('SELECT * FROM terminals WHERE id = ?').get(terminalId)
  if (!terminal || terminal.api_key_hash !== hashText(apiKey)) {
    fail(res, 401, 'INVALID_TERMINAL_KEY', '终端密钥无效')
    return null
  }
  return terminal
}

function logAction(req, user, action, entityType, entityId, detail = {}) {
  audit({ userId: user.id, username: user.username, action, entityType, entityId, detail, ip: clientIp(req) })
}

function safeSignatureId(value) {
  const id = String(value || '')
  if (!/^SIG-[A-Z0-9-]{8,80}$/i.test(id)) throw Object.assign(new Error('签名编号格式无效'), { status: 400 })
  return id
}

function safePostcardId(value) {
  const id = String(value || '')
  if (!/^PC-[A-Z0-9-]{8,80}$/i.test(id)) throw Object.assign(new Error('明信片编号格式无效'), { status: 400 })
  return id
}

function safePrintJobId(value) {
  const id = String(value || '')
  if (!/^PRINT-[A-Z0-9-]{8,100}$/i.test(id)) throw Object.assign(new Error('打印任务编号格式无效'), { status: 400 })
  return id
}

function decodeDataUrl(value, mime) {
  const match = String(value || '').match(/^data:([^;,]+);base64,(.+)$/s)
  if (!match || (mime && match[1] !== mime)) throw Object.assign(new Error(`缺少有效的 ${mime || '文件'} 数据`), { status: 400 })
  return Buffer.from(match[2], 'base64')
}

function sanitizeContext(record) {
  const context = record.context || {}
  const clean = (value, max = 80) => value == null ? null : String(value).trim().slice(0, max) || null
  return {
    displayName: clean(context.display_name),
    userNo: clean(context.user_no),
    identityType: clean(context.identity_type),
    className: clean(context.class_name),
    templateId: clean(context.template_id),
  }
}

function relativeSignaturePath(id, file) {
  return path.posix.join('signatures', id, file)
}

function relativePostcardPath(id, file) {
  return path.posix.join('postcards', id, file)
}

function absoluteDataPath(relativePath) {
  const resolved = path.resolve(dataDir, relativePath)
  if (!resolved.startsWith(path.resolve(dataDir) + path.sep)) throw new Error('非法文件路径')
  return resolved
}

async function ingestSignature(req, res, terminal) {
  const payload = await parseJson(req)
  const record = payload.record || {}
  const id = safeSignatureId(record.id)
  if (record.terminal_id && record.terminal_id !== terminal.id) return fail(res, 400, 'TERMINAL_MISMATCH', '记录中的终端编号与认证终端不一致')
  const existing = db.prepare('SELECT id, received_at FROM signatures WHERE id = ?').get(id)
  if (existing) return json(res, 200, { ok: true, duplicate: true, id, receivedAt: existing.received_at })

  if (!Array.isArray(record.strokes) || !record.strokes.length) return fail(res, 400, 'EMPTY_STROKES', '签名不包含有效笔迹')
  for (const stroke of record.strokes) {
    if (!Array.isArray(stroke.points)) return fail(res, 400, 'INVALID_STROKES', '笔迹点格式无效')
    for (const point of stroke.points) {
      if (![point.x, point.y, point.pressure, point.time].every(Number.isFinite) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        return fail(res, 400, 'INVALID_POINT', '笔迹点必须包含归一化坐标、压力和时间')
      }
    }
  }

  const dir = path.join(signatureDir, id)
  const tempDir = path.join(signatureDir, `.${id}-${randomBytes(4).toString('hex')}`)
  await mkdir(tempDir, { recursive: true })
  try {
    const display = decodeDataUrl(payload.displayPng, 'image/png')
    const print = decodeDataUrl(payload.printPng, 'image/png')
    const thumbnail = decodeDataUrl(payload.thumbnailPng, 'image/png')
    const jpg = payload.displayJpg ? decodeDataUrl(payload.displayJpg, 'image/jpeg') : null
    const context = sanitizeContext(record)
    const manifest = {
      id, created_at: record.created_at, received_at: nowIso(), terminal_id: terminal.id,
      files: { raw: 'raw.json', vector: 'signature.svg', display: 'display.png', print: 'print.png', thumbnail: 'thumbnail.png', ...(jpg ? { jpg: 'display.jpg' } : {}) },
    }
    await Promise.all([
      writeFile(path.join(tempDir, 'raw.json'), JSON.stringify(record, null, 2), 'utf8'),
      writeFile(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8'),
      writeFile(path.join(tempDir, 'signature.svg'), String(payload.svg || ''), 'utf8'),
      writeFile(path.join(tempDir, 'display.png'), display),
      writeFile(path.join(tempDir, 'print.png'), print),
      writeFile(path.join(tempDir, 'thumbnail.png'), thumbnail),
      ...(jpg ? [writeFile(path.join(tempDir, 'display.jpg'), jpg)] : []),
    ])
    await rename(tempDir, dir)

    const receivedAt = nowIso()
    const metrics = record.metrics || {}
    db.prepare(`
      INSERT INTO signatures (
        id, created_at, received_at, terminal_id, trace_id, display_name, user_no, identity_type, class_name, template_id,
        duration_ms, stroke_count, point_count, path_length, raw_path, svg_path, display_path, print_path, thumbnail_path, jpg_path, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, String(record.created_at || receivedAt), receivedAt, terminal.id, String(record.trace_id || req.headers['x-trace-id'] || ''),
      context.displayName, context.userNo, context.identityType, context.className, context.templateId,
      Number(record.duration_ms || 0), Number(metrics.stroke_count || record.strokes.length), Number(metrics.point_count || 0), Number(metrics.normalized_path_length || 0),
      relativeSignaturePath(id, 'raw.json'), relativeSignaturePath(id, 'signature.svg'), relativeSignaturePath(id, 'display.png'),
      relativeSignaturePath(id, 'print.png'), relativeSignaturePath(id, 'thumbnail.png'), jpg ? relativeSignaturePath(id, 'display.jpg') : null,
      JSON.stringify({ canvas_ratio: record.canvas_ratio || 3 }),
    )
    db.prepare('UPDATE terminals SET status = ?, last_seen_at = ?, updated_at = ?, ip_address = ? WHERE id = ?')
      .run('online', receivedAt, receivedAt, clientIp(req), terminal.id)
    audit({ username: `terminal:${terminal.id}`, action: 'signature.ingest', entityType: 'signature', entityId: id, detail: { traceId: record.trace_id || null }, ip: clientIp(req) })
    return json(res, 201, { ok: true, duplicate: false, id, receivedAt })
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    if (error.code === 'EEXIST') return fail(res, 409, 'FILE_EXISTS', '该签名文件已存在')
    throw error
  }
}

async function ingestPostcard(req, res, terminal) {
  if (terminal.id !== 'Z3-25') return fail(res, 403, 'FORBIDDEN', '当前终端未开通明信片归档权限')
  const payload = await parseJson(req)
  const draft = payload.draft || {}
  const id = safePostcardId(draft.id)
  const existing = db.prepare('SELECT id, received_at FROM postcards WHERE id = ?').get(id)
  if (existing) return json(res, 200, { ok: true, duplicate: true, id, receivedAt: existing.received_at })
  if (!db.prepare('SELECT 1 FROM postcard_templates WHERE id = ? AND enabled = 1').get(String(draft.templateId || ''))) {
    return fail(res, 400, 'INVALID_TEMPLATE', '模板不存在或已停用')
  }
  const clean = (value, max) => String(value || '').trim().slice(0, max) || null
  const signatureId = draft.signature?.id ? safeSignatureId(draft.signature.id) : null
  const signatureOwner = signatureId
    ? db.prepare("SELECT display_name, identity_type FROM signatures WHERE id = ? AND status != 'deleted'").get(signatureId)
    : null
  const sender = clean(draft.sender, 40)
    || (signatureOwner?.identity_type !== 'anonymous' ? clean(signatureOwner?.display_name, 40) : null)
  const png = decodeDataUrl(payload.pngDataUrl, 'image/png')
  const jpg = decodeDataUrl(payload.jpegDataUrl, 'image/jpeg')
  const thumbnail = decodeDataUrl(payload.thumbnailDataUrl, 'image/jpeg')
  const tempDir = path.join(postcardDir, `.${id}-${randomBytes(4).toString('hex')}`)
  const dir = path.join(postcardDir, id)
  await mkdir(tempDir, { recursive: true })
  try {
    const receivedAt = nowIso()
    const manifest = {
      id,
      created_at: draft.createdAt || receivedAt,
      received_at: receivedAt,
      terminal_id: terminal.id,
      trace_id: clean(draft.traceId, 100),
      signature_id: signatureId,
      template_id: draft.templateId,
      sender,
      graduation_year: clean(draft.graduationYear, 10),
      message: clean(draft.message, 300),
      files: { png: 'postcard.png', jpg: 'postcard.jpg', thumbnail: 'thumbnail.jpg' },
    }
    await Promise.all([
      writeFile(path.join(tempDir, 'postcard.png'), png),
      writeFile(path.join(tempDir, 'postcard.jpg'), jpg),
      writeFile(path.join(tempDir, 'thumbnail.jpg'), thumbnail),
      writeFile(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8'),
    ])
    await rename(tempDir, dir)
    db.prepare(`
      INSERT INTO postcards
      (id, created_at, received_at, terminal_id, trace_id, signature_id, template_id, sender, graduation_year, message, png_path, jpg_path, thumbnail_path, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, String(draft.createdAt || receivedAt), receivedAt, terminal.id, clean(draft.traceId, 100),
      signatureId, String(draft.templateId), sender, clean(draft.graduationYear, 10), clean(draft.message, 300),
      relativePostcardPath(id, 'postcard.png'), relativePostcardPath(id, 'postcard.jpg'), relativePostcardPath(id, 'thumbnail.jpg'),
      JSON.stringify({ photo: draft.photo || null, signatureTransform: draft.signatureTransform || null }),
    )
    const printJob = payload.printJob
    if (printJob?.id) {
      const jobId = safePrintJobId(printJob.id)
      const status = ['queued', 'processing', 'succeeded', 'failed', 'paused', 'cancelled'].includes(printJob.status) ? printJob.status : 'queued'
      db.prepare(`
        INSERT OR IGNORE INTO print_jobs
        (id, postcard_id, terminal_id, printer_name, status, copies, retry_count, error_code, error_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(jobId, id, terminal.id, clean(printJob.printerName, 100), status, Math.max(1, Math.min(10, Number(printJob.copies || 1))), Number(printJob.attempts || 0), clean(printJob.errorCode, 50), clean(printJob.error, 300), printJob.createdAt || receivedAt, receivedAt)
    }
    db.prepare('UPDATE terminals SET status = ?, last_seen_at = ?, updated_at = ?, ip_address = ? WHERE id = ?')
      .run('online', receivedAt, receivedAt, clientIp(req), terminal.id)
    audit({ username: `terminal:${terminal.id}`, action: 'postcard.ingest', entityType: 'postcard', entityId: id, detail: { templateId: draft.templateId, signatureId }, ip: clientIp(req) })
    return json(res, 201, { ok: true, duplicate: false, id, receivedAt })
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

function publicPostcard(row) {
  return {
    id: row.id, createdAt: row.created_at, receivedAt: row.received_at, terminalId: row.terminal_id,
    traceId: row.trace_id, signatureId: row.signature_id, templateId: row.template_id, sender: row.sender,
    graduationYear: row.graduation_year, message: row.message, status: row.status,
    archivedAt: row.archived_at, deletedAt: row.deleted_at,
    previewUrl: `/api/postcards/${encodeURIComponent(row.id)}/file/thumbnail`,
    imageUrl: `/api/postcards/${encodeURIComponent(row.id)}/file/png`,
    pickupUrl: `${postcardPublicBaseUrl}/api/public/postcards/${encodeURIComponent(row.id)}`,
  }
}

function publicPrintJob(row) {
  return {
    id: row.id, postcardId: row.postcard_id, terminalId: row.terminal_id, printerName: row.printer_name,
    status: row.status, copies: row.copies, retryCount: row.retry_count, errorCode: row.error_code,
    errorMessage: row.error_message, createdAt: row.created_at, updatedAt: row.updated_at,
    previewUrl: `/api/postcards/${encodeURIComponent(row.postcard_id)}/file/thumbnail`,
  }
}

function publicPostcardTemplate(row) {
  return {
    id: row.id, group: row.group_name, name: row.name, year: row.year_label, title: row.title, subtitle: row.subtitle,
    background: row.background, ink: row.ink, accent: row.accent, muted: row.muted, motif: row.motif,
    enabled: Boolean(row.enabled), order: row.sort_order, custom: JSON.parse(row.custom_json || '{}'), updatedAt: row.updated_at,
  }
}

function publicSignature(row) {
  return {
    id: row.id, createdAt: row.created_at, receivedAt: row.received_at, terminalId: row.terminal_id, traceId: row.trace_id,
    displayName: row.display_name, userNo: row.user_no, identityType: row.identity_type, className: row.class_name, templateId: row.template_id,
    durationMs: row.duration_ms, strokeCount: row.stroke_count, pointCount: row.point_count, pathLength: row.path_length,
    status: row.status, syncState: row.sync_state, archivedAt: row.archived_at, deletedAt: row.deleted_at,
    reviewStatus: row.review_status, reviewedAt: row.reviewed_at, reviewedBy: row.reviewed_by, reviewNote: row.review_note,
    wallVisible: Boolean(row.wall_visible), wallPublishedAt: row.wall_published_at,
    thumbnailUrl: `/api/signatures/${encodeURIComponent(row.id)}/file/thumbnail`,
    previewUrl: `/api/signatures/${encodeURIComponent(row.id)}/file/display`,
    hasJpg: Boolean(row.jpg_path),
  }
}

function signatureWhere(url) {
  const conditions = ["status != 'deleted'"]
  const params = []
  const status = url.searchParams.get('status')
  if (status === 'deleted') conditions[0] = "status = 'deleted'"
  else if (status && ['active', 'archived'].includes(status)) { conditions.push('status = ?'); params.push(status) }
  const terminal = url.searchParams.get('terminal')
  if (terminal) { conditions.push('terminal_id = ?'); params.push(terminal) }
  const keyword = url.searchParams.get('keyword')?.trim()
  if (keyword) {
    conditions.push('(id LIKE ? OR display_name LIKE ? OR user_no LIKE ? OR class_name LIKE ?)')
    const like = `%${keyword.slice(0, 80)}%`
    params.push(like, like, like, like)
  }
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from) { conditions.push('created_at >= ?'); params.push(new Date(`${from}T00:00:00+08:00`).toISOString()) }
  if (to) { conditions.push('created_at <= ?'); params.push(new Date(`${to}T23:59:59+08:00`).toISOString()) }
  const review = url.searchParams.get('review')
  if (review === 'pending') conditions.push("review_status = 'pending'")
  else if (review === 'published') conditions.push("review_status = 'approved' AND wall_visible = 1")
  else if (review === 'hidden') conditions.push("review_status = 'approved' AND wall_visible = 0")
  else if (review === 'rejected') conditions.push("review_status = 'rejected'")
  return { sql: conditions.join(' AND '), params }
}

const identityLabels = {
  anonymous: '匿名参与', student: '在校学生', teacher: '教师职工', alumni: '校友', visitor: '来访嘉宾',
}

function reviewCounts() {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status != 'deleted' AND review_status = 'pending' THEN 1 ELSE 0 END) pending,
      SUM(CASE WHEN status != 'deleted' AND review_status = 'approved' AND wall_visible = 1 THEN 1 ELSE 0 END) published,
      SUM(CASE WHEN status != 'deleted' AND review_status = 'approved' AND wall_visible = 0 THEN 1 ELSE 0 END) hidden,
      SUM(CASE WHEN status != 'deleted' AND review_status = 'rejected' THEN 1 ELSE 0 END) rejected
    FROM signatures
  `).get()
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value || 0)]))
}

function wallItem(row) {
  const anonymous = row.identity_type === 'anonymous' || !row.display_name
  return {
    id: row.id,
    imageUrl: `/api/wall/signatures/${encodeURIComponent(row.id)}/display`,
    displayName: anonymous ? '匿名参与' : row.display_name,
    identity: anonymous ? 'anonymous' : row.identity_type || 'visitor',
    identityLabel: anonymous ? '匿名参与' : (identityLabels[row.identity_type] || '来访嘉宾'),
    createdAt: row.created_at,
    publishedAt: row.wall_published_at,
  }
}

function chinaDayStartIso(offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
  const base = new Date(Date.now() + offsetDays * 86400000)
  return new Date(`${formatter.format(base)}T00:00:00+08:00`).toISOString()
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function sendBuffer(res, status, buffer, contentType, filename, extra = {}) {
  const headers = { 'Content-Type': contentType, 'Content-Length': buffer.length, ...extra }
  if (filename) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  res.writeHead(status, headers)
  res.end(buffer)
}

async function purgeExpiredDeleted(olderThanDays, actor = null, req = null) {
  const days = Math.max(1, Number(olderThanDays || getSettings().retention_days || 365))
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const rows = db.prepare("SELECT id FROM signatures WHERE status = 'deleted' AND deleted_at < ?").all(cutoff)
  for (const row of rows) {
    await rm(path.join(signatureDir, row.id), { recursive: true, force: true })
    db.prepare('DELETE FROM signatures WHERE id = ?').run(row.id)
  }
  if (rows.length) {
    if (actor && req) logAction(req, actor, 'signature.purge', 'signature', null, { count: rows.length, olderThanDays: days })
    else audit({ username: 'system', action: 'signature.auto_purge', entityType: 'signature', detail: { count: rows.length, olderThanDays: days } })
  }
  return rows.length
}

async function purgeExpiredPostcardArtifacts() {
  const days = Math.max(1, Math.min(30, Number(getSettings().postcard_result_retention_days || 14)))
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const rows = db.prepare("SELECT id FROM postcards WHERE status != 'deleted' AND created_at < ?").all(cutoff)
  if (!rows.length) return 0
  const deletedAt = nowIso()
  for (const row of rows) {
    await rm(path.join(postcardDir, row.id), { recursive: true, force: true })
    db.prepare("UPDATE postcards SET status = 'deleted', deleted_at = ? WHERE id = ?").run(deletedAt, row.id)
    db.prepare("UPDATE print_jobs SET status = 'cancelled', updated_at = ?, error_message = COALESCE(error_message, '明信片成品已到期清理') WHERE postcard_id = ? AND status IN ('queued', 'paused', 'failed')")
      .run(deletedAt, row.id)
  }
  audit({ username: 'system', action: 'postcard.retention_purge', entityType: 'postcard', detail: { count: rows.length, retentionDays: days } })
  return rows.length
}

async function serveSignatureFile(res, row, kind, download = false) {
  const mapping = {
    raw: [row.raw_path, 'application/json; charset=utf-8', 'json'], svg: [row.svg_path, 'image/svg+xml', 'svg'],
    display: [row.display_path, 'image/png', 'png'], print: [row.print_path, 'image/png', 'png'], thumbnail: [row.thumbnail_path, 'image/png', 'png'],
    jpg: [row.jpg_path, 'image/jpeg', 'jpg'],
  }
  const config = mapping[kind]
  if (!config || !config[0]) return fail(res, 404, 'FILE_NOT_FOUND', '该格式文件不存在')
  const buffer = await readFile(absoluteDataPath(config[0]))
  sendBuffer(res, 200, buffer, config[1], download ? `${row.id}.${config[2]}` : null, { 'Cache-Control': 'private, max-age=60' })
}

function performReview(req, user, ids, action, note) {
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM signatures WHERE id IN (${placeholders})`).all(...ids)
  if (!rows.length) throw Object.assign(new Error('未找到可处理的签名'), { status: 404 })
  if (action === 'reject' && !note) throw Object.assign(new Error('驳回签名时必须填写原因'), { status: 400 })

  const now = nowIso()
  const transitions = []
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const row of rows) {
      if (row.status === 'deleted') continue
      const previous = { reviewStatus: row.review_status, wallVisible: Boolean(row.wall_visible) }
      if (action === 'approve') {
        db.prepare(`UPDATE signatures SET review_status = 'approved', reviewed_at = ?, reviewed_by = ?, review_note = ?, wall_visible = 1, wall_published_at = ? WHERE id = ?`)
          .run(now, user.username, note || null, now, row.id)
      } else if (action === 'reject') {
        db.prepare(`UPDATE signatures SET review_status = 'rejected', reviewed_at = ?, reviewed_by = ?, review_note = ?, wall_visible = 0 WHERE id = ?`)
          .run(now, user.username, note, row.id)
      } else if (action === 'hide') {
        if (row.review_status !== 'approved' || !row.wall_visible) continue
        db.prepare(`UPDATE signatures SET reviewed_at = ?, reviewed_by = ?, review_note = ?, wall_visible = 0 WHERE id = ?`)
          .run(now, user.username, note || null, row.id)
      } else if (action === 'publish') {
        if (row.review_status !== 'approved' || row.wall_visible) continue
        db.prepare(`UPDATE signatures SET reviewed_at = ?, reviewed_by = ?, review_note = ?, wall_visible = 1, wall_published_at = ? WHERE id = ?`)
          .run(now, user.username, note || null, now, row.id)
      }
      const updated = db.prepare('SELECT review_status, wall_visible FROM signatures WHERE id = ?').get(row.id)
      const next = { reviewStatus: updated.review_status, wallVisible: Boolean(updated.wall_visible) }
      if (previous.reviewStatus !== next.reviewStatus || previous.wallVisible !== next.wallVisible) transitions.push({ id: row.id, previous, next })
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  logAction(req, user, `signature.review_${action}`, 'signature', ids.length === 1 ? ids[0] : null, { ids, note: note || null, transitions })
  return transitions
}

async function handleApi(req, res, url) {
  const method = req.method || 'GET'

  if (url.pathname.startsWith('/api/v1/') || url.pathname.startsWith('/api/wall')) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Terminal-Id, X-Terminal-Key, X-Trace-Id')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, OPTIONS')
    if (method === 'OPTIONS') return res.writeHead(204).end()
  }

  if (method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'adminsystem', time: nowIso(), database: 'sqlite' })
  }

  if (method === 'GET' && url.pathname === '/api/wall') {
    const settings = getSettings()
    const limit = Math.min(240, Math.max(24, Number(url.searchParams.get('limit') || 240)))
    const rows = db.prepare(`
      SELECT id, display_name, identity_type, created_at, wall_published_at
      FROM signatures
      WHERE review_status = 'approved' AND wall_visible = 1 AND status != 'deleted'
      ORDER BY wall_published_at DESC, created_at DESC LIMIT ?
    `).all(limit)
    return json(res, 200, {
      title: String(settings.wall_title || '一笔一画，汇成三中记忆'),
      schoolName: String(settings.school_name || '淳安第三中学'),
      layout: settings.wall_layout === 'float' ? 'float' : 'brick',
      refreshSeconds: Math.min(60, Math.max(3, Number(settings.wall_refresh_seconds || 5))),
      rotationSeconds: Math.min(120, Math.max(10, Number(settings.wall_rotation_seconds || 20))),
      generatedAt: nowIso(),
      items: rows.map(wallItem),
    }, { 'Cache-Control': 'no-store' })
  }

  const wallImageMatch = url.pathname.match(/^\/api\/wall\/signatures\/([^/]+)\/display$/)
  if (wallImageMatch && method === 'GET') {
    const id = safeSignatureId(decodeURIComponent(wallImageMatch[1]))
    const row = db.prepare("SELECT * FROM signatures WHERE id = ? AND review_status = 'approved' AND wall_visible = 1 AND status != 'deleted'").get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '签名当前未公开展示')
    const buffer = await readFile(absoluteDataPath(row.display_path))
    return sendBuffer(res, 200, buffer, 'image/png', null, { 'Cache-Control': 'public, max-age=300' })
  }

  const publicPostcardMatch = url.pathname.match(/^\/api\/public\/postcards\/([^/]+)(?:\/(png|jpg))?$/)
  if (publicPostcardMatch && method === 'GET') {
    const id = safePostcardId(decodeURIComponent(publicPostcardMatch[1]))
    const row = db.prepare("SELECT * FROM postcards WHERE id = ? AND status != 'deleted'").get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '明信片不存在或已失效')
    const format = publicPostcardMatch[2]
    if (format) {
      const filePath = format === 'png' ? row.png_path : row.jpg_path
      const contentType = format === 'png' ? 'image/png' : 'image/jpeg'
      const buffer = await readFile(absoluteDataPath(filePath))
      return sendBuffer(res, 200, buffer, contentType, `${id}.${format}`, { 'Cache-Control': 'private, max-age=300' })
    }
    const imageUrl = `/api/public/postcards/${encodeURIComponent(id)}/png`
    const jpgUrl = `/api/public/postcards/${encodeURIComponent(id)}/jpg`
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>领取校友明信片</title><style>body{margin:0;background:#f6f3ec;color:#30312d;font-family:system-ui,"PingFang SC",sans-serif;text-align:center}.card{max-width:820px;margin:5vh auto;padding:24px}h1{font-family:serif;font-weight:500;letter-spacing:.08em}img{display:block;width:100%;border:1px solid #ddd6ca;box-shadow:0 16px 45px #493a261c}.actions{margin-top:22px}.btn{display:inline-block;margin:5px;padding:13px 22px;border-radius:8px;background:#9f2925;color:white;text-decoration:none}.secondary{background:#657368}p{color:#77746b;line-height:1.7}</style></head><body><main class="card"><p>淳安第三中学 · 校友明信片</p><h1>这份校园记忆，已为你珍藏</h1><img src="${imageUrl}" alt="校友明信片"><div class="actions"><a class="btn" href="${imageUrl}">下载 PNG</a><a class="btn secondary" href="${jpgUrl}">下载 JPG</a></div><p>成品编号：${id}</p></main></body></html>`
    const data = Buffer.from(html)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': data.length, 'Cache-Control': 'no-store' })
    return res.end(data)
  }

  if (method === 'POST' && url.pathname === '/api/auth/login') {
    const ip = clientIp(req)
    const attempt = loginAttempts.get(ip) || { count: 0, resetAt: 0 }
    if (attempt.resetAt > Date.now() && attempt.count >= 5) return fail(res, 429, 'TOO_MANY_ATTEMPTS', '登录失败次数过多，请稍后再试')
    const body = await parseJson(req, 1024 * 16)
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(body.username || '').trim())
    if (!user || user.status !== 'active' || !verifyPassword(String(body.password || ''), user.password_salt, user.password_hash)) {
      loginAttempts.set(ip, { count: attempt.resetAt > Date.now() ? attempt.count + 1 : 1, resetAt: Date.now() + 15 * 60000 })
      audit({ username: String(body.username || 'unknown'), action: 'auth.login_failed', entityType: 'session', detail: {}, ip })
      return fail(res, 401, 'INVALID_CREDENTIALS', '账号或密码不正确')
    }
    loginAttempts.delete(ip)
    const token = randomBytes(32).toString('base64url')
    const createdAt = nowIso()
    const expiresAt = new Date(Date.now() + sessionHours * 3600000).toISOString()
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(hashText(token), user.id, createdAt, createdAt, expiresAt)
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(createdAt, createdAt, user.id)
    setSessionCookie(res, token)
    audit({ userId: user.id, username: user.username, action: 'auth.login', entityType: 'session', detail: {}, ip })
    return json(res, 200, { user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role }, expiresAt })
  }

  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = parseCookies(req).sid
    const user = currentUser(req)
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashText(token))
    if (user) logAction(req, user, 'auth.logout', 'session', null)
    clearSessionCookie(res)
    return json(res, 200, { ok: true })
  }

  if (method === 'GET' && url.pathname === '/api/auth/me') {
    const user = requireUser(req, res)
    if (!user) return
    return json(res, 200, { user })
  }

  if (method === 'GET' && url.pathname === '/api/v1/postcard/config') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    if (terminal.id !== 'Z3-25') return fail(res, 403, 'FORBIDDEN', '当前终端未开通明信片配置权限')
    const settings = getSettings()
    const templates = db.prepare('SELECT * FROM postcard_templates WHERE enabled = 1 ORDER BY sort_order, created_at').all().map(publicPostcardTemplate)
    return json(res, 200, {
      templates,
      settings: {
        sessionTimeoutSeconds: Number(settings.postcard_session_timeout_seconds || 180),
        resultRetentionDays: Number(settings.postcard_result_retention_days || 14),
        originalRetentionHours: Number(settings.postcard_original_retention_hours || 24),
        maxPrintCopies: Number(settings.postcard_max_print_copies || 2),
        minPrintIntervalSeconds: Number(settings.postcard_min_print_interval_seconds || 15),
      },
    }, { 'Cache-Control': 'no-store' })
  }

  if (method === 'GET' && url.pathname === '/api/v1/postcard/signatures') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    if (terminal.id !== 'Z3-25') return fail(res, 403, 'FORBIDDEN', '当前终端未开通明信片签名检索权限')
    const keyword = String(url.searchParams.get('keyword') || '').trim().slice(0, 80)
    if (!keyword) return json(res, 200, { items: [] }, { 'Cache-Control': 'no-store' })
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit') || 18)))
    const like = `%${keyword}%`
    const rows = db.prepare(`
      SELECT id, display_name, identity_type, class_name, created_at
      FROM signatures
      WHERE status != 'deleted' AND (id LIKE ? OR display_name LIKE ? OR user_no LIKE ? OR class_name LIKE ?)
      ORDER BY created_at DESC LIMIT ?
    `).all(like, like, like, like, limit)
    db.prepare('UPDATE terminals SET status = ?, last_seen_at = ?, updated_at = ?, ip_address = ? WHERE id = ?')
      .run('online', nowIso(), nowIso(), clientIp(req), terminal.id)
    return json(res, 200, {
      items: rows.map((row) => {
        const anonymous = row.identity_type === 'anonymous' || !row.display_name
        return {
          id: row.id,
          displayName: anonymous ? '匿名参与' : row.display_name,
          identityType: anonymous ? 'anonymous' : (row.identity_type || 'visitor'),
          identityLabel: anonymous ? '匿名参与' : (identityLabels[row.identity_type] || '来访嘉宾'),
          className: anonymous ? null : row.class_name,
          createdAt: row.created_at,
          imageUrl: `/api/v1/postcard/signatures/${encodeURIComponent(row.id)}/display`,
        }
      }),
    }, { 'Cache-Control': 'no-store' })
  }

  const postcardSignatureImageMatch = url.pathname.match(/^\/api\/v1\/postcard\/signatures\/([^/]+)\/display$/)
  if (postcardSignatureImageMatch && method === 'GET') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    if (terminal.id !== 'Z3-25') return fail(res, 403, 'FORBIDDEN', '当前终端未开通明信片签名读取权限')
    const id = safeSignatureId(decodeURIComponent(postcardSignatureImageMatch[1]))
    const row = db.prepare("SELECT * FROM signatures WHERE id = ? AND status != 'deleted'").get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '签名不存在或已进入回收记录')
    const buffer = await readFile(absoluteDataPath(row.display_path))
    return sendBuffer(res, 200, buffer, 'image/png', null, { 'Cache-Control': 'private, max-age=60' })
  }

  if (method === 'POST' && url.pathname === '/api/v1/postcards') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    return ingestPostcard(req, res, terminal)
  }

  if (method === 'GET' && url.pathname === '/api/v1/postcard/print-jobs/pending') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    if (terminal.id !== 'Z3-25') return fail(res, 403, 'FORBIDDEN', '当前终端未开通后台推送打印权限')
    const items = db.prepare(`
      SELECT j.*, p.template_id
      FROM print_jobs j JOIN postcards p ON p.id = j.postcard_id
      WHERE j.terminal_id = ? AND j.status = 'created' AND p.status != 'deleted'
      ORDER BY j.created_at LIMIT 20
    `).all(terminal.id).map((row) => ({
      id: row.id,
      postcardId: row.postcard_id,
      templateId: row.template_id,
      copies: Number(row.copies),
      createdAt: row.created_at,
      imageUrl: `/api/v1/postcard/print-jobs/${encodeURIComponent(row.id)}/image`,
    }))
    return json(res, 200, { items }, { 'Cache-Control': 'no-store' })
  }

  const terminalPrintImageMatch = url.pathname.match(/^\/api\/v1\/postcard\/print-jobs\/([^/]+)\/image$/)
  if (terminalPrintImageMatch && method === 'GET') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    const id = safePrintJobId(decodeURIComponent(terminalPrintImageMatch[1]))
    const row = db.prepare(`
      SELECT j.id, p.png_path
      FROM print_jobs j JOIN postcards p ON p.id = j.postcard_id
      WHERE j.id = ? AND j.terminal_id = ? AND p.status != 'deleted'
    `).get(id, terminal.id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '推送打印任务或成品不存在')
    const buffer = await readFile(absoluteDataPath(row.png_path))
    return sendBuffer(res, 200, buffer, 'image/png', null, { 'Cache-Control': 'private, max-age=60' })
  }

  const terminalPrintJobMatch = url.pathname.match(/^\/api\/v1\/postcard\/print-jobs\/([^/]+)$/)
  if (terminalPrintJobMatch && method === 'PATCH') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    if (terminal.id !== 'Z3-25') return fail(res, 403, 'FORBIDDEN', '当前终端未开通打印状态上报权限')
    const id = safePrintJobId(decodeURIComponent(terminalPrintJobMatch[1]))
    // Current terminals send only compact status metadata. Keep a bounded 2 MiB limit
    // so older deployed terminals that still include their local preview thumbnail can
    // report status until they are upgraded.
    const body = await parseJson(req, 2 * 1024 * 1024)
    const status = String(body.status || '')
    if (!['queued', 'processing', 'succeeded', 'failed', 'paused', 'cancelled'].includes(status)) return fail(res, 400, 'INVALID_PRINT_STATUS', '打印状态无效')
    const result = db.prepare(`
      UPDATE print_jobs SET status = ?, printer_name = COALESCE(?, printer_name), retry_count = ?, error_code = ?, error_message = ?, updated_at = ?
      WHERE id = ? AND terminal_id = ?
    `).run(status, String(body.printerName || '').slice(0, 100) || null, Math.max(0, Number(body.attempts || 0)), String(body.errorCode || '').slice(0, 50) || null, String(body.error || '').slice(0, 300) || null, nowIso(), id, terminal.id)
    // Older terminals may report "queued" a moment before the postcard ingest
    // transaction creates its print_jobs row. Accept that transient update without
    // producing a noisy 404; the ingest payload carries the same initial job state.
    if (!result.changes) return json(res, 202, { ok: false, pending: true })
    return json(res, 200, { ok: true })
  }

  if (method === 'POST' && url.pathname === '/api/v1/signatures') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    return ingestSignature(req, res, terminal)
  }

  if (method === 'POST' && url.pathname === '/api/v1/terminals/heartbeat') {
    const terminal = terminalAuth(req, res)
    if (!terminal) return
    const body = await parseJson(req, 1024 * 32)
    const now = nowIso()
    db.prepare(`UPDATE terminals SET status = 'online', last_seen_at = ?, app_version = ?, queue_count = ?, ip_address = ?, updated_at = ? WHERE id = ?`)
      .run(now, String(body.appVersion || '').slice(0, 40), Math.max(0, Number(body.queueCount || 0)), clientIp(req), now, terminal.id)
    return json(res, 200, { ok: true, serverTime: now })
  }

  if (method === 'GET' && url.pathname === '/api/dashboard') {
    const user = requireUser(req, res)
    if (!user) return
    const today = chinaDayStartIso()
    const week = chinaDayStartIso(-6)
    const counts = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN created_at >= ? AND status != 'deleted' THEN 1 ELSE 0 END) today,
        SUM(CASE WHEN created_at >= ? AND status != 'deleted' THEN 1 ELSE 0 END) week,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) archived
      FROM signatures
    `).get(today, week)
    const series = db.prepare(`
      SELECT substr(created_at, 1, 13) || ':00:00.000Z' hour, COUNT(*) count
      FROM signatures WHERE created_at >= datetime('now', '-23 hours') AND status != 'deleted'
      GROUP BY substr(created_at, 1, 13) ORDER BY hour
    `).all()
    const recent = db.prepare("SELECT * FROM signatures WHERE status != 'deleted' ORDER BY created_at DESC LIMIT 6").all().map(publicSignature)
    const settings = getSettings()
    const onlineCutoff = new Date(Date.now() - Number(settings.online_threshold_seconds || 120) * 1000).toISOString()
    const terminalCounts = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) online FROM terminals`).get(onlineCutoff)
    const reviews = reviewCounts()
    const postcardCounts = db.prepare(`
      SELECT
        SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END) total,
        SUM(CASE WHEN status != 'deleted' AND created_at >= ? THEN 1 ELSE 0 END) today
      FROM postcards
    `).get(today)
    const printCounts = db.prepare(`
      SELECT
        SUM(CASE WHEN status IN ('created','queued','paused') THEN 1 ELSE 0 END) waiting,
        SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) succeeded,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) failed
      FROM print_jobs
    `).get()
    return json(res, 200, {
      counts: { total: Number(counts.total || 0), today: Number(counts.today || 0), week: Number(counts.week || 0), archived: Number(counts.archived || 0), pendingReview: reviews.pending, onWall: reviews.published },
      postcards: { total: Number(postcardCounts.total || 0), today: Number(postcardCounts.today || 0) },
      printJobs: { waiting: Number(printCounts.waiting || 0), succeeded: Number(printCounts.succeeded || 0), failed: Number(printCounts.failed || 0) },
      series, terminals: { total: Number(terminalCounts.total || 0), online: Number(terminalCounts.online || 0) }, recent,
    })
  }

  if (method === 'GET' && url.pathname === '/api/signatures') {
    const user = requireUser(req, res)
    if (!user) return
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 20)))
    const where = signatureWhere(url)
    const total = Number(db.prepare(`SELECT COUNT(*) count FROM signatures WHERE ${where.sql}`).get(...where.params).count)
    const rows = db.prepare(`SELECT * FROM signatures WHERE ${where.sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...where.params, pageSize, (page - 1) * pageSize).map(publicSignature)
    const statusCounts = db.prepare(`SELECT status, COUNT(*) count FROM signatures GROUP BY status`).all()
    return json(res, 200, { items: rows, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) }, statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, Number(row.count)])) })
  }

  if (method === 'GET' && url.pathname === '/api/reviews') {
    const user = requireUser(req, res)
    if (!user) return
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(12, Number(url.searchParams.get('pageSize') || 24)))
    const where = signatureWhere(url)
    const total = Number(db.prepare(`SELECT COUNT(*) count FROM signatures WHERE ${where.sql}`).get(...where.params).count)
    const items = db.prepare(`SELECT * FROM signatures WHERE ${where.sql} ORDER BY COALESCE(wall_published_at, created_at) DESC LIMIT ? OFFSET ?`)
      .all(...where.params, pageSize, (page - 1) * pageSize).map(publicSignature)
    return json(res, 200, { items, counts: reviewCounts(), pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } })
  }

  if (method === 'GET' && url.pathname === '/api/postcards') {
    const user = requireUser(req, res)
    if (!user) return
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(12, Number(url.searchParams.get('pageSize') || 24)))
    const keyword = String(url.searchParams.get('keyword') || '').trim().slice(0, 80)
    const status = String(url.searchParams.get('status') || '')
    const conditions = [status === 'deleted' ? "p.status = 'deleted'" : "p.status != 'deleted'"]
    const params = []
    if (['active', 'archived'].includes(status)) { conditions.push('p.status = ?'); params.push(status) }
    if (keyword) {
      const like = `%${keyword}%`
      conditions.push('(p.id LIKE ? OR p.sender LIKE ? OR p.signature_id LIKE ? OR p.message LIKE ?)')
      params.push(like, like, like, like)
    }
    const where = conditions.join(' AND ')
    const total = Number(db.prepare(`SELECT COUNT(*) count FROM postcards p WHERE ${where}`).get(...params).count)
    const rows = db.prepare(`
      SELECT p.*, t.name template_name
      FROM postcards p LEFT JOIN postcard_templates t ON t.id = p.template_id
      WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize)
    return json(res, 200, { items: rows.map((row) => ({ ...publicPostcard(row), templateName: row.template_name })), pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } })
  }

  if (method === 'GET' && url.pathname === '/api/postcard-stats') {
    const user = requireUser(req, res)
    if (!user) return
    const today = chinaDayStartIso()
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END) total,
        SUM(CASE WHEN status != 'deleted' AND created_at >= ? THEN 1 ELSE 0 END) today,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) archived
      FROM postcards
    `).get(today)
    const popularTemplates = db.prepare(`
      SELECT t.id, t.name, COUNT(p.id) count
      FROM postcard_templates t LEFT JOIN postcards p ON p.template_id = t.id AND p.status != 'deleted'
      GROUP BY t.id, t.name ORDER BY count DESC, t.sort_order LIMIT 5
    `).all().map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }))
    const hourly = db.prepare(`
      SELECT substr(created_at, 11, 2) hour, COUNT(*) count
      FROM postcards WHERE status != 'deleted' GROUP BY substr(created_at, 11, 2) ORDER BY hour
    `).all().map((row) => ({ hour: row.hour, count: Number(row.count) }))
    return json(res, 200, {
      counts: { total: Number(counts.total || 0), today: Number(counts.today || 0), archived: Number(counts.archived || 0) },
      popularTemplates,
      hourly,
    })
  }

  if (method === 'POST' && url.pathname === '/api/postcards/batch') {
    const user = requireUser(req, res, ['admin', 'operator'])
    if (!user) return
    const body = await parseJson(req, 1024 * 128)
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids.map(safePostcardId).slice(0, 500) : [])]
    const action = String(body.action || '')
    if (!ids.length || !['archive', 'restore', 'delete'].includes(action)) return fail(res, 400, 'INVALID_BATCH', '明信片批量操作参数无效')
    const placeholders = ids.map(() => '?').join(',')
    const now = nowIso()
    const sql = action === 'archive'
      ? `UPDATE postcards SET status = 'archived', archived_at = ?, deleted_at = NULL WHERE id IN (${placeholders}) AND status != 'deleted'`
      : action === 'restore'
        ? `UPDATE postcards SET status = 'active', archived_at = NULL, deleted_at = NULL WHERE id IN (${placeholders})`
        : `UPDATE postcards SET status = 'deleted', deleted_at = ? WHERE id IN (${placeholders})`
    const result = action === 'restore' ? db.prepare(sql).run(...ids) : db.prepare(sql).run(now, ...ids)
    logAction(req, user, `postcard.batch_${action}`, 'postcard', null, { ids, affected: Number(result.changes) })
    return json(res, 200, { ok: true, affected: Number(result.changes) })
  }

  const postcardPrintPushMatch = url.pathname.match(/^\/api\/postcards\/([^/]+)\/print$/)
  if (postcardPrintPushMatch && method === 'POST') {
    const user = requireUser(req, res, ['admin', 'operator'])
    if (!user) return
    const postcardId = safePostcardId(decodeURIComponent(postcardPrintPushMatch[1]))
    const postcard = db.prepare("SELECT * FROM postcards WHERE id = ? AND status != 'deleted'").get(postcardId)
    if (!postcard) return fail(res, 404, 'NOT_FOUND', '明信片不存在或已进入回收记录')
    const body = await parseJson(req, 1024 * 16)
    const copies = Math.max(1, Math.min(10, Number(body.copies || 1)))
    const terminalId = String(body.terminalId || postcard.terminal_id || 'Z3-25').slice(0, 50)
    if (terminalId !== 'Z3-25' || !db.prepare('SELECT 1 FROM terminals WHERE id = ?').get(terminalId)) {
      return fail(res, 400, 'INVALID_TERMINAL', '当前仅支持推送到明信片终端 Z3-25')
    }
    const id = `PRINT-PUSH-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
    const now = nowIso()
    db.prepare(`
      INSERT INTO print_jobs
      (id, postcard_id, terminal_id, printer_name, status, copies, retry_count, error_code, error_message, created_at, updated_at)
      VALUES (?, ?, ?, NULL, 'created', ?, 0, NULL, NULL, ?, ?)
    `).run(id, postcardId, terminalId, copies, now, now)
    logAction(req, user, 'print_job.push', 'print_job', id, { postcardId, terminalId, copies })
    return json(res, 201, { ok: true, item: publicPrintJob(db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id)) })
  }

  const postcardFileMatch = url.pathname.match(/^\/api\/postcards\/([^/]+)\/file\/(png|jpg|thumbnail)$/)
  if (postcardFileMatch && method === 'GET') {
    const user = requireUser(req, res)
    if (!user) return
    const id = safePostcardId(decodeURIComponent(postcardFileMatch[1]))
    const row = db.prepare('SELECT * FROM postcards WHERE id = ?').get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '未找到该明信片')
    const mapping = postcardFileMatch[2] === 'png' ? [row.png_path, 'image/png'] : postcardFileMatch[2] === 'jpg' ? [row.jpg_path, 'image/jpeg'] : [row.thumbnail_path, 'image/jpeg']
    const buffer = await readFile(absoluteDataPath(mapping[0]))
    const extension = postcardFileMatch[2] === 'thumbnail' ? 'jpg' : postcardFileMatch[2]
    const filename = url.searchParams.get('download') === '1' ? `${id}.${extension}` : null
    return sendBuffer(res, 200, buffer, mapping[1], filename, { 'Cache-Control': 'private, max-age=60' })
  }

  if (method === 'GET' && url.pathname === '/api/print-jobs') {
    const user = requireUser(req, res)
    if (!user) return
    const status = String(url.searchParams.get('status') || '')
    const where = status && ['created', 'queued', 'processing', 'succeeded', 'failed', 'paused', 'cancelled', 'archived'].includes(status) ? 'WHERE status = ?' : ''
    const params = where ? [status] : []
    const items = db.prepare(`SELECT * FROM print_jobs ${where} ORDER BY created_at DESC LIMIT 500`).all(...params).map(publicPrintJob)
    const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) count FROM print_jobs GROUP BY status').all().map((row) => [row.status, Number(row.count)]))
    return json(res, 200, { items, counts })
  }

  const printJobActionMatch = url.pathname.match(/^\/api\/print-jobs\/([^/]+)\/action$/)
  if (printJobActionMatch && method === 'POST') {
    const user = requireUser(req, res, ['admin', 'operator'])
    if (!user) return
    const id = safePrintJobId(decodeURIComponent(printJobActionMatch[1]))
    const row = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '打印任务不存在')
    const body = await parseJson(req, 1024 * 16)
    const action = String(body.action || '')
    const transitions = {
      pause: ['queued', 'paused'], resume: ['paused', 'created'], retry: ['failed', 'created'], cancel: [row.status, 'cancelled'], archive: ['succeeded', 'archived'],
    }
    const transition = transitions[action]
    if (!transition || row.status !== transition[0] || (action === 'cancel' && !['created', 'queued', 'paused', 'failed'].includes(row.status))) {
      return fail(res, 409, 'INVALID_TRANSITION', '当前任务状态不允许此操作')
    }
    db.prepare('UPDATE print_jobs SET status = ?, retry_count = retry_count + ?, error_code = NULL, error_message = NULL, updated_at = ? WHERE id = ?')
      .run(transition[1], action === 'retry' ? 1 : 0, nowIso(), id)
    logAction(req, user, `print_job.${action}`, 'print_job', id, { previous: row.status, next: transition[1] })
    return json(res, 200, { ok: true })
  }

  if (method === 'GET' && url.pathname === '/api/postcard-templates') {
    const user = requireUser(req, res)
    if (!user) return
    const items = db.prepare('SELECT * FROM postcard_templates ORDER BY sort_order, created_at').all().map(publicPostcardTemplate)
    return json(res, 200, { items })
  }

  if (method === 'POST' && url.pathname === '/api/postcard-templates') {
    const user = requireUser(req, res, ['admin'])
    if (!user) return
    const body = await parseJson(req, 1024 * 128)
    const id = `tpl-custom-${randomBytes(5).toString('hex')}`
    const now = nowIso()
    const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback
    const motif = ['rings', 'grid', 'mountain', 'window', 'stamp'].includes(body.motif) ? body.motif : 'stamp'
    db.prepare(`
      INSERT INTO postcard_templates
      (id, group_name, name, year_label, title, subtitle, background, ink, accent, muted, motif, enabled, sort_order, custom_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(id, String(body.group || '自定义模板').trim().slice(0, 30), String(body.name || '未命名模板').trim().slice(0, 40), String(body.year || 'MEMORY').trim().slice(0, 20), String(body.title || '三中记忆').trim().slice(0, 40), String(body.subtitle || '一纸寄湖山').trim().slice(0, 80), color(body.background, '#f0e8db'), color(body.ink, '#30312d'), color(body.accent, '#9f2925'), color(body.muted, '#84786b'), motif, Number(body.order || 999), JSON.stringify(body.custom || {}), now, now)
    logAction(req, user, 'postcard_template.create', 'postcard_template', id, { name: body.name })
    return json(res, 201, { ok: true, id })
  }

  const postcardTemplateMatch = url.pathname.match(/^\/api\/postcard-templates\/([^/]+)$/)
  if (postcardTemplateMatch && method === 'PATCH') {
    const user = requireUser(req, res, ['admin'])
    if (!user) return
    const id = String(decodeURIComponent(postcardTemplateMatch[1])).slice(0, 100)
    const row = db.prepare('SELECT * FROM postcard_templates WHERE id = ?').get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '模板不存在')
    const body = await parseJson(req, 1024 * 128)
    const enabled = typeof body.enabled === 'boolean' ? Number(body.enabled) : row.enabled
    const order = Number.isFinite(Number(body.order)) ? Number(body.order) : row.sort_order
    db.prepare('UPDATE postcard_templates SET enabled = ?, sort_order = ?, updated_at = ? WHERE id = ?').run(enabled, order, nowIso(), id)
    logAction(req, user, 'postcard_template.update', 'postcard_template', id, { enabled: Boolean(enabled), order })
    return json(res, 200, { ok: true })
  }

  if (method === 'POST' && url.pathname === '/api/reviews/actions') {
    const user = requireUser(req, res, ['admin', 'operator'])
    if (!user) return
    const body = await parseJson(req, 1024 * 128)
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids.map(safeSignatureId).slice(0, 500) : [])]
    const action = String(body.action || '')
    const note = String(body.note || '').trim().slice(0, 500)
    if (!ids.length || !['approve', 'reject', 'hide', 'publish'].includes(action)) return fail(res, 400, 'INVALID_REVIEW_ACTION', '审核操作参数无效')
    const transitions = performReview(req, user, ids, action, note)
    return json(res, 200, { ok: true, affected: transitions.length, transitions })
  }

  if (method === 'POST' && url.pathname === '/api/signatures/export') {
    const user = requireUser(req, res)
    if (!user) return
    const body = await parseJson(req, 1024 * 128)
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids.map(safeSignatureId).slice(0, 200) : [])]
    const format = ['png', 'jpg', 'svg', 'json'].includes(body.format) ? body.format : 'png'
    if (!ids.length) return fail(res, 400, 'NO_SELECTION', '请至少选择一条签名')
    const placeholders = ids.map(() => '?').join(',')
    const rows = db.prepare(`SELECT * FROM signatures WHERE id IN (${placeholders}) AND status != 'deleted'`).all(...ids)
    const files = []
    for (const row of rows) {
      const mapping = format === 'png' ? [row.display_path, 'png'] : format === 'jpg' ? [row.jpg_path || row.print_path, row.jpg_path ? 'jpg' : 'png'] : format === 'svg' ? [row.svg_path, 'svg'] : [row.raw_path, 'json']
      files.push({ name: `${row.id}.${mapping[1]}`, data: await readFile(absoluteDataPath(mapping[0])) })
    }
    logAction(req, user, 'signature.batch_export', 'signature', null, { ids, format, count: files.length })
    return sendBuffer(res, 200, createZip(files), 'application/zip', `签名批量导出-${new Date().toISOString().slice(0, 10)}.zip`)
  }

  if (method === 'POST' && url.pathname === '/api/signatures/batch') {
    const user = requireUser(req, res, ['admin', 'operator'])
    if (!user) return
    const body = await parseJson(req, 1024 * 128)
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids.map(safeSignatureId).slice(0, 500) : [])]
    const action = String(body.action || '')
    if (!ids.length || !['archive', 'restore', 'delete'].includes(action)) return fail(res, 400, 'INVALID_BATCH', '批量操作参数无效')
    const now = nowIso()
    const placeholders = ids.map(() => '?').join(',')
    const sql = action === 'archive'
      ? `UPDATE signatures SET status = 'archived', archived_at = ?, deleted_at = NULL WHERE id IN (${placeholders}) AND status != 'deleted'`
      : action === 'restore'
        ? `UPDATE signatures SET status = 'active', archived_at = NULL, deleted_at = NULL WHERE id IN (${placeholders})`
        : `UPDATE signatures SET status = 'deleted', deleted_at = ?, wall_visible = 0 WHERE id IN (${placeholders})`
    const result = action === 'restore' ? db.prepare(sql).run(...ids) : db.prepare(sql).run(now, ...ids)
    logAction(req, user, `signature.batch_${action}`, 'signature', null, { ids, affected: Number(result.changes) })
    return json(res, 200, { ok: true, affected: Number(result.changes) })
  }

  if (method === 'GET' && url.pathname === '/api/reports/signatures.csv') {
    const user = requireUser(req, res)
    if (!user) return
    const where = signatureWhere(url)
    const rows = db.prepare(`SELECT * FROM signatures WHERE ${where.sql} ORDER BY created_at DESC LIMIT 10000`).all(...where.params)
    const header = ['签名编号', '采集时间', '接收时间', '终端', '姓名', '用户编号', '身份', '班级', '模板', '笔画数', '采样点数', '状态']
    const lines = [header, ...rows.map((row) => [row.id, row.created_at, row.received_at, row.terminal_id, row.display_name, row.user_no, row.identity_type, row.class_name, row.template_id, row.stroke_count, row.point_count, row.status])]
      .map((cells) => cells.map(csvEscape).join(','))
    logAction(req, user, 'signature.report_export', 'report', null, { count: rows.length })
    return sendBuffer(res, 200, Buffer.from(`\ufeff${lines.join('\r\n')}`, 'utf8'), 'text/csv; charset=utf-8', `签名数据报表-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const signatureMatch = url.pathname.match(/^\/api\/signatures\/([^/]+)$/)
  if (signatureMatch && method === 'GET') {
    const user = requireUser(req, res)
    if (!user) return
    const id = safeSignatureId(decodeURIComponent(signatureMatch[1]))
    const row = db.prepare('SELECT * FROM signatures WHERE id = ?').get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '未找到该签名')
    return json(res, 200, { item: { ...publicSignature(row), metadata: JSON.parse(row.metadata_json || '{}'), files: { json: `/api/signatures/${id}/export?format=json`, svg: `/api/signatures/${id}/export?format=svg`, png: `/api/signatures/${id}/export?format=png`, print: `/api/signatures/${id}/export?format=print`, ...(row.jpg_path ? { jpg: `/api/signatures/${id}/export?format=jpg` } : {}) } } })
  }

  if (signatureMatch && method === 'PATCH') {
    const user = requireUser(req, res, ['admin', 'operator'])
    if (!user) return
    const id = safeSignatureId(decodeURIComponent(signatureMatch[1]))
    const row = db.prepare('SELECT * FROM signatures WHERE id = ?').get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '未找到该签名')
    const body = await parseJson(req, 1024 * 32)
    const identityType = String(body.identityType || '').trim()
    if (!['anonymous', 'student', 'teacher', 'alumni', 'visitor'].includes(identityType)) {
      return fail(res, 400, 'INVALID_IDENTITY_TYPE', '请选择有效的身份类型')
    }
    const clean = (value, max) => String(value || '').trim().slice(0, max) || null
    const displayName = identityType === 'anonymous' ? null : clean(body.displayName, 40)
    const userNo = identityType === 'anonymous' ? null : clean(body.userNo, 40)
    const className = identityType === 'anonymous' ? null : clean(body.className, 60)
    if (identityType !== 'anonymous' && !displayName) return fail(res, 400, 'NAME_REQUIRED', '实名身份必须填写姓名')

    const context = {
      identity_type: identityType,
      template_id: row.template_id || 'exhibition-wall',
      ...(displayName ? { display_name: displayName } : {}),
      ...(userNo ? { user_no: userNo } : {}),
      ...(className ? { class_name: className } : {}),
    }
    const rawPath = absoluteDataPath(row.raw_path)
    const tempPath = `${rawPath}.${randomBytes(4).toString('hex')}.tmp`
    let rawRecord
    try {
      rawRecord = JSON.parse(await readFile(rawPath, 'utf8'))
    } catch {
      return fail(res, 500, 'RAW_RECORD_INVALID', '原始签名记录无法读取，人员信息未修改')
    }
    await writeFile(tempPath, JSON.stringify({ ...rawRecord, context }, null, 2), 'utf8')

    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('UPDATE signatures SET display_name = ?, user_no = ?, identity_type = ?, class_name = ?, template_id = ? WHERE id = ?')
        .run(displayName, userNo, identityType, className, context.template_id, id)
      await rename(tempPath, rawPath)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      await rm(tempPath, { force: true }).catch(() => undefined)
      throw error
    }

    const previous = { displayName: row.display_name, userNo: row.user_no, identityType: row.identity_type, className: row.class_name }
    const next = { displayName, userNo, identityType, className }
    logAction(req, user, 'signature.context_update', 'signature', id, { previous, next })
    const updated = db.prepare('SELECT * FROM signatures WHERE id = ?').get(id)
    return json(res, 200, { ok: true, item: publicSignature(updated) })
  }

  const fileMatch = url.pathname.match(/^\/api\/signatures\/([^/]+)\/(file|export)$/)
  if (fileMatch && method === 'GET') {
    const user = requireUser(req, res)
    if (!user) return
    const id = safeSignatureId(decodeURIComponent(fileMatch[1]))
    const row = db.prepare('SELECT * FROM signatures WHERE id = ?').get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '未找到该签名')
    const kind = fileMatch[2] === 'file' ? String(url.searchParams.get('kind') || 'display') : String(url.searchParams.get('format') || 'png')
    const normalized = kind === 'png' ? 'display' : kind === 'json' ? 'raw' : kind
    if (fileMatch[2] === 'export') logAction(req, user, 'signature.export', 'signature', id, { format: kind })
    return serveSignatureFile(res, row, normalized, fileMatch[2] === 'export')
  }

  const directFileMatch = url.pathname.match(/^\/api\/signatures\/([^/]+)\/file\/(raw|svg|display|print|thumbnail|jpg)$/)
  if (directFileMatch && method === 'GET') {
    const user = requireUser(req, res)
    if (!user) return
    const id = safeSignatureId(decodeURIComponent(directFileMatch[1]))
    const row = db.prepare('SELECT * FROM signatures WHERE id = ?').get(id)
    if (!row) return fail(res, 404, 'NOT_FOUND', '未找到该签名')
    return serveSignatureFile(res, row, directFileMatch[2])
  }

  if (method === 'GET' && url.pathname === '/api/terminals') {
    const user = requireUser(req, res)
    if (!user) return
    const settings = getSettings()
    const cutoff = new Date(Date.now() - Number(settings.online_threshold_seconds || 120) * 1000).toISOString()
    const items = db.prepare('SELECT id, name, location, status, last_seen_at, app_version, queue_count, ip_address, created_at FROM terminals ORDER BY id').all()
      .map((row) => ({ id: row.id, name: row.name, location: row.location, status: row.last_seen_at >= cutoff ? 'online' : 'offline', lastSeenAt: row.last_seen_at, appVersion: row.app_version, queueCount: row.queue_count, ipAddress: row.ip_address, createdAt: row.created_at }))
    return json(res, 200, { items })
  }

  if (method === 'GET' && url.pathname === '/api/audit-logs') {
    const user = requireUser(req, res)
    if (!user) return
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 30)))
    const action = url.searchParams.get('action')?.trim()
    const where = action ? 'WHERE action LIKE ?' : ''
    const params = action ? [`%${action.slice(0, 80)}%`] : []
    const total = Number(db.prepare(`SELECT COUNT(*) count FROM audit_logs ${where}`).get(...params).count)
    const items = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize)
      .map((row) => ({ id: row.id, username: row.username, action: row.action, entityType: row.entity_type, entityId: row.entity_id, detail: JSON.parse(row.detail_json || '{}'), ipAddress: row.ip_address, createdAt: row.created_at }))
    return json(res, 200, { items, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } })
  }

  if (method === 'GET' && url.pathname === '/api/settings') {
    const user = requireUser(req, res)
    if (!user) return
    return json(res, 200, { settings: getSettings() })
  }

  if (method === 'PUT' && url.pathname === '/api/settings') {
    const user = requireUser(req, res, ['admin'])
    if (!user) return
    const body = await parseJson(req, 1024 * 32)
    const allowed = {
      retention_days: [1, 3650], auto_archive_days: [0, 3650], online_threshold_seconds: [30, 3600], school_name: [1, 60],
      wall_layout: ['brick', 'float'], wall_title: [1, 80], wall_refresh_seconds: [3, 60], wall_rotation_seconds: [10, 120],
      postcard_session_timeout_seconds: [60, 900], postcard_result_retention_days: [1, 30],
      postcard_original_retention_hours: [1, 72], postcard_max_print_copies: [1, 10], postcard_min_print_interval_seconds: [5, 120],
    }
    const update = db.prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at')
    const changed = {}
    for (const [key, bounds] of Object.entries(allowed)) {
      if (!(key in body)) continue
      let value
      if (key === 'school_name' || key === 'wall_title') value = String(body[key]).trim().slice(0, bounds[1])
      else if (key === 'wall_layout') value = bounds.includes(body[key]) ? body[key] : 'brick'
      else value = Math.min(bounds[1], Math.max(bounds[0], Number(body[key])))
      update.run(key, JSON.stringify(value), nowIso())
      changed[key] = value
    }
    runMaintenance()
    logAction(req, user, 'settings.update', 'settings', null, changed)
    return json(res, 200, { ok: true, settings: getSettings() })
  }

  if (method === 'POST' && url.pathname === '/api/maintenance/purge') {
    const user = requireUser(req, res, ['admin'])
    if (!user) return
    const body = await parseJson(req, 1024 * 16)
    const days = Math.max(1, Math.min(3650, Number(body.olderThanDays || getSettings().retention_days || 365)))
    const count = await purgeExpiredDeleted(days, user, req)
    return json(res, 200, { ok: true, purged: count, olderThanDays: days })
  }

  if (method === 'GET' && url.pathname === '/api/users') {
    const user = requireUser(req, res, ['admin'])
    if (!user) return
    const items = db.prepare('SELECT id, username, display_name, role, status, created_at, updated_at, last_login_at FROM users ORDER BY created_at').all()
      .map((row) => ({ id: row.id, username: row.username, displayName: row.display_name, role: row.role, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, lastLoginAt: row.last_login_at }))
    return json(res, 200, { items })
  }

  if (method === 'POST' && url.pathname === '/api/users') {
    const user = requireUser(req, res, ['admin'])
    if (!user) return
    const body = await parseJson(req, 1024 * 32)
    const username = String(body.username || '').trim()
    const displayName = String(body.displayName || '').trim()
    const password = String(body.password || '')
    const role = ['admin', 'operator', 'auditor'].includes(body.role) ? body.role : 'auditor'
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username) || displayName.length < 2 || password.length < 10) return fail(res, 400, 'INVALID_USER', '账号需为 3–32 位，姓名至少 2 个字符，密码至少 10 位')
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return fail(res, 409, 'USERNAME_EXISTS', '该账号已存在')
    const { salt, hash } = hashPassword(password)
    const id = `USR-${randomBytes(6).toString('hex')}`
    const now = nowIso()
    db.prepare('INSERT INTO users (id, username, display_name, password_hash, password_salt, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, username, displayName.slice(0, 40), hash, salt, role, 'active', now, now)
    logAction(req, user, 'user.create', 'user', id, { username, role })
    return json(res, 201, { ok: true, id })
  }

  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/)
  if (userMatch && method === 'PATCH') {
    const user = requireUser(req, res, ['admin'])
    if (!user) return
    const id = String(userMatch[1])
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!target) return fail(res, 404, 'NOT_FOUND', '未找到该账号')
    const body = await parseJson(req, 1024 * 32)
    const role = ['admin', 'operator', 'auditor'].includes(body.role) ? body.role : target.role
    const status = ['active', 'disabled'].includes(body.status) ? body.status : target.status
    const displayName = String(body.displayName || target.display_name).trim().slice(0, 40)
    if (id === user.id && status === 'disabled') return fail(res, 400, 'SELF_DISABLE', '不能停用当前登录账号')
    if (body.password) {
      if (String(body.password).length < 10) return fail(res, 400, 'WEAK_PASSWORD', '新密码至少 10 位')
      const { salt, hash } = hashPassword(String(body.password))
      db.prepare('UPDATE users SET display_name = ?, role = ?, status = ?, password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
        .run(displayName, role, status, hash, salt, nowIso(), id)
    } else {
      db.prepare('UPDATE users SET display_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?').run(displayName, role, status, nowIso(), id)
    }
    logAction(req, user, 'user.update', 'user', id, { role, status })
    return json(res, 200, { ok: true })
  }

  return fail(res, 404, 'NOT_FOUND', '接口不存在')
}

async function serveStatic(req, res, url) {
  let requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  let file = path.resolve(distDir, requested)
  if (!file.startsWith(path.resolve(distDir) + path.sep) && file !== path.join(distDir, 'index.html')) return fail(res, 403, 'FORBIDDEN', '禁止访问')
  try {
    const info = await stat(file)
    if (info.isDirectory()) file = path.join(file, 'index.html')
  } catch {
    file = path.join(distDir, 'index.html')
  }
  try {
    const buffer = await readFile(file)
    return sendBuffer(res, 200, buffer, mimeTypes[path.extname(file)] || 'application/octet-stream', null, { 'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
  } catch {
    return fail(res, 404, 'FRONTEND_NOT_BUILT', '管理前端尚未构建，请先运行 pnpm build')
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url)
    else await serveStatic(req, res, url)
  } catch (error) {
    console.error(`[${nowIso()}]`, error)
    if (!res.headersSent) fail(res, error.status || 500, error.status ? 'BAD_REQUEST' : 'INTERNAL_ERROR', error.status ? error.message : '服务器处理请求时发生错误')
    else res.end()
  }
})

setInterval(() => {
  runMaintenance()
  purgeExpiredDeleted().catch((error) => console.error('自动清理失败', error))
  purgeExpiredPostcardArtifacts().catch((error) => console.error('明信片成品自动清理失败', error))
}, 60 * 60 * 1000).unref()

purgeExpiredPostcardArtifacts().catch((error) => console.error('明信片成品启动清理失败', error))

server.listen(port, host, () => {
  console.log(`淳安三中展厅统一管理服务已启动：http://${host}:${port}`)
  if (!process.env.ADMIN_INITIAL_PASSWORD) console.log('首次登录：admin / Admin@123456（请登录后尽快修改）')
  if (!process.env.TERMINAL_API_KEY) console.log('开发终端密钥：dev-terminal-key-change-before-production')
  if (!process.env.POSTCARD_TERMINAL_API_KEY) console.log('明信片终端开发密钥：dev-postcard-key-change-before-production')
})
