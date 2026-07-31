import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../api'
import type { User } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const checked = ref(false)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const canWrite = computed(() => user.value?.role === 'admin' || user.value?.role === 'operator')

  async function ensure() {
    if (checked.value) return user.value
    try {
      const result = await api<{ user: User }>('/api/auth/me')
      user.value = result.user
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
    return user.value
  }

  async function login(username: string, password: string) {
    const result = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    user.value = result.user
    checked.value = true
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    user.value = null
    checked.value = true
  }

  return { user, checked, isAdmin, canWrite, ensure, login, logout }
})
