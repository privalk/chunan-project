<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, downloadPost, formatDateTime } from '../api'
import AppIcon from '../components/AppIcon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useAuthStore } from '../stores/auth'
import type { Pagination, SignatureDetail, SignatureItem } from '../types'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const items = ref<SignatureItem[]>([])
const pagination = ref<Pagination>({ page: 1, pageSize: 20, total: 0, pages: 1 })
const statusCounts = ref<Record<string, number>>({})
const selected = ref(new Set<string>())
const detail = ref<SignatureDetail | null>(null)
const detailLoading = ref(false)
const exporting = ref(false)
const error = ref('')
const toast = ref<{ text: string; error?: boolean } | null>(null)
const pendingAction = ref<'archive' | 'restore' | 'delete' | null>(null)
const contextEditing = ref(false)
const savingContext = ref(false)
const contextError = ref('')
const contextForm = reactive({ identityType: 'anonymous', displayName: '', userNo: '', className: '' })
const batchFormat = ref('png')
const reviewSaving = ref(false)
const reviewDialog = ref<{ action: 'approve' | 'reject' | 'hide' | 'publish'; id: string } | null>(null)
const reviewNote = ref('')
const reviewError = ref('')
const filters = reactive({ keyword: '', status: '', terminal: '', from: '', to: '' })

const allSelected = computed(() => items.value.length > 0 && items.value.every((item) => selected.value.has(item.id)))
const selectionCount = computed(() => selected.value.size)
const reportUrl = computed(() => {
  const params = createParams(false)
  return `/api/reports/signatures.csv?${params.toString()}`
})

function notify(text: string, isError = false) {
  toast.value = { text, error: isError }
  window.setTimeout(() => { toast.value = null }, 3200)
}

function createParams(includePage = true) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  if (includePage) { params.set('page', String(pagination.value.page)); params.set('pageSize', String(pagination.value.pageSize)) }
  return params
}

async function load(resetPage = false) {
  if (resetPage) pagination.value.page = 1
  loading.value = true
  error.value = ''
  try {
    const result = await api<{ items: SignatureItem[]; pagination: Pagination; statusCounts: Record<string, number> }>(`/api/signatures?${createParams().toString()}`)
    items.value = result.items
    pagination.value = result.pagination
    statusCounts.value = result.statusCounts
    selected.value = new Set([...selected.value].filter((id) => result.items.some((item) => item.id === id)))
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '读取签名档案失败' }
  finally { loading.value = false }
}

function toggleAll() {
  if (allSelected.value) selected.value = new Set()
  else selected.value = new Set(items.value.map((item) => item.id))
}

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

async function openDetail(id: string) {
  detailLoading.value = true
  detail.value = null
  try {
    const result = await api<{ item: SignatureDetail }>(`/api/signatures/${encodeURIComponent(id)}`)
    detail.value = result.item
  } catch (reason) { notify(reason instanceof Error ? reason.message : '读取签名详情失败', true) }
  finally { detailLoading.value = false }
}

function closeDetail() {
  detail.value = null
  if (route.query.open) router.replace({ query: { ...route.query, open: undefined } })
}

const identityLabels: Record<string, string> = { anonymous: '匿名参与', student: '在校学生', teacher: '教师职工', alumni: '校友', visitor: '来访嘉宾' }

function openContextEditor() {
  if (!detail.value) return
  Object.assign(contextForm, {
    identityType: detail.value.identityType || 'anonymous',
    displayName: detail.value.displayName || '',
    userNo: detail.value.userNo || '',
    className: detail.value.className || '',
  })
  contextError.value = ''
  contextEditing.value = true
}

function setContextIdentity(value: string) {
  contextForm.identityType = value
  contextError.value = ''
  if (value === 'anonymous') Object.assign(contextForm, { displayName: '', userNo: '', className: '' })
}

