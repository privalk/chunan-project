<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api, formatDateTime } from '../api'
import AppIcon from '../components/AppIcon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useAuthStore } from '../stores/auth'
import type { User, UserRole } from '../types'

const auth = useAuthStore()
const items = ref<User[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const showCreate = ref(false)
const editing = ref<User | null>(null)
const toast = ref('')
const createForm = reactive({ username: '', displayName: '', password: '', role: 'operator' as UserRole })
const editForm = reactive({ displayName: '', password: '', role: 'operator' as UserRole, status: 'active' as 'active' | 'disabled' })

async function load() {
  loading.value = true; error.value = ''
  try { items.value = (await api<{ items: User[] }>('/api/users')).items }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '读取账号列表失败' }
  finally { loading.value = false }
}

function notify(text: string) { toast.value = text; window.setTimeout(() => { toast.value = '' }, 3000) }

async function createUser() {
  saving.value = true; error.value = ''
  try {
    await api('/api/users', { method: 'POST', body: JSON.stringify(createForm) })
    showCreate.value = false; Object.assign(createForm, { username: '', displayName: '', password: '', role: 'operator' }); notify('新管理账号已创建'); await load()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '账号创建失败' }
  finally { saving.value = false }
}

function startEdit(user: User) {
  editing.value = user
  Object.assign(editForm, { displayName: user.displayName, password: '', role: user.role, status: user.status || 'active' })
}

