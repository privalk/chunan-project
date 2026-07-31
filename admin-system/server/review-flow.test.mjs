import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const port = 18789
const origin = `http://127.0.0.1:${port}`
const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xo89WQAAAABJRU5ErkJggg=='

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('测试服务启动超时')
}

async function login(username, password) {
  const response = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) })
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').split(';')[0]
}

async function request(pathname, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${origin}${pathname}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const payload = response.headers.get('content-type')?.includes('json') ? await response.json() : null
  return { response, payload }
}

test('旧数据库迁移后历史签名保持待审核且不上墙', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'signature-migration-'))
  const db = new DatabaseSync(path.join(dataDir, 'signature-admin.sqlite'))
  db.exec(`CREATE TABLE signatures (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, received_at TEXT NOT NULL, terminal_id TEXT NOT NULL, trace_id TEXT,
    display_name TEXT, user_no TEXT, identity_type TEXT, class_name TEXT, template_id TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0, stroke_count INTEGER NOT NULL DEFAULT 0, point_count INTEGER NOT NULL DEFAULT 0,
    path_length REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', sync_state TEXT NOT NULL DEFAULT 'synced',
    archived_at TEXT, deleted_at TEXT, raw_path TEXT NOT NULL, svg_path TEXT NOT NULL, display_path TEXT NOT NULL,
    print_path TEXT NOT NULL, thumbnail_path TEXT NOT NULL, jpg_path TEXT, metadata_json TEXT NOT NULL DEFAULT '{}'
  );`)
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO signatures (id, created_at, received_at, terminal_id, raw_path, svg_path, display_path, print_path, thumbnail_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('SIG-LEGACY001', now, now, 'Z1-01', 'a', 'b', 'c', 'd', 'e')
  db.close()

  const child = spawn(process.execPath, ['--input-type=module', '-e', "import('./server/database.mjs')"], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, DATA_DIR: dataDir }, stdio: 'ignore' })
  const exitCode = await new Promise((resolve) => child.once('exit', resolve))
  assert.equal(exitCode, 0)
  const migrated = new DatabaseSync(path.join(dataDir, 'adminsystem.sqlite'))
  const row = migrated.prepare('SELECT review_status, wall_visible, reviewed_at, reviewed_by FROM signatures WHERE id = ?').get('SIG-LEGACY001')
  assert.equal(row.review_status, 'pending')
  assert.equal(row.wall_visible, 0)
  assert.equal(row.reviewed_at, null)
  assert.equal(row.reviewed_by, null)
  migrated.close()
  await rm(dataDir, { recursive: true, force: true })
})

