import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { WallItem, WallPayload } from '../types'

const API_BASE = (import.meta.env.VITE_WALL_API_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '')
const CACHE_KEY = 'chunan-signature-wall-cache-v1'
const PAGE_SIZE = 24

function imageUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

function normalize(payload: WallPayload): WallPayload {
  return { ...payload, items: payload.items.map((item) => ({ ...item, imageUrl: imageUrl(item.imageUrl) })) }
}

export const useWallStore = defineStore('wall', () => {
  const payload = ref<WallPayload | null>(null)
  const offline = ref(false)
  const loading = ref(true)
  const page = ref(0)
  const spotlight = ref<WallItem | null>(null)
  const spotlightUntil = ref(0)
  const now = ref(Date.now())
  let fetchTimer: number | undefined
  let rotateTimer: number | undefined
  let clockTimer: number | undefined
  let activeRotationSeconds = 0
  let initialized = false

  const pages = computed(() => Math.max(1, Math.ceil((payload.value?.items.length || 0) / PAGE_SIZE)))
  const visibleItems = computed(() => {
    const list = payload.value?.items || []
    const start = (page.value % pages.value) * PAGE_SIZE
    return list.slice(start, start + PAGE_SIZE)
  })
  const spotlightVisible = computed(() => spotlight.value && now.value < spotlightUntil.value)

  function cache(value: WallPayload) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)) } catch { /* storage may be disabled */ }
  }

  function loadCache() {
    try {
      const saved = localStorage.getItem(CACHE_KEY)
      if (saved) payload.value = normalize(JSON.parse(saved) as WallPayload)
    } catch { /* ignore invalid cache */ }
  }

  function scheduleRotation() {
    const seconds = payload.value?.rotationSeconds || 20
    if (rotateTimer && seconds === activeRotationSeconds) return
    window.clearInterval(rotateTimer)
    activeRotationSeconds = seconds
    rotateTimer = window.setInterval(() => { page.value = (page.value + 1) % pages.value }, seconds * 1000)
  }

  async function refresh() {
    window.clearTimeout(fetchTimer)
    try {
      const response = await fetch(`${API_BASE}/api/wall`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextRaw = await response.json() as WallPayload
      const next = normalize(nextRaw)
      if (initialized) {
        const known = new Set(payload.value?.items.map((item) => item.id) || [])
        const latest = next.items.find((item) => !known.has(item.id))
        if (latest) { spotlight.value = latest; spotlightUntil.value = Date.now() + 8000 }
      }
      payload.value = next
      offline.value = false
      initialized = true
      if (page.value >= pages.value) page.value = 0
      cache(nextRaw)
      scheduleRotation()
    } catch {
      offline.value = true
    } finally {
      loading.value = false
      const seconds = payload.value?.refreshSeconds || 5
      fetchTimer = window.setTimeout(refresh, seconds * 1000)
    }
  }

  function start() {
    loadCache()
    initialized = Boolean(payload.value)
    clockTimer = window.setInterval(() => { now.value = Date.now() }, 250)
    scheduleRotation()
    refresh()
  }

  function stop() {
    window.clearTimeout(fetchTimer); window.clearInterval(rotateTimer); window.clearInterval(clockTimer)
  }

  return { payload, offline, loading, page, pages, visibleItems, spotlight, spotlightVisible, start, stop }
})
