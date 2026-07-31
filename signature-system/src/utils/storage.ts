import type { SaveResult, SignatureArtifacts } from '../types/signature'

const DB_NAME = 'chunan-signature-terminal'
const SIGNATURE_STORE = 'signatures'
const OUTBOX_STORE = 'outbox'
const API_BASE = (import.meta.env.VITE_SIGNATURE_API_BASE || 'http://127.0.0.1:8787/api/v1').replace(/\/$/, '')
const TERMINAL_ID = import.meta.env.VITE_TERMINAL_ID || 'Z1-01'
const TERMINAL_KEY = import.meta.env.VITE_TERMINAL_API_KEY || 'dev-terminal-key-change-before-production'
const APP_VERSION = '1.1.0'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SIGNATURE_STORE)) request.result.createObjectStore(SIGNATURE_STORE, { keyPath: 'record.id' })
      if (!request.result.objectStoreNames.contains(OUTBOX_STORE)) request.result.createObjectStore(OUTBOX_STORE, { keyPath: 'record.id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function put(storeName: string, value: SignatureArtifacts) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(value)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function remove(storeName: string, id: string) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function getAll(storeName: string) {
  const database = await openDatabase()
  const values = await new Promise<SignatureArtifacts[]>((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return values
}

async function count(storeName: string) {
  const database = await openDatabase()
  const value = await new Promise<number>((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return value
}

async function upload(artifacts: SignatureArtifacts) {
  const response = await fetch(`${API_BASE}/signatures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Terminal-Id': TERMINAL_ID,
      'X-Terminal-Key': TERMINAL_KEY,
      'X-Trace-Id': artifacts.record.trace_id,
    },
    body: JSON.stringify(artifacts),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error?.message || `同步失败（${response.status}）`)
  }
}

export async function saveLocally(artifacts: SignatureArtifacts): Promise<SaveResult> {
  // Vue may proxy the preview payload; IndexedDB and Electron IPC only accept plain objects.
  const serializable = JSON.parse(JSON.stringify(artifacts)) as SignatureArtifacts
  await put(SIGNATURE_STORE, serializable)

  let localResult: SaveResult = { ok: true }
  if (window.signatureTerminal) localResult = await window.signatureTerminal.saveSignature(serializable)

  try {
    await upload(serializable)
    await remove(OUTBOX_STORE, serializable.record.id)
    return { ...localResult, synced: true }
  } catch {
    await put(OUTBOX_STORE, serializable)
    return { ...localResult, synced: false }
  }
}

export async function flushOutbox() {
  const pending = await getAll(OUTBOX_STORE)
  let synced = 0
  for (const artifacts of pending) {
    try {
      await upload(artifacts)
      await remove(OUTBOX_STORE, artifacts.record.id)
      synced += 1
    } catch {
      break
    }
  }
  return { pending: Math.max(0, pending.length - synced), synced }
}

async function heartbeat() {
  const queueCount = await count(OUTBOX_STORE)
  await fetch(`${API_BASE}/terminals/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Terminal-Id': TERMINAL_ID, 'X-Terminal-Key': TERMINAL_KEY },
    body: JSON.stringify({ appVersion: APP_VERSION, queueCount }),
  })
}

export function startSyncService() {
  const run = async () => {
    await flushOutbox().catch(() => undefined)
    await heartbeat().catch(() => undefined)
  }
  run()
  const interval = window.setInterval(run, 30000)
  window.addEventListener('online', run)
  return () => {
    window.clearInterval(interval)
    window.removeEventListener('online', run)
  }
}

export async function getSignatureCount() {
  return count(SIGNATURE_STORE)
}
