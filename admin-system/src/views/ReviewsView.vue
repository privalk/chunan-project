<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, formatDateTime } from '../api'
import AppIcon from '../components/AppIcon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useAuthStore } from '../stores/auth'
import type { Pagination, SignatureItem } from '../types'

type ReviewView = 'pending' | 'published' | 'hidden' | 'rejected'
type ReviewAction = 'approve' | 'reject' | 'hide' | 'publish'

const auth = useAuthStore()
const view = ref<ReviewView>('pending')
const keyword = ref('')
const items = ref<SignatureItem[]>([])
const counts = ref<Record<ReviewView, number>>({ pending: 0, published: 0, hidden: 0, rejected: 0 })
const pagination = ref<Pagination>({ page: 1, pageSize: 24, total: 0, pages: 1 })
const selected = ref(new Set<string>())
const loading = ref(true)
const error = ref('')
const toast = ref<{ text: string; error?: boolean } | null>(null)
const dialog = ref<{ action: ReviewAction; ids: string[] } | null>(null)
const note = ref('')
const actionError = ref('')
const saving = ref(false)
const preview = ref<SignatureItem | null>(null)

const allSelected = computed(() => items.value.length > 0 && items.value.every((item) => selected.value.has(item.id)))
const actionForView = computed<ReviewAction>(() => ({ pending: 'approve', published: 'hide', hidden: 'publish', rejected: 'approve' }[view.value] as ReviewAction))
const actionLabels: Record<ReviewAction, string> = { approve: '审核通过并上墙', reject: '驳回签名', hide: '下墙', publish: '重新上墙' }
const identityLabels: Record<string, string> = { anonymous: '匿名参与', student: '在校学生', teacher: '教师职工', alumni: '校友', visitor: '来访嘉宾' }

function notify(text: string, isError = false) {
  toast.value = { text, error: isError }
  window.setTimeout(() => { toast.value = null }, 3200)
}

async function load(reset = false) {
  if (reset) pagination.value.page = 1
  loading.value = true
  error.value = ''
  const params = new URLSearchParams({ review: view.value, page: String(pagination.value.page), pageSize: String(pagination.value.pageSize) })
  if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
  try {
    const result = await api<{ items: SignatureItem[]; counts: Record<ReviewView, number>; pagination: Pagination }>(`/api/reviews?${params}`)
    items.value = result.items
    counts.value = result.counts
    pagination.value = result.pagination
    selected.value = new Set()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '读取审核列表失败' }
  finally { loading.value = false }
}

function setView(next: ReviewView) { view.value = next; load(true) }
function toggleAll() { selected.value = allSelected.value ? new Set() : new Set(items.value.map((item) => item.id)) }
function toggle(id: string) { const next = new Set(selected.value); next.has(id) ? next.delete(id) : next.add(id); selected.value = next }
function openAction(action: ReviewAction, ids: string[]) { note.value = ''; actionError.value = ''; dialog.value = { action, ids } }

async function execute() {
  if (!dialog.value || saving.value) return
  if (dialog.value.action === 'reject' && !note.value.trim()) { actionError.value = '请填写驳回原因，便于后续追溯'; return }
  saving.value = true
  try {
    const result = await api<{ affected: number }>('/api/reviews/actions', { method: 'POST', body: JSON.stringify({ ids: dialog.value.ids, action: dialog.value.action, note: note.value }) })
    notify(`${actionLabels[dialog.value.action]}：已处理 ${result.affected} 份签名`)
    dialog.value = null; preview.value = null
    await load()
  } catch (reason) { actionError.value = reason instanceof Error ? reason.message : '审核操作失败' }
  finally { saving.value = false }
}

