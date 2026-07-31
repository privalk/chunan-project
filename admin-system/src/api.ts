export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code = 'API_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new ApiError(body?.error?.message || `请求失败（${response.status}）`, response.status, body?.error?.code)
  return body as T
}

export async function downloadPost(url: string, body: unknown, fallbackName: string) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(payload?.error?.message || '导出失败', response.status, payload?.error?.code)
  }
  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  const name = encoded ? decodeURIComponent(encoded) : fallbackName
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadGet(url: string, fallbackName: string) {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(payload?.error?.message || '下载失败', response.status, payload?.error?.code)
  }
  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = encoded ? decodeURIComponent(encoded) : fallbackName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value)).replaceAll('/', '-')
}

export function formatRelative(value?: string | null) {
  if (!value) return '尚未连接'
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return `${Math.max(0, seconds)} 秒前`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return formatDateTime(value)
}
