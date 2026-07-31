import type { LocalSettings, PostcardArtifacts, PrintJob } from '../types'

const DB_NAME = 'chunan-postcard-terminal'
const DB_VERSION = 2
const defaults: LocalSettings = {
  sessionTimeoutSeconds: Number(import.meta.env.VITE_SESSION_TIMEOUT_SECONDS || 180),
  maxPrintCopies: 2,
  minPrintIntervalSeconds: 15,
  originalRetentionHours: 24,
  resultRetentionDays: 14,
  preferredPrinterDeviceName: '',
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      for (const name of ['postcards', 'printJobs', 'outbox']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: name === 'postcards' ? 'draft.id' : name === 'printJobs' ? 'id' : 'artifacts.draft.id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(storeName, mode)
    const request = run(tx.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => database.close()
  })
}

export async function savePostcardLocal(artifacts: PostcardArtifacts) {
  const serializable = JSON.parse(JSON.stringify(artifacts)) as PostcardArtifacts
  await transaction('postcards', 'readwrite', (store) => store.put(serializable))
}

export async function listPostcards() {
  return transaction<PostcardArtifacts[]>('postcards', 'readonly', (store) => store.getAll())
}

export async function savePrintJob(job: PrintJob) {
  await transaction('printJobs', 'readwrite', (store) => store.put(job))
}

export async function listPrintJobs() {
  const jobs = await transaction<PrintJob[]>('printJobs', 'readonly', (store) => store.getAll())
  return jobs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function queueSync(value: { artifacts: PostcardArtifacts; printJob?: PrintJob }) {
  const serializable = JSON.parse(JSON.stringify(value)) as { artifacts: PostcardArtifacts; printJob?: PrintJob }
  await transaction('outbox', 'readwrite', (store) => store.put(serializable))
}

export async function listSyncQueue() {
  return transaction<Array<{ artifacts: PostcardArtifacts; printJob?: PrintJob }>>('outbox', 'readonly', (store) => store.getAll())
}

export async function removeSync(id: string) {
  await transaction('outbox', 'readwrite', (store) => store.delete(id))
}

export function getSettings(): LocalSettings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('postcard-settings') || '{}') } }
  catch { return defaults }
}

export function saveSettings(settings: Partial<LocalSettings>) {
  localStorage.setItem('postcard-settings', JSON.stringify({ ...getSettings(), ...settings }))
}

export async function purgeExpired() {
  const settings = getSettings()
  const resultCutoff = Date.now() - settings.resultRetentionDays * 86400000
  const originalCutoff = Date.now() - settings.originalRetentionHours * 3600000
  const database = await openDatabase()
  const tx = database.transaction(['postcards', 'outbox'], 'readwrite')
  const purge = (storeName: 'postcards' | 'outbox', cutoff: number) => {
    const request = tx.objectStore(storeName).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      const value = cursor.value as PostcardArtifacts | { artifacts: PostcardArtifacts }
      const artifacts = 'artifacts' in value ? value.artifacts : value
      if (new Date(artifacts.draft.createdAt).getTime() < cutoff) cursor.delete()
      cursor.continue()
    }
  }
  purge('postcards', resultCutoff)
  // An unsent offline payload contains the source portrait; never retain it past the
  // configured original-photo window, even when the backend remains unreachable.
  purge('outbox', originalCutoff)
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
  database.close()
}