function pageTo(page: number) { pagination.value.page = Math.min(pagination.value.pages, Math.max(1, page)); load() }
onMounted(load)
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">WALL REVIEW</p><h1>上墙审核</h1><p class="description">公开前核对签名与人员信息，审核结果将在展示墙下一次轮询时生效</p></div><div class="page-actions"><span v-if="!auth.canWrite" class="readonly-note">只读审计模式</span><button class="secondary-button" :disabled="loading" @click="load()"><AppIcon name="refresh" />刷新</button></div></div>

    <div class="review-tabs">
      <button :class="{ active: view === 'pending' }" @click="setView('pending')">待审核 <span>{{ counts.pending }}</span></button>
      <button :class="{ active: view === 'published' }" @click="setView('published')">已上墙 <span>{{ counts.published }}</span></button>
      <button :class="{ active: view === 'hidden' }" @click="setView('hidden')">已下墙 <span>{{ counts.hidden }}</span></button>
      <button :class="{ active: view === 'rejected' }" @click="setView('rejected')">已驳回 <span>{{ counts.rejected }}</span></button>
    </div>

    <form class="review-toolbar paper-card" @submit.prevent="load(true)">
      <div class="search-field"><AppIcon name="search" /><input v-model="keyword" placeholder="搜索签名编号、姓名、用户编号或班级" /></div>
      <button class="primary-button">查询</button><button type="button" class="ghost-button" @click="keyword = ''; load(true)">重置</button>
      <div v-if="selected.size && auth.canWrite" class="batch-actions"><span>已选择 {{ selected.size }} 份</span><button type="button" class="secondary-button" @click="openAction(actionForView, [...selected])">{{ actionLabels[actionForView] }}</button><button v-if="view === 'pending'" type="button" class="danger-button" @click="openAction('reject', [...selected])">批量驳回</button></div>
    </form>

    <div v-if="loading" class="loading-line" />
    <div v-else-if="error" class="empty-state paper-card"><div class="empty-mark">!</div><strong>审核列表读取失败</strong><p>{{ error }}</p></div>
    <div v-else-if="!items.length" class="empty-state paper-card"><div class="empty-mark">审</div><strong>当前没有签名</strong><p>{{ view === 'pending' ? '新的终端签名同步后会自动进入待审核列表' : '此状态下暂时没有签名记录' }}</p></div>
    <article v-else class="review-board">
      <header><button class="check-box" :class="{ checked: allSelected }" aria-label="选择本页全部签名" @click="toggleAll"><AppIcon v-if="allSelected" name="check" /></button><span>选择本页</span><small>共 {{ pagination.total }} 份</small></header>
      <div class="review-grid">
        <section v-for="item in items" :key="item.id" class="review-card paper-card" :class="{ selected: selected.has(item.id) }">
          <button class="card-select check-box" :class="{ checked: selected.has(item.id) }" :aria-label="`选择 ${item.id}`" @click="toggle(item.id)"><AppIcon v-if="selected.has(item.id)" name="check" /></button>
          <button class="signature-preview paper-grid" @click="preview = item"><img :src="item.previewUrl" alt="签名预览" /><span>点击查看大图</span></button>
          <div class="participant"><div><strong>{{ item.displayName || '匿名参与' }}</strong><span>{{ identityLabels[item.identityType || 'anonymous'] || '未登记身份' }}</span></div><StatusBadge :status="item.wallVisible ? 'published' : item.reviewStatus" /></div>
          <dl><div><dt>签名编号</dt><dd class="mono">{{ item.id }}</dd></div><div><dt>采集时间</dt><dd>{{ formatDateTime(item.createdAt) }}</dd></div><div v-if="item.reviewNote"><dt>审核备注</dt><dd>{{ item.reviewNote }}</dd></div></dl>
          <div v-if="auth.canWrite" class="card-actions"><button class="primary-button" @click="openAction(actionForView, [item.id])">{{ actionLabels[actionForView] }}</button><button v-if="view === 'pending'" class="danger-button" @click="openAction('reject', [item.id])">驳回</button></div>
        </section>
      </div>
      <footer><span>第 {{ pagination.page }} / {{ pagination.pages }} 页</span><div><button :disabled="pagination.page <= 1" @click="pageTo(pagination.page - 1)">‹</button><button :disabled="pagination.page >= pagination.pages" @click="pageTo(pagination.page + 1)">›</button></div></footer>
    </article>

    <div v-if="preview" class="dialog-backdrop" role="dialog" aria-modal="true" aria-label="签名预览" @click.self="preview = null"><section class="preview-dialog"><button class="dialog-close" aria-label="关闭" @click="preview = null"><AppIcon name="close" /></button><p>SIGNATURE PREVIEW</p><h2>{{ preview.displayName || '匿名参与' }}</h2><div class="large-preview paper-grid"><img :src="preview.previewUrl" alt="签名大图" /></div><span>{{ identityLabels[preview.identityType || 'anonymous'] }} · {{ formatDateTime(preview.createdAt) }}</span></section></div>

    <div v-if="dialog" class="dialog-backdrop action-layer" role="alertdialog" aria-modal="true" aria-labelledby="review-action-title"><form class="action-dialog" @submit.prevent="execute"><div class="action-mark" :class="{ danger: dialog.action === 'reject' }"><AppIcon :name="dialog.action === 'reject' ? 'warning' : 'check'" /></div><p>REVIEW ACTION</p><h2 id="review-action-title">{{ actionLabels[dialog.action] }}</h2><span>将处理 {{ dialog.ids.length }} 份签名，操作人与状态变化会写入审计日志。</span><div class="field"><label for="review-note">{{ dialog.action === 'reject' ? '驳回原因（必填）' : '审核备注（选填）' }}</label><textarea id="review-note" v-model="note" maxlength="500" :placeholder="dialog.action === 'reject' ? '请说明不适合公开展示的原因' : '可记录本次操作说明'" /></div><p v-if="actionError" class="action-error">{{ actionError }}</p><div class="dialog-actions"><button type="button" class="secondary-button" :disabled="saving" @click="dialog = null">取消</button><button :class="dialog.action === 'reject' ? 'danger-button' : 'primary-button'" :disabled="saving"><span v-if="saving" class="spinner" />确认执行</button></div></form></div>
    <div v-if="toast" class="toast" :class="{ error: toast.error }"><AppIcon :name="toast.error ? 'warning' : 'check'" />{{ toast.text }}</div>
  </section>
