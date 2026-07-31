import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const port = 18790
const origin = `http://127.0.0.1:${port}`
const png = 'data:image/png;base64,YWJj'
const jpg = 'data:image/jpeg;base64,YWJj'

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('测试服务启动超时')
}

async function login() {
  const response = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin@123456' }) })
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').split(';')[0]
}

const terminalHeaders = {
  'content-type': 'application/json',
  'x-terminal-id': 'Z3-25',
  'x-terminal-key': 'dev-postcard-key-change-before-production',
}

test('签名检索、明信片归档、打印任务与模板统一后台流程', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'postcard-flow-'))
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', POSTCARD_PUBLIC_BASE_URL: origin, ADMIN_INITIAL_PASSWORD: 'Admin@123456' },
    stdio: 'ignore',
  })
  try {
    await waitForServer()
    const configResponse = await fetch(`${origin}/api/v1/postcard/config`, { headers: terminalHeaders })
    assert.equal(configResponse.status, 200)
    const config = await configResponse.json()
    assert.equal(config.templates.length, 10)
    assert.equal(config.settings.maxPrintCopies, 2)

    const signatureRecord = {
      id: 'SIG-POSTCARD01', created_at: new Date().toISOString(), terminal_id: 'Z1-01', trace_id: 'postcard-signature',
      context: { display_name: '李校友', user_no: '20080001', identity_type: 'alumni', class_name: '2008届', template_id: 'exhibition-wall' },
      duration_ms: 900, metrics: { stroke_count: 1, point_count: 2, normalized_path_length: 0.2 }, canvas_ratio: 3,
      strokes: [{ stroke_id: 'stroke-001', color: '#1F2937', width: 6, points: [{ x: 0.1, y: 0.2, pressure: 0.5, time: 0 }, { x: 0.3, y: 0.4, pressure: 0.6, time: 16 }] }],
    }
    const signatureIngest = await fetch(`${origin}/api/v1/signatures`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-id': 'Z1-01', 'x-terminal-key': 'dev-terminal-key-change-before-production' },
      body: JSON.stringify({ record: signatureRecord, svg: '<svg/>', displayPng: png, printPng: png, thumbnailPng: png }),
    })
    assert.equal(signatureIngest.status, 201)
    const searchResponse = await fetch(`${origin}/api/v1/postcard/signatures?keyword=李校友`, { headers: terminalHeaders })
    assert.equal(searchResponse.status, 200)
    const search = await searchResponse.json()
    assert.equal(search.items[0].id, signatureRecord.id)
    assert.equal(JSON.stringify(search).includes('userNo'), false)

    const draft = {
      id: 'PC-TESTPOSTCARD01', traceId: 'trace-postcard-01', createdAt: new Date().toISOString(), templateId: 't-2020',
      message: '湖光作序，青春为章。', sender: '', graduationYear: '2008', photoDataUrl: '',
      signature: { id: signatureRecord.id, displayName: '李校友' }, photo: { x: .24, y: .48, scale: 1 }, signatureTransform: { x: .73, y: .72, scale: 1 },
    }
    const printJob = { id: 'PRINT-TESTPOSTCARD01', status: 'queued', copies: 1, attempts: 0, createdAt: new Date().toISOString() }
    const earlyPrintStatus = await fetch(`${origin}/api/v1/postcard/print-jobs/${printJob.id}`, {
      method: 'PATCH',
      headers: terminalHeaders,
      body: JSON.stringify({ status: 'queued', attempts: 0 }),
    })
    assert.equal(earlyPrintStatus.status, 202)

    const ingest = await fetch(`${origin}/api/v1/postcards`, { method: 'POST', headers: terminalHeaders, body: JSON.stringify({ draft, pngDataUrl: png, jpegDataUrl: jpg, thumbnailDataUrl: jpg, printJob }) })
    assert.equal(ingest.status, 201)
    const duplicate = await fetch(`${origin}/api/v1/postcards`, { method: 'POST', headers: terminalHeaders, body: JSON.stringify({ draft, pngDataUrl: png, jpegDataUrl: jpg, thumbnailDataUrl: jpg, printJob }) })
    assert.equal(duplicate.status, 200)
    assert.equal((await duplicate.json()).duplicate, true)

    const adminCookie = await login()
    let response = await fetch(`${origin}/api/postcards`, { headers: { cookie: adminCookie } })
    assert.equal(response.status, 200)
    const postcardItems = (await response.json()).items
    assert.equal(postcardItems[0].id, draft.id)
    assert.equal(postcardItems[0].sender, '李校友')
    assert.equal(postcardItems[0].pickupUrl, `${origin}/api/public/postcards/${draft.id}`)

    response = await fetch(`${origin}/api/postcards/${draft.id}/file/png?download=1`, { headers: { cookie: adminCookie } })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-disposition') || '', /attachment/)
    response = await fetch(`${origin}/api/public/postcards/${draft.id}`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /下载 PNG/)
    response = await fetch(`${origin}/api/public/postcards/${draft.id}/jpg`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-disposition') || '', /attachment/)

    response = await fetch(`${origin}/api/print-jobs`, { headers: { cookie: adminCookie } })
    const jobs = await response.json()
    assert.equal(jobs.items[0].status, 'queued')

    response = await fetch(`${origin}/api/postcards/${draft.id}/print`, {
      method: 'POST',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ copies: 2 }),
    })
    assert.equal(response.status, 201)
    const pushedJob = (await response.json()).item
    assert.equal(pushedJob.status, 'created')
    assert.equal(pushedJob.copies, 2)

    response = await fetch(`${origin}/api/v1/postcard/print-jobs/pending`, { headers: terminalHeaders })
    assert.equal(response.status, 200)
    const pendingJobs = await response.json()
    assert.equal(pendingJobs.items.some((item) => item.id === pushedJob.id), true)

    response = await fetch(`${origin}/api/v1/postcard/print-jobs/${pushedJob.id}/image`, { headers: terminalHeaders })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')

    response = await fetch(`${origin}/api/v1/postcard/print-jobs/${pushedJob.id}`, {
      method: 'PATCH',
      headers: terminalHeaders,
      body: JSON.stringify({ status: 'failed', attempts: 1, error: 'test failure' }),
    })
    assert.equal(response.status, 200)
    response = await fetch(`${origin}/api/print-jobs/${pushedJob.id}/action`, {
      method: 'POST',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'retry' }),
    })
    assert.equal(response.status, 200)
    response = await fetch(`${origin}/api/v1/postcard/print-jobs/pending`, { headers: terminalHeaders })
    assert.equal((await response.json()).items.some((item) => item.id === pushedJob.id), true)

    response = await fetch(`${origin}/api/print-jobs/${printJob.id}/action`, { method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pause' }) })
    assert.equal(response.status, 200)
    response = await fetch(`${origin}/api/v1/postcard/print-jobs/${printJob.id}`, { method: 'PATCH', headers: terminalHeaders, body: JSON.stringify({ status: 'succeeded', attempts: 1, printerName: 'A6 彩色打印机' }) })
    assert.equal(response.status, 200)

    const legacyPreviewDataUrl = `data:image/jpeg;base64,${'A'.repeat(40 * 1024)}`
    response = await fetch(`${origin}/api/v1/postcard/print-jobs/${printJob.id}`, {
      method: 'PATCH',
      headers: terminalHeaders,
      body: JSON.stringify({ status: 'succeeded', attempts: 1, previewDataUrl: legacyPreviewDataUrl }),
    })
    assert.equal(response.status, 200)

    response = await fetch(`${origin}/api/postcard-templates/t-2020`, { method: 'PATCH', headers: { cookie: adminCookie, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: false, order: 8 }) })
    assert.equal(response.status, 200)
    const refreshedConfig = await (await fetch(`${origin}/api/v1/postcard/config`, { headers: terminalHeaders })).json()
    assert.equal(refreshedConfig.templates.some((item) => item.id === 't-2020'), false)

    response = await fetch(`${origin}/api/postcards`)
    assert.equal(response.status, 401)
  } finally {
    child.kill()
    await new Promise((resolve) => child.once('exit', resolve))
    await rm(dataDir, { recursive: true, force: true })
  }
})
