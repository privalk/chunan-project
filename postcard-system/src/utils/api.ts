import type { LocalSettings, PostcardArtifacts, PostcardTemplate, PrintJob, RemotePrintJob, SignatureChoice } from '../types'

const API_BASE = (import.meta.env.VITE_SIGNATURE_API_BASE || 'http://127.0.0.1:8787/api/v1').replace(/\/$/, '')
const TERMINAL_ID = import.meta.env.VITE_POSTCARD_TERMINAL_ID || 'Z3-25'
const TERMINAL_KEY = import.meta.env.VITE_POSTCARD_TERMINAL_KEY || 'dev-postcard-key-change-before-production'

const headers = { 'X-Terminal-Id': TERMINAL_ID, 'X-Terminal-Key': TERMINAL_KEY }

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function remotePrintJob(job?: PrintJob) {
  if (!job) return undefined
  return {
    id: job.id,
    status: job.status,
    copies: job.copies,
    attempts: job.attempts,
    createdAt: job.createdAt,
    printerName: job.printerName,
    error: job.error,
  }
}

export async function searchSignatures(keyword: string) {
  const response = await fetch(`${API_BASE}/postcard/signatures?keyword=${encodeURIComponent(keyword.trim())}&limit=18`, { headers })
  if (!response.ok) throw new Error(response.status === 401 ? '终端认证失败，请联系管理员检查终端密钥' : '暂时无法连接签名档案')
  const payload = await response.json() as { items: SignatureChoice[] }
  return payload.items
}

export async function hydrateSignature(choice: SignatureChoice) {
  const response = await fetch(new URL(choice.imageUrl, API_BASE).toString(), { headers })
  if (!response.ok) throw new Error('签名图片读取失败')
  const blob = await response.blob()
  const imageUrl = await blobToDataUrl(blob)
  return { ...choice, imageUrl }
}

export async function fetchPendingPrintJobs() {
  const response = await fetch(`${API_BASE}/postcard/print-jobs/pending`, { headers, cache: 'no-store' })
  if (!response.ok) throw new Error('后台推送打印任务读取失败')
  return (await response.json() as { items: RemotePrintJob[] }).items
}

export async function downloadRemotePrintImage(job: RemotePrintJob) {
  const response = await fetch(new URL(job.imageUrl, API_BASE).toString(), { headers })
  if (!response.ok) throw new Error('推送打印成品下载失败')
  return blobToDataUrl(await response.blob())
}

export async function fetchPostcardConfig() {
  const response = await fetch(`${API_BASE}/postcard/config`, { headers })
  if (!response.ok) throw new Error('明信片配置暂时不可用')
  return response.json() as Promise<{ templates: PostcardTemplate[]; settings: LocalSettings }>
}

export async function uploadPostcard(artifacts: PostcardArtifacts, printJob?: PrintJob) {
  const draft = {
    ...artifacts.draft,
    // The backend only needs the placement metadata and signature reference. Never transmit
    // the original portrait or the hydrated signature bitmap a second time.
    photoDataUrl: '',
    signature: artifacts.draft.signature ? { ...artifacts.draft.signature, imageUrl: '' } : null,
  }
  const response = await fetch(`${API_BASE}/postcards`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'X-Trace-Id': artifacts.draft.traceId },
    body: JSON.stringify({ ...artifacts, draft, printJob: remotePrintJob(printJob) }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error?.message || '明信片归档同步失败')
  }
}

export async function updateRemotePrintJob(job: PrintJob) {
  const response = await fetch(`${API_BASE}/postcard/print-jobs/${encodeURIComponent(job.id)}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(remotePrintJob(job)),
  })
  if (!response.ok && response.status !== 404) throw new Error('打印状态同步失败')
}