</template>

<style scoped>
.readonly-note { color: var(--ca-muted); font-size: 11px; }.review-tabs { display: flex; margin-bottom: 13px; gap: 6px; }.review-tabs button { min-height: 40px; padding: 0 16px; border: 0; border-radius: 8px; background: transparent; color: var(--ca-muted); }.review-tabs span { display: inline-grid; min-width: 22px; height: 20px; margin-left: 6px; padding: 0 5px; place-items: center; border-radius: 10px; background: #e8e1d6; color: var(--ca-quiet); font-size: 9px; }.review-tabs button.active { background: var(--ca-surface); color: var(--ca-red); box-shadow: 0 3px 12px rgba(69,52,29,.05); }.review-tabs button.active span { background: rgba(159,41,37,.09); color: var(--ca-red); }
.review-toolbar { display: grid; padding: 13px; grid-template-columns: minmax(280px, 1fr) auto auto auto; align-items: center; gap: 9px; }.search-field { position: relative; }.search-field svg { position: absolute; top: 13px; left: 13px; color: var(--ca-quiet); }.search-field input { width: 100%; height: 44px; padding: 0 14px 0 40px; border: 1px solid var(--ca-border); border-radius: 8px; background: var(--ca-canvas); outline: 0; }.batch-actions { display: flex; align-items: center; gap: 8px; margin-left: 14px; color: var(--ca-muted); font-size: 11px; }
.review-board { margin-top: 14px; }.review-board > header { display: flex; height: 44px; padding: 0 5px; align-items: center; gap: 8px; color: var(--ca-muted); font-size: 11px; }.review-board > header small { margin-left: auto; color: var(--ca-quiet); }.check-box { display: grid; width: 24px; height: 24px; padding: 0; place-items: center; border: 1px solid var(--ca-border); border-radius: 6px; background: var(--ca-canvas); color: white; }.check-box.checked { border-color: var(--ca-red); background: var(--ca-red); }
.review-grid { display: grid; grid-template-columns: repeat(4, minmax(230px, 1fr)); gap: 13px; }.review-card { position: relative; padding: 12px; transition: border-color .18s ease, transform .18s ease; }.review-card.selected { border-color: rgba(159,41,37,.45); }.card-select { position: absolute; top: 20px; left: 20px; z-index: 2; }.signature-preview { position: relative; display: grid; width: 100%; height: 140px; padding: 20px; place-items: center; overflow: hidden; border: 1px solid #eee7dc; border-radius: 9px; }.signature-preview img { max-width: 90%; max-height: 92px; }.signature-preview span { position: absolute; right: 10px; bottom: 7px; color: var(--ca-quiet); font-size: 8px; opacity: 0; }.signature-preview:hover span { opacity: 1; }.participant { display: flex; margin-top: 12px; align-items: center; justify-content: space-between; gap: 8px; }.participant > div { display: grid; min-width: 0; gap: 3px; }.participant strong { overflow: hidden; font: 500 16px var(--ca-font-display); text-overflow: ellipsis; white-space: nowrap; }.participant span { color: var(--ca-muted); font-size: 9px; }.review-card dl { margin: 11px 0; padding-top: 8px; border-top: 1px solid var(--ca-border-light); }.review-card dl div { display: grid; padding: 3px 0; grid-template-columns: 58px minmax(0,1fr); gap: 8px; font-size: 9px; }.review-card dt { color: var(--ca-quiet); }.review-card dd { margin: 0; overflow: hidden; color: var(--ca-muted); text-overflow: ellipsis; white-space: nowrap; }.card-actions { display: grid; grid-template-columns: 1fr auto; gap: 7px; }.card-actions button { min-height: 40px; padding-inline: 12px; font-size: 11px; }.review-board > footer { display: flex; height: 58px; align-items: center; justify-content: space-between; color: var(--ca-quiet); font-size: 10px; }.review-board > footer div { display: flex; gap: 7px; }.review-board > footer button { width: 38px; height: 36px; border: 1px solid var(--ca-border); border-radius: 7px; background: var(--ca-surface); }.review-board > footer button:disabled { opacity: .35; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; padding: 30px; place-items: center; background: rgba(24,24,20,.64); backdrop-filter: blur(8px); }.preview-dialog, .action-dialog { position: relative; width: min(720px, 90vw); padding: 34px 40px 38px; border-radius: 22px; background: var(--ca-surface); box-shadow: var(--ca-shadow-dialog); text-align: center; }.dialog-close { position: absolute; top: 16px; right: 16px; display: grid; width: 44px; height: 44px; place-items: center; border: 0; border-radius: 50%; background: #eeeae1; }.preview-dialog > p, .action-dialog > p { margin: 0 0 7px; color: var(--ca-red); font-size: 8px; font-weight: 600; letter-spacing: .24em; }.preview-dialog h2, .action-dialog h2 { margin: 0 0 16px; font: 500 27px var(--ca-font-display); letter-spacing: .09em; }.large-preview { display: grid; height: 260px; padding: 30px; place-items: center; border: 1px solid var(--ca-border); border-radius: 12px; }.large-preview img { max-width: 90%; max-height: 190px; }.preview-dialog > span, .action-dialog > span { display: block; margin-top: 14px; color: var(--ca-muted); font-size: 11px; }.action-layer { z-index: 60; }.action-dialog { width: min(520px, 90vw); }.action-mark { display: grid; width: 58px; height: 58px; margin: 0 auto 14px; place-items: center; border-radius: 50%; background: rgba(106,136,115,.1); color: var(--ca-green); font-size: 25px; }.action-mark.danger { background: rgba(159,41,37,.08); color: var(--ca-red); }.action-dialog .field { margin-top: 19px; text-align: left; }.action-error { color: var(--ca-red) !important; font-size: 11px !important; letter-spacing: 0 !important; }.dialog-actions { display: grid; margin-top: 20px; grid-template-columns: 1fr 1.2fr; gap: 9px; }.dialog-actions button { min-height: 50px; }
@media (max-width: 1500px) { .review-grid { grid-template-columns: repeat(3, 1fr); }.review-toolbar { grid-template-columns: 1fr auto auto; }.batch-actions { grid-column: 1 / -1; margin-left: 0; } }
</style>