async function saveContext() {
  if (!detail.value || savingContext.value) return
  if (contextForm.identityType !== 'anonymous' && !contextForm.displayName.trim()) {
    contextError.value = '实名身份必须填写姓名'
    return
  }
  savingContext.value = true
  contextError.value = ''
  try {
    const result = await api<{ item: SignatureItem }>(`/api/signatures/${encodeURIComponent(detail.value.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(contextForm),
    })
    Object.assign(detail.value, result.item)
    contextEditing.value = false
    notify('人员信息已更新，并写入审计日志')
    await load()
  } catch (reason) { contextError.value = reason instanceof Error ? reason.message : '人员信息保存失败' }
  finally { savingContext.value = false }
}

async function exportBatch() {
  if (!selectionCount.value || exporting.value) return
  exporting.value = true
  try {
    await downloadPost('/api/signatures/export', { ids: [...selected.value], format: batchFormat.value }, '签名批量导出.zip')
    notify(`已生成 ${selectionCount.value} 份签名的导出包`)
  } catch (reason) { notify(reason instanceof Error ? reason.message : '批量导出失败', true) }
  finally { exporting.value = false }
}

async function executeBatch() {
  if (!pendingAction.value) return
  const ids = detail.value ? [detail.value.id] : [...selected.value]
  try {
    await api('/api/signatures/batch', { method: 'POST', body: JSON.stringify({ ids, action: pendingAction.value }) })
    const label = { archive: '归档', restore: '恢复', delete: '删除' }[pendingAction.value]
    notify(`已完成 ${ids.length} 份签名的${label}操作`)
    pendingAction.value = null
    selected.value = new Set()
    if (detail.value) closeDetail()
    await load()
  } catch (reason) { notify(reason instanceof Error ? reason.message : '操作失败', true) }
}

const reviewActionLabels = { approve: '审核通过并上墙', reject: '驳回签名', hide: '签名下墙', publish: '重新上墙' } as const

function openReviewAction(action: 'approve' | 'reject' | 'hide' | 'publish') {
  if (!detail.value || reviewSaving.value) return
  reviewNote.value = ''
  reviewError.value = ''
  reviewDialog.value = { action, id: detail.value.id }
}

async function executeReviewAction() {
  const operation = reviewDialog.value
  if (!operation || reviewSaving.value) return
  const note = reviewNote.value.trim()
  if (operation.action === 'reject' && !note) {
    reviewError.value = '请填写驳回原因，便于后续追溯'
    return
  }
  reviewSaving.value = true
  reviewError.value = ''
  try {
    await api('/api/reviews/actions', { method: 'POST', body: JSON.stringify({ ids: [operation.id], action: operation.action, note }) })
    notify(`已完成${reviewActionLabels[operation.action]}操作`)
    reviewDialog.value = null
    if (detail.value?.id === operation.id) await openDetail(operation.id)
    await load()
  } catch (reason) { reviewError.value = reason instanceof Error ? reason.message : '审核操作失败' }
  finally { reviewSaving.value = false }
}

function setStatus(status: string) {
  filters.status = status
  load(true)
}

function changePage(page: number) {
  pagination.value.page = Math.min(pagination.value.pages, Math.max(1, page))
  load()
}

watch(() => route.query.open, (id) => { if (typeof id === 'string') openDetail(id) })
onMounted(async () => { await load(); if (typeof route.query.open === 'string') await openDetail(route.query.open) })
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">SIGNATURE ARCHIVE</p><h1>签名档案</h1><p class="description">查询、预览、归档并导出终端采集的原始笔迹与展示文件</p></div>
      <div class="page-actions"><a class="secondary-button" :href="reportUrl"><AppIcon name="download" />导出查询报表</a><button class="secondary-button" :disabled="loading" @click="load()"><AppIcon name="refresh" />刷新</button></div>
    </div>

    <div class="status-tabs">
      <button :class="{ active: !filters.status }" @click="setStatus('')">全部档案 <span>{{ (statusCounts.active || 0) + (statusCounts.archived || 0) }}</span></button>
      <button :class="{ active: filters.status === 'active' }" @click="setStatus('active')">当前在库 <span>{{ statusCounts.active || 0 }}</span></button>
      <button :class="{ active: filters.status === 'archived' }" @click="setStatus('archived')">已归档 <span>{{ statusCounts.archived || 0 }}</span></button>
      <button v-if="auth.isAdmin" :class="{ active: filters.status === 'deleted' }" @click="setStatus('deleted')">回收记录 <span>{{ statusCounts.deleted || 0 }}</span></button>
    </div>

    <form class="filter-bar paper-card" @submit.prevent="load(true)">
      <div class="search-field"><AppIcon name="search" /><input v-model="filters.keyword" placeholder="搜索签名编号、姓名、用户编号或班级" /></div>
      <div class="field compact-field"><label>采集终端</label><select v-model="filters.terminal"><option value="">全部终端</option><option value="Z1-01">Z1-01 · 入口签名终端</option></select></div>
      <div class="field compact-field"><label>开始日期</label><input v-model="filters.from" type="date" /></div>
      <div class="field compact-field"><label>结束日期</label><input v-model="filters.to" type="date" /></div>
      <button class="primary-button">筛选档案</button>
      <button type="button" class="ghost-button" @click="Object.assign(filters, { keyword: '', terminal: '', from: '', to: '' }); load(true)">重置</button>
    </form>

    <div v-if="selectionCount" class="batch-bar">
      <div><span class="selected-mark"><AppIcon name="check" /></span>已选择 <strong>{{ selectionCount }}</strong> 份签名</div>
      <div class="batch-actions">
        <select v-model="batchFormat" aria-label="批量导出格式"><option value="png">透明 PNG</option><option value="jpg">JPG</option><option value="svg">SVG</option><option value="json">原始 JSON</option></select>
        <button class="secondary-button" :disabled="exporting" @click="exportBatch"><span v-if="exporting" class="spinner" /><AppIcon v-else name="download" />批量导出</button>
        <button v-if="auth.canWrite && filters.status !== 'archived' && filters.status !== 'deleted'" class="secondary-button" @click="pendingAction = 'archive'"><AppIcon name="archive" />归档</button>
        <button v-if="auth.canWrite && (filters.status === 'archived' || filters.status === 'deleted')" class="secondary-button" @click="pendingAction = 'restore'"><AppIcon name="refresh" />恢复在库</button>
        <button v-if="auth.canWrite && filters.status !== 'deleted'" class="danger-button" @click="pendingAction = 'delete'"><AppIcon name="trash" />移至回收记录</button>
      </div>
    </div>

    <article class="table-card paper-card">
      <div v-if="loading" class="loading-line" />
      <div v-if="error" class="empty-state"><div class="empty-mark">!</div><strong>档案读取失败</strong><p>{{ error }}</p><button class="secondary-button retry" @click="load()">重新加载</button></div>
      <div v-else-if="!items.length" class="empty-state"><div class="empty-mark">签</div><strong>没有符合条件的签名</strong><p>请调整筛选条件，或等待终端同步新的签名</p></div>
      <div v-else class="table-scroll">
        <table class="data-table">
          <thead><tr><th class="check-cell"><button class="check-box" :class="{ checked: allSelected }" aria-label="选择本页全部签名" @click="toggleAll"><AppIcon v-if="allSelected" name="check" /></button></th><th>签名预览</th><th>签名编号</th><th>采集终端</th><th>采集时间</th><th>笔迹数据</th><th>状态</th><th class="action-cell">操作</th></tr></thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" :class="{ selected: selected.has(item.id) }" @dblclick="openDetail(item.id)">
              <td class="check-cell"><button class="check-box" :class="{ checked: selected.has(item.id) }" :aria-label="`选择签名 ${item.id}`" @click="toggle(item.id)"><AppIcon v-if="selected.has(item.id)" name="check" /></button></td>
              <td><div class="table-thumb paper-grid"><img :src="item.thumbnailUrl" alt="签名缩略图" /></div></td>
              <td><strong class="record-id mono">{{ item.id }}</strong><small v-if="item.displayName">{{ item.displayName }}</small><small v-else>未登记姓名</small></td>
              <td><span class="terminal-id mono">{{ item.terminalId }}</span><small>入口签名终端</small></td>
              <td><span class="date-main">{{ formatDateTime(item.createdAt).slice(0, 10) }}</span><small>{{ formatDateTime(item.createdAt).slice(11) }}</small></td>
              <td><span>{{ item.strokeCount }} 笔 · {{ item.pointCount }} 点</span><small>{{ Math.max(1, Math.round(item.durationMs / 1000)) }} 秒完成</small></td>
              <td><StatusBadge :status="item.status" /></td>
              <td class="action-cell"><button class="view-button" @click="openDetail(item.id)"><AppIcon name="eye" />查看</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer v-if="!error && items.length" class="table-footer"><span>共 {{ pagination.total }} 份签名，第 {{ pagination.page }} / {{ pagination.pages }} 页</span><div><button :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">‹</button><strong>{{ pagination.page }}</strong><button :disabled="pagination.page >= pagination.pages" @click="changePage(pagination.page + 1)">›</button></div></footer>
    </article>

    <div v-if="detailLoading || detail" class="dialog-backdrop" role="dialog" aria-modal="true" aria-label="签名详情" @click.self="closeDetail">
      <section class="detail-dialog">
        <button class="dialog-close" aria-label="关闭详情" @click="closeDetail"><AppIcon name="close" /></button>
        <div v-if="detailLoading" class="detail-loading"><span class="spinner" /><p>正在读取签名档案…</p></div>
        <template v-else-if="detail">
          <div class="detail-head"><div><p>ARCHIVE DETAIL</p><h2>签名档案详情</h2></div><StatusBadge :status="detail.status" /></div>
          <div class="detail-body">
            <div class="preview-column">
              <div class="large-preview paper-grid"><span class="watermark">淳</span><img :src="detail.previewUrl" alt="签名预览" /><small>淳安第三中学 · 签名档案</small></div>
              <div class="download-row"><a v-for="(url, name) in detail.files" :key="name" :href="url" class="secondary-button"><AppIcon name="download" />{{ { json: '原始 JSON', svg: 'SVG', png: '透明 PNG', print: '打印 PNG', jpg: 'JPG' }[name] || name }}</a></div>
            </div>
            <div class="metadata-column">
              <dl><div class="wide"><dt>签名编号</dt><dd class="mono">{{ detail.id }}</dd></div><div><dt>采集时间</dt><dd>{{ formatDateTime(detail.createdAt) }}</dd></div><div><dt>接收时间</dt><dd>{{ formatDateTime(detail.receivedAt) }}</dd></div><div><dt>采集终端</dt><dd>{{ detail.terminalId }}</dd></div><div><dt>同步状态</dt><dd><StatusBadge :status="detail.syncState" /></dd></div><div><dt>签写时长</dt><dd>{{ Math.max(1, Math.round(detail.durationMs / 1000)) }} 秒</dd></div><div><dt>笔迹采样</dt><dd>{{ detail.strokeCount }} 笔 / {{ detail.pointCount }} 点</dd></div><div><dt>身份</dt><dd>{{ detail.identityType ? (identityLabels[detail.identityType] || detail.identityType) : '未登记' }}</dd></div><div><dt>姓名</dt><dd>{{ detail.displayName || (detail.identityType === 'anonymous' ? '匿名' : '未登记') }}</dd></div><div><dt>编号</dt><dd>{{ detail.userNo || '未登记' }}</dd></div><div><dt>班级 / 部门</dt><dd>{{ detail.className || '未登记' }}</dd></div><div><dt>审核状态</dt><dd><StatusBadge :status="detail.reviewStatus" /></dd></div><div><dt>上墙状态</dt><dd><StatusBadge :status="detail.wallVisible ? 'published' : 'hidden'" /></dd></div><div v-if="detail.reviewedAt"><dt>最近审核</dt><dd>{{ detail.reviewedBy || '—' }} · {{ formatDateTime(detail.reviewedAt) }}</dd></div><div v-if="detail.reviewNote" class="wide"><dt>审核备注</dt><dd>{{ detail.reviewNote }}</dd></div><div class="wide"><dt>Trace ID</dt><dd class="mono trace">{{ detail.traceId || '—' }}</dd></div></dl>
              <div v-if="auth.canWrite && detail.status !== 'deleted'" class="review-actions"><button v-if="detail.reviewStatus !== 'approved'" class="primary-button" :disabled="reviewSaving" @click="openReviewAction('approve')"><AppIcon name="check" />审核通过并上墙</button><button v-if="detail.reviewStatus === 'pending'" class="danger-button" :disabled="reviewSaving" @click="openReviewAction('reject')"><AppIcon name="warning" />驳回</button><button v-if="detail.reviewStatus === 'approved' && detail.wallVisible" class="danger-button" :disabled="reviewSaving" @click="openReviewAction('hide')">下墙</button><button v-if="detail.reviewStatus === 'approved' && !detail.wallVisible" class="primary-button" :disabled="reviewSaving" @click="openReviewAction('publish')">重新上墙</button></div>
              <div v-if="auth.canWrite" class="detail-actions"><button class="secondary-button" @click="openContextEditor"><AppIcon name="edit" />编辑人员信息</button><button v-if="detail.status === 'active'" class="secondary-button" @click="pendingAction = 'archive'"><AppIcon name="archive" />归档签名</button><button v-else class="secondary-button" @click="pendingAction = 'restore'"><AppIcon name="refresh" />恢复在库</button><button v-if="detail.status !== 'deleted'" class="danger-button" @click="pendingAction = 'delete'"><AppIcon name="trash" />移至回收记录</button></div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <div v-if="contextEditing" class="dialog-backdrop context-layer" role="dialog" aria-modal="true" aria-labelledby="context-title">
      <form class="context-dialog" @submit.prevent="saveContext">
        <button type="button" class="dialog-close" aria-label="关闭人员信息编辑" @click="contextEditing = false"><AppIcon name="close" /></button>
        <div class="context-mark">人</div><p>PARTICIPANT INFO</p><h2 id="context-title">编辑人员信息</h2><span>修改后将同步更新数据库和原始 JSON，并写入审计日志。</span>
        <div class="identity-options">
          <button v-for="(label, value) in identityLabels" :key="value" type="button" :class="{ active: contextForm.identityType === value }" @click="setContextIdentity(value)">{{ label }}</button>
        </div>
        <div v-if="contextForm.identityType !== 'anonymous'" class="context-fields">
          <div class="field"><label>姓名（必填）</label><input v-model="contextForm.displayName" maxlength="40" placeholder="请输入姓名" /></div>
          <div class="field"><label>学号 / 工号（选填）</label><input v-model="contextForm.userNo" maxlength="40" placeholder="用于区分同名人员" /></div>
          <div class="field wide"><label>班级 / 部门（选填）</label><input v-model="contextForm.className" maxlength="60" placeholder="例如：高一（3）班" /></div>
        </div>
        <div v-else class="anonymous-context">匿名模式会清除该签名已登记的姓名、编号和班级信息。</div>
        <p v-if="contextError" class="context-error"><AppIcon name="warning" />{{ contextError }}</p>
        <div class="context-actions"><button type="button" class="secondary-button" @click="contextEditing = false">取消</button><button class="primary-button" :disabled="savingContext"><span v-if="savingContext" class="spinner" />{{ savingContext ? '正在保存…' : '保存人员信息' }}</button></div>
      </form>
    </div>

    <div v-if="pendingAction" class="dialog-backdrop confirm-layer" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <section class="confirm-dialog"><div class="confirm-mark" :class="{ danger: pendingAction === 'delete' }"><AppIcon :name="pendingAction === 'delete' ? 'warning' : 'archive'" /></div><p>ACTION CONFIRM</p><h2 id="confirm-title">{{ pendingAction === 'delete' ? '确认移至回收记录？' : pendingAction === 'archive' ? '确认归档所选签名？' : '确认恢复为在库状态？' }}</h2><span>{{ detail ? '将处理当前签名档案。' : `将处理已选择的 ${selectionCount} 份签名档案。` }}所有操作都会写入审计日志。</span><div><button class="secondary-button" @click="pendingAction = null">暂不操作</button><button :class="pendingAction === 'delete' ? 'danger-button' : 'primary-button'" @click="executeBatch">确认执行</button></div></section>
    </div>

    <div v-if="reviewDialog" class="dialog-backdrop review-layer" role="alertdialog" aria-modal="true" aria-labelledby="review-title">
      <form class="review-dialog" @submit.prevent="executeReviewAction">
        <div class="confirm-mark" :class="{ danger: reviewDialog.action === 'reject' || reviewDialog.action === 'hide' }"><AppIcon :name="reviewDialog.action === 'reject' || reviewDialog.action === 'hide' ? 'warning' : 'check'" /></div>
        <p>WALL REVIEW</p>
        <h2 id="review-title">{{ reviewActionLabels[reviewDialog.action] }}</h2>
        <span>签名编号 {{ reviewDialog.id }}。确认后会立即更新展示墙状态，并写入审计日志。</span>
        <div class="field review-note-field"><label for="detail-review-note">{{ reviewDialog.action === 'reject' ? '驳回原因（必填）' : '审核备注（选填）' }}</label><textarea id="detail-review-note" v-model="reviewNote" maxlength="500" :placeholder="reviewDialog.action === 'reject' ? '请说明不适合公开展示的原因' : '可记录本次操作说明'" /></div>
        <p v-if="reviewError" class="review-error"><AppIcon name="warning" />{{ reviewError }}</p>
        <div class="review-dialog-actions"><button type="button" class="secondary-button" :disabled="reviewSaving" @click="reviewDialog = null">取消</button><button :class="reviewDialog.action === 'reject' || reviewDialog.action === 'hide' ? 'danger-button' : 'primary-button'" :disabled="reviewSaving"><span v-if="reviewSaving" class="spinner" />{{ reviewSaving ? '正在处理…' : '确认执行' }}</button></div>
      </form>
    </div>

    <div v-if="toast" class="toast" :class="{ error: toast.error }"><AppIcon :name="toast.error ? 'warning' : 'check'" />{{ toast.text }}</div>
  </section>
</template>

<style scoped>
.status-tabs { display: flex; margin-bottom: 13px; gap: 5px; }.status-tabs button { min-height: 38px; padding: 0 15px; border: 0; border-radius: 8px; background: transparent; color: var(--ca-muted); font-size: 12px; }.status-tabs button span { display: inline-grid; min-width: 22px; height: 20px; margin-left: 6px; padding: 0 5px; place-items: center; border-radius: 10px; background: #e8e1d6; color: var(--ca-quiet); font-size: 9px; }.status-tabs button.active { background: var(--ca-surface); color: var(--ca-red); box-shadow: 0 3px 12px rgba(69,52,29,.05); }.status-tabs button.active span { background: rgba(159,41,37,.09); color: var(--ca-red); }
.filter-bar { display: grid; padding: 14px; grid-template-columns: minmax(260px, 1fr) 190px 155px 155px auto auto; align-items: end; gap: 10px; }.search-field { position: relative; align-self: end; }.search-field > svg { position: absolute; top: 14px; left: 13px; color: var(--ca-quiet); }.search-field input { width: 100%; height: 44px; padding: 0 12px 0 40px; border: 1px solid var(--ca-border); border-radius: 8px; background: var(--ca-canvas); outline: 0; }.compact-field { gap: 4px; }.compact-field input, .compact-field select { min-height: 44px; font-size: 12px; }
.batch-bar { display: flex; min-height: 62px; margin-top: 13px; padding: 8px 12px 8px 17px; align-items: center; justify-content: space-between; border: 1px solid rgba(159,41,37,.16); border-radius: 10px; background: rgba(159,41,37,.035); color: var(--ca-muted); font-size: 12px; }.batch-bar > div:first-child { display: flex; align-items: center; gap: 8px; }.selected-mark { display: grid; width: 25px; height: 25px; place-items: center; border-radius: 50%; background: var(--ca-red); color: white; }.batch-bar strong { color: var(--ca-red); }.batch-actions { display: flex; align-items: center; gap: 8px; }.batch-actions select { height: 42px; padding: 0 30px 0 12px; border: 1px solid var(--ca-border); border-radius: 8px; background: var(--ca-surface); color: var(--ca-ink-soft); font-size: 12px; }
.table-card { margin-top: 13px; overflow: hidden; }.table-scroll { overflow-x: auto; }.check-cell { width: 52px; text-align: center !important; }.check-box { display: inline-grid; width: 22px; height: 22px; padding: 0; place-items: center; border: 1px solid #cfc6b8; border-radius: 5px; background: white; color: white; }.check-box.checked { border-color: var(--ca-red); background: var(--ca-red); }.data-table tr.selected { background: rgba(159,41,37,.035); }.table-thumb { display: grid; width: 116px; height: 48px; place-items: center; overflow: hidden; border: 1px solid #ece6dc; border-radius: 6px; }.table-thumb img { max-width: 92%; max-height: 38px; }.data-table td > small { display: block; margin-top: 4px; color: var(--ca-quiet); font-size: 9px; }.record-id { color: var(--ca-ink); font-size: 11px; font-weight: 600; }.terminal-id { color: var(--ca-red); font-size: 11px; }.date-main { color: var(--ca-ink-soft); font-variant-numeric: tabular-nums; }.action-cell { width: 86px; text-align: right !important; }.view-button { display: inline-flex; min-height: 34px; padding: 0 10px; align-items: center; gap: 5px; border: 1px solid var(--ca-border); border-radius: 7px; background: var(--ca-surface); color: var(--ca-muted); font-size: 11px; }.view-button:hover { border-color: rgba(159,41,37,.28); color: var(--ca-red); }.table-footer { display: flex; height: 60px; padding: 0 16px 0 22px; align-items: center; justify-content: space-between; border-top: 1px solid var(--ca-border-light); color: var(--ca-quiet); font-size: 10px; }.table-footer div { display: flex; align-items: center; gap: 6px; }.table-footer button, .table-footer strong { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--ca-border); border-radius: 7px; background: var(--ca-surface); color: var(--ca-muted); }.table-footer strong { border-color: var(--ca-red); background: var(--ca-red); color: white; font-size: 11px; }.table-footer button:disabled { opacity: .35; }.retry { margin-top: 18px; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 30px; background: rgba(24,24,20,.64); backdrop-filter: blur(8px); }.detail-dialog { position: relative; width: min(1040px, 92vw); max-height: 90vh; padding: 30px 34px 34px; overflow: auto; border-radius: 24px; background: var(--ca-surface); box-shadow: var(--ca-shadow-dialog); }.dialog-close { position: absolute; top: 18px; right: 18px; z-index: 2; display: grid; width: 44px; height: 44px; padding: 0; place-items: center; border: 0; border-radius: 50%; background: #eee9e0; color: var(--ca-muted); }.detail-loading { display: grid; min-height: 380px; place-content: center; justify-items: center; color: var(--ca-muted); font-size: 12px; }.detail-loading .spinner { width: 28px; height: 28px; }.detail-head { display: flex; padding-right: 55px; align-items: flex-start; justify-content: space-between; }.detail-head p, .confirm-dialog > p { margin: 0 0 7px; color: var(--ca-red); font-size: 8px; font-weight: 600; letter-spacing: .25em; }.detail-head h2 { margin: 0; font: 500 30px var(--ca-font-display); letter-spacing: .1em; }.detail-body { display: grid; margin-top: 24px; grid-template-columns: 1.25fr .9fr; gap: 28px; }.large-preview { position: relative; display: grid; height: 300px; place-items: center; overflow: hidden; border: 1px solid var(--ca-border); border-radius: 12px; }.large-preview img { position: relative; z-index: 1; max-width: 85%; max-height: 190px; }.large-preview .watermark { position: absolute; top: 18px; left: 24px; color: rgba(159,41,37,.07); font: 700 90px var(--ca-font-display); }.large-preview small { position: absolute; right: 18px; bottom: 13px; color: var(--ca-quiet); font: 10px var(--ca-font-display); letter-spacing: .06em; }.download-row { display: flex; margin-top: 12px; flex-wrap: wrap; gap: 8px; }.download-row a { min-height: 40px; padding-inline: 12px; font-size: 11px; }.metadata-column { display: flex; flex-direction: column; }.metadata-column dl { display: grid; margin: 0; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--ca-border-light); border-left: 1px solid var(--ca-border-light); }.metadata-column dl div { min-height: 70px; padding: 12px; border-right: 1px solid var(--ca-border-light); border-bottom: 1px solid var(--ca-border-light); }.metadata-column dl .wide { grid-column: 1 / -1; }.metadata-column dt { margin-bottom: 7px; color: var(--ca-quiet); font-size: 9px; }.metadata-column dd { margin: 0; color: var(--ca-ink-soft); font-size: 12px; }.metadata-column .trace { overflow: hidden; color: var(--ca-quiet); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.detail-actions { display: flex; margin-top: auto; padding-top: 16px; flex-wrap: wrap; gap: 8px; }.detail-actions button { flex: 1 1 125px; }
.context-layer { z-index: 80; }.context-dialog { position: relative; width: min(650px, 92vw); padding: 34px 40px 38px; border-radius: 24px; background: var(--ca-surface); box-shadow: var(--ca-shadow-dialog); text-align: center; }.context-mark { display: grid; width: 56px; height: 56px; margin: 0 auto 12px; place-items: center; border-radius: 50%; background: rgba(159,41,37,.08); color: var(--ca-red); font: 500 22px var(--ca-font-display); }.context-dialog > p:not(.context-error) { margin: 0 0 7px; color: var(--ca-red); font-size: 8px; font-weight: 600; letter-spacing: .24em; }.context-dialog h2 { margin: 0 0 8px; font: 500 27px var(--ca-font-display); letter-spacing: .09em; }.context-dialog > span { color: var(--ca-muted); font-size: 11px; }.identity-options { display: grid; margin-top: 24px; grid-template-columns: repeat(5,1fr); gap: 6px; }.identity-options button { min-height: 42px; padding: 0 7px; border: 1px solid var(--ca-border); border-radius: 8px; background: var(--ca-canvas); color: var(--ca-muted); font-size: 10px; }.identity-options button.active { border-color: var(--ca-red); background: rgba(159,41,37,.06); color: var(--ca-red); }.context-fields { display: grid; margin-top: 18px; grid-template-columns: 1fr 1fr; gap: 13px; text-align: left; }.context-fields .wide { grid-column: 1 / -1; }.context-fields input { min-height: 48px; }.anonymous-context { margin-top: 18px; padding: 22px; border: 1px solid rgba(159,41,37,.12); border-radius: 10px; background: rgba(159,41,37,.025); color: var(--ca-muted); font-size: 12px; }.context-error { display: flex; margin: 14px 0 0; align-items: center; justify-content: center; gap: 7px; color: var(--ca-red); font-size: 11px; }.context-actions { display: grid; margin-top: 22px; grid-template-columns: 1fr 1.3fr; gap: 10px; }.context-actions button { min-height: 50px; }
.confirm-layer { z-index: 70; }.confirm-dialog { width: min(500px, 90vw); padding: 35px 40px 38px; border-radius: 22px; background: var(--ca-surface); box-shadow: var(--ca-shadow-dialog); text-align: center; }.confirm-mark { display: grid; width: 58px; height: 58px; margin: 0 auto 15px; place-items: center; border-radius: 50%; background: rgba(106,136,115,.11); color: var(--ca-green); font-size: 25px; }.confirm-mark.danger { background: rgba(159,41,37,.09); color: var(--ca-red); }.confirm-dialog h2 { margin: 8px 0 11px; font: 500 26px var(--ca-font-display); letter-spacing: .08em; }.confirm-dialog > span { display: block; color: var(--ca-muted); font-size: 12px; line-height: 1.7; }.confirm-dialog > div:last-child { display: grid; margin-top: 25px; grid-template-columns: 1fr 1.2fr; gap: 10px; }.confirm-dialog button { min-height: 50px; }
@media (max-width: 1400px) { .filter-bar { grid-template-columns: 1fr 170px 145px 145px; }.filter-bar > button { grid-row: 2; }.detail-body { grid-template-columns: 1fr; }.detail-dialog { max-width: 820px; }.large-preview { height: 250px; } }
.review-actions { display: flex; margin-top: 16px; padding: 14px; flex-wrap: wrap; gap: 8px; border: 1px solid rgba(159,41,37,.12); border-radius: 10px; background: rgba(159,41,37,.025); }.review-actions button { min-height: 42px; font-size: 11px; }
.review-layer { z-index: 80; }.review-dialog { width: min(520px, 90vw); padding: 34px 40px 38px; border-radius: 22px; background: var(--ca-surface); box-shadow: var(--ca-shadow-dialog); text-align: center; }.review-dialog > p:first-of-type { margin: 0 0 7px; color: var(--ca-red); font-size: 8px; font-weight: 600; letter-spacing: .24em; }.review-dialog h2 { margin: 0 0 10px; font: 500 26px var(--ca-font-display); letter-spacing: .08em; }.review-dialog > span { display: block; color: var(--ca-muted); font-size: 11px; line-height: 1.7; }.review-note-field { margin-top: 20px; text-align: left; }.review-note-field textarea { min-height: 92px; }.review-error { display: flex; margin: 12px 0 0; align-items: center; justify-content: center; gap: 7px; color: var(--ca-red); font-size: 11px; }.review-dialog-actions { display: grid; margin-top: 21px; grid-template-columns: 1fr 1.2fr; gap: 10px; }.review-dialog-actions button { min-height: 50px; }
</style>