async function updateUser() {
  if (!editing.value) return
  saving.value = true; error.value = ''
  try {
    await api(`/api/users/${editing.value.id}`, { method: 'PATCH', body: JSON.stringify(editForm) })
    editing.value = null; notify('账号权限已更新'); await load()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '账号更新失败' }
  finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">ACCESS CONTROL</p><h1>账号权限</h1><p class="description">按职责分配系统管理员、业务管理员和只读审计角色</p></div><div class="page-actions"><button class="primary-button" @click="showCreate = true"><AppIcon name="plus" />新增账号</button></div></div>
    <article class="roles-note paper-card"><div><strong>系统管理员</strong><span>账号、设置及全部业务权限</span></div><i /><div><strong>业务管理员</strong><span>签名归档、恢复、删除与导出</span></div><i /><div><strong>只读审计</strong><span>查看数据、导出与审计日志</span></div></article>
    <article class="users-card paper-card">
      <div v-if="loading" class="loading-line" />
      <div v-if="error && !items.length" class="empty-state"><div class="empty-mark">!</div><strong>账号列表读取失败</strong><p>{{ error }}</p></div>
      <table v-else class="data-table"><thead><tr><th>管理人员</th><th>登录账号</th><th>角色权限</th><th>账号状态</th><th>最近登录</th><th>创建时间</th><th class="action-cell">操作</th></tr></thead><tbody><tr v-for="user in items" :key="user.id"><td><div class="person"><span>{{ user.displayName.slice(0, 1) }}</span><div><strong>{{ user.displayName }}</strong><small v-if="user.id === auth.user?.id">当前账号</small></div></div></td><td class="mono">{{ user.username }}</td><td><StatusBadge :status="user.role" /></td><td><StatusBadge :status="user.status || 'active'" /></td><td>{{ formatDateTime(user.lastLoginAt) }}</td><td>{{ formatDateTime(user.createdAt) }}</td><td class="action-cell"><button class="edit-button" @click="startEdit(user)">编辑权限</button></td></tr></tbody></table>
    </article>

    <div v-if="showCreate || editing" class="dialog-backdrop" role="dialog" aria-modal="true" :aria-label="showCreate ? '新增账号' : '编辑账号'" @click.self="showCreate = false; editing = null">
      <form class="user-dialog" @submit.prevent="showCreate ? createUser() : updateUser()">
        <button type="button" class="dialog-close" aria-label="关闭" @click="showCreate = false; editing = null"><AppIcon name="close" /></button>
        <div class="dialog-mark"><AppIcon name="users" /></div><p>ACCESS CONTROL</p><h2>{{ showCreate ? '新增管理账号' : '编辑账号权限' }}</h2><span class="dialog-lead">{{ showCreate ? '请为管理人员创建独立实名账号' : `正在编辑 ${editing?.displayName} 的账号信息` }}</span>
        <div v-if="showCreate" class="form-grid"><div class="field"><label>登录账号</label><input v-model="createForm.username" required minlength="3" maxlength="32" placeholder="英文、数字或 . _ -" /></div><div class="field"><label>人员姓名</label><input v-model="createForm.displayName" required minlength="2" maxlength="40" placeholder="请输入真实姓名" /></div><div class="field wide"><label>初始密码</label><input v-model="createForm.password" required type="password" minlength="10" placeholder="至少 10 位，建议包含大小写与数字" /></div><div class="field wide"><label>角色权限</label><select v-model="createForm.role"><option value="admin">系统管理员</option><option value="operator">业务管理员</option><option value="auditor">只读审计</option></select></div></div>
        <div v-else class="form-grid"><div class="field"><label>人员姓名</label><input v-model="editForm.displayName" required minlength="2" maxlength="40" /></div><div class="field"><label>账号状态</label><select v-model="editForm.status" :disabled="editing?.id === auth.user?.id"><option value="active">正常使用</option><option value="disabled">停用账号</option></select></div><div class="field wide"><label>角色权限</label><select v-model="editForm.role"><option value="admin">系统管理员</option><option value="operator">业务管理员</option><option value="auditor">只读审计</option></select></div><div class="field wide"><label>重置密码（可选）</label><input v-model="editForm.password" type="password" minlength="10" placeholder="留空则不修改，填写时至少 10 位" /></div></div>
        <p v-if="error" class="dialog-error"><AppIcon name="warning" />{{ error }}</p>
        <div class="dialog-actions"><button type="button" class="secondary-button" :disabled="saving" @click="showCreate = false; editing = null">取消</button><button class="primary-button" :disabled="saving"><span v-if="saving" class="spinner" /><AppIcon v-else name="check" />{{ saving ? '正在保存…' : showCreate ? '创建账号' : '保存修改' }}</button></div>
      </form>
    </div>
    <div v-if="toast" class="toast"><AppIcon name="check" />{{ toast }}</div>
  </section>
</template>

<style scoped>
.roles-note { display: grid; min-height: 76px; padding: 14px 22px; grid-template-columns: 1fr 1px 1fr 1px 1fr; align-items: center; gap: 22px; }.roles-note > i { height: 34px; background: var(--ca-border-light); }.roles-note div { display: flex; flex-direction: column; gap: 5px; }.roles-note strong { color: var(--ca-ink); font: 500 14px var(--ca-font-display); letter-spacing: .06em; }.roles-note span { color: var(--ca-quiet); font-size: 9px; }.users-card { margin-top: 14px; overflow: hidden; }.person { display: flex; align-items: center; gap: 10px; }.person > span { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 50%; background: rgba(159,41,37,.09); color: var(--ca-red); font: 500 13px var(--ca-font-display); }.person div { display: flex; flex-direction: column; gap: 2px; }.person strong { font-size: 12px; font-weight: 500; }.person small { color: var(--ca-red); font-size: 8px; }.action-cell { text-align: right !important; }.edit-button { min-height: 34px; padding: 0 11px; border: 1px solid var(--ca-border); border-radius: 7px; background: var(--ca-surface); color: var(--ca-muted); font-size: 10px; }.edit-button:hover { border-color: rgba(159,41,37,.25); color: var(--ca-red); }
.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 30px; background: rgba(24,24,20,.64); backdrop-filter: blur(8px); }.user-dialog { position: relative; width: min(580px, 90vw); padding: 34px 40px 38px; border-radius: 24px; background: var(--ca-surface); box-shadow: var(--ca-shadow-dialog); text-align: center; }.dialog-close { position: absolute; top: 17px; right: 17px; display: grid; width: 42px; height: 42px; padding: 0; place-items: center; border: 0; border-radius: 50%; background: #eee9e0; color: var(--ca-muted); }.dialog-mark { display: grid; width: 58px; height: 58px; margin: 0 auto 13px; place-items: center; border-radius: 50%; background: rgba(159,41,37,.08); color: var(--ca-red); font-size: 25px; }.user-dialog > p:not(.dialog-error) { margin: 0 0 7px; color: var(--ca-red); font-size: 8px; font-weight: 600; letter-spacing: .25em; }.user-dialog h2 { margin: 0 0 7px; font: 500 28px var(--ca-font-display); letter-spacing: .09em; }.dialog-lead { color: var(--ca-muted); font-size: 11px; }.form-grid { display: grid; margin-top: 25px; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left; }.form-grid .wide { grid-column: 1 / -1; }.form-grid input, .form-grid select { min-height: 48px; }.dialog-actions { display: grid; margin-top: 22px; grid-template-columns: 1fr 1.25fr; gap: 10px; }.dialog-actions button { min-height: 52px; }.dialog-error { display: flex; margin: 14px 0 -6px; align-items: center; justify-content: center; gap: 7px; color: var(--ca-red); font-size: 11px; }
</style>