test('审核、权限、归档和公开数据最小化流程', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'signature-review-'))
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', ADMIN_INITIAL_PASSWORD: 'Admin@123456' },
    stdio: 'ignore',
  })

  try {
    await waitForServer()
    const record = {
      id: 'SIG-TEST0001', created_at: new Date().toISOString(), terminal_id: 'Z1-01', trace_id: 'test-trace',
      context: { display_name: '张三', user_no: '20260001', identity_type: 'student', class_name: '高一（3）班', template_id: 'exhibition-wall' },
      duration_ms: 1200, metrics: { stroke_count: 1, point_count: 2, normalized_path_length: 0.2 }, canvas_ratio: 3,
      strokes: [{ stroke_id: 'stroke-001', color: '#1F2937', width: 6, points: [{ x: 0.1, y: 0.2, pressure: 0.5, time: 0 }, { x: 0.3, y: 0.4, pressure: 0.6, time: 16 }] }],
    }
    const ingest = await fetch(`${origin}/api/v1/signatures`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-id': 'Z1-01', 'x-terminal-key': 'dev-terminal-key-change-before-production' }, body: JSON.stringify({ record, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', displayPng: transparentPng, printPng: transparentPng, thumbnailPng: transparentPng }) })
    assert.equal(ingest.status, 201)
    const anonymousRecord = { ...record, id: 'SIG-TEST0002', trace_id: 'anonymous-trace', context: { identity_type: 'anonymous', template_id: 'exhibition-wall' } }
    const anonymousIngest = await fetch(`${origin}/api/v1/signatures`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-id': 'Z1-01', 'x-terminal-key': 'dev-terminal-key-change-before-production' }, body: JSON.stringify({ record: anonymousRecord, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', displayPng: transparentPng, printPng: transparentPng, thumbnailPng: transparentPng }) })
    assert.equal(anonymousIngest.status, 201)

    const adminCookie = await login('admin', 'Admin@123456')
    let result = await request('/api/reviews?review=pending', { cookie: adminCookie })
    assert.equal(result.payload.counts.pending, 2)
    assert.equal(result.payload.items[0].wallVisible, false)

    result = await request('/api/reviews/actions', { cookie: adminCookie, method: 'POST', body: { ids: [record.id], action: 'reject', note: '' } })
    assert.equal(result.response.status, 400)

    result = await request('/api/reviews/actions', { cookie: adminCookie, method: 'POST', body: { ids: [anonymousRecord.id], action: 'reject', note: '测试驳回原因' } })
    assert.equal(result.response.status, 200)
    assert.equal(result.payload.affected, 1)
    result = await request('/api/reviews?review=rejected', { cookie: adminCookie })
    assert.equal(result.payload.items[0].id, anonymousRecord.id)
    assert.equal(result.payload.items[0].reviewNote, '测试驳回原因')

    await request('/api/users', { cookie: adminCookie, method: 'POST', body: { username: 'audit_test', displayName: '测试审计员', password: 'Auditor@123', role: 'auditor' } })
    const auditorCookie = await login('audit_test', 'Auditor@123')
    result = await request('/api/reviews/actions', { cookie: auditorCookie, method: 'POST', body: { ids: [record.id], action: 'approve' } })
    assert.equal(result.response.status, 403)

    result = await request('/api/reviews/actions', { cookie: adminCookie, method: 'POST', body: { ids: [record.id, anonymousRecord.id], action: 'approve', note: '内容合规' } })
    assert.equal(result.payload.affected, 2)
    result = await request('/api/wall')
    assert.equal(result.payload.items.length, 2)
    const named = result.payload.items.find((item) => item.id === record.id)
    const anonymous = result.payload.items.find((item) => item.id === anonymousRecord.id)
    assert.equal(named.displayName, '张三')
    assert.equal(named.identityLabel, '在校学生')
    assert.equal(anonymous.displayName, '匿名参与')
    assert.equal(anonymous.identityLabel, '匿名参与')
    for (const forbidden of ['userNo', 'className', 'traceId', 'reviewNote', 'raw_path', 'strokes']) assert.equal(JSON.stringify(result.payload).includes(forbidden), false)

    result = await request('/api/signatures/batch', { cookie: adminCookie, method: 'POST', body: { ids: [record.id], action: 'archive' } })
    assert.equal(result.response.status, 200)
    assert.equal((await request('/api/wall')).payload.items.length, 2)

    await request('/api/reviews/actions', { cookie: adminCookie, method: 'POST', body: { ids: [record.id], action: 'hide' } })
    assert.equal((await request('/api/wall')).payload.items.length, 1)
    await request('/api/reviews/actions', { cookie: adminCookie, method: 'POST', body: { ids: [record.id], action: 'publish' } })
    assert.equal((await request('/api/wall')).payload.items.length, 2)

    await request('/api/signatures/batch', { cookie: adminCookie, method: 'POST', body: { ids: [record.id], action: 'delete' } })
    assert.equal((await request('/api/wall')).payload.items.length, 1)
    result = await request('/api/audit-logs?action=signature.review_', { cookie: adminCookie })
    assert.ok(result.payload.items.length >= 3)
  } finally {
    child.kill()
    await new Promise((resolve) => child.once('exit', resolve))
    await rm(dataDir, { recursive: true, force: true })
  }
})
