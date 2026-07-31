<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, formatDateTime } from '../api'
import AppIcon from '../components/AppIcon.vue'
import type { AuditLog, Pagination } from '../types'

const items = ref<AuditLog[]>([])
const pagination = ref<Pagination>({ page: 1, pageSize: 30, total: 0, pages: 1 })
const action = ref('')
const loading = ref(true)
const error = ref('')

const actionLabels: Record<string, string> = {
  'auth.login': '登录系统', 'auth.logout': '退出登录', 'auth.login_failed': '登录失败', 'signature.ingest': '接收签名',
  'signature.export': '导出签名', 'signature.batch_export': '批量导出', 'signature.report_export': '导出报表',
  'signature.batch_archive': '批量归档', 'signature.batch_restore': '恢复签名', 'signature.batch_delete': '移至回收',
  'signature.context_update': '修改人员信息',
  'signature.review_approve': '审核通过并上墙', 'signature.review_reject': '驳回签名',
  'signature.review_hide': '签名下墙', 'signature.review_publish': '重新上墙',
  'signature.auto_archive': '自动归档', 'signature.purge': '永久清理', 'signature.auto_purge': '自动清理',
  'print_job.push': '推送打印任务', 'print_job.pause': '暂停打印任务', 'print_job.resume': '恢复打印任务',
  'print_job.retry': '重试打印任务', 'print_job.cancel': '取消打印任务', 'print_job.archive': '归档打印任务',
  'settings.update': '更新设置', 'user.create': '创建账号', 'user.update': '更新账号',
}

async function load(reset = false) {
  if (reset) pagination.value.page = 1
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: String(pagination.value.page), pageSize: String(pagination.value.pageSize) })
    if (action.value) params.set('action', action.value)
    const result = await api<{ items: AuditLog[]; pagination: Pagination }>(`/api/audit-logs?${params}`)
    items.value = result.items; pagination.value = result.pagination
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '读取审计日志失败' }
  finally { loading.value = false }
}

function changePage(page: number) { pagination.value.page = page; load() }
onMounted(load)
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">AUDIT TRAIL</p><h1>审计日志</h1><p class="description">追溯登录、同步、导出、归档、删除和配置变更记录</p></div><div class="page-actions"><button class="secondary-button" :disabled="loading" @click="load()"><AppIcon name="refresh" />刷新日志</button></div></div>
    <form class="audit-filter paper-card" @submit.prevent="load(true)"><div class="search-field"><AppIcon name="search" /><input v-model="action" placeholder="按操作代码筛选，例如 signature.export" /></div><button class="primary-button">查询日志</button><button type="button" class="ghost-button" @click="action = ''; load(true)">重置</button></form>
    <article class="audit-card paper-card">
      <div v-if="loading" class="loading-line" />
      <div v-if="error" class="empty-state"><div class="empty-mark">!</div><strong>日志读取失败</strong><p>{{ error }}</p></div>
      <div v-else-if="!items.length" class="empty-state"><div class="empty-mark">审</div><strong>暂无审计记录</strong><p>系统操作发生后将在此留痕</p></div>
      <table v-else class="data-table"><thead><tr><th>时间</th><th>操作者</th><th>操作</th><th>对象类型</th><th>对象编号</th><th>来源地址</th><th>操作详情</th></tr></thead><tbody><tr v-for="item in items" :key="item.id"><td><span class="date-main">{{ formatDateTime(item.createdAt).slice(0, 10) }}</span><small>{{ formatDateTime(item.createdAt).slice(11) }}</small></td><td><strong>{{ item.username }}</strong></td><td><span class="action-label">{{ actionLabels[item.action] || item.action }}</span><small class="mono">{{ item.action }}</small></td><td>{{ item.entityType }}</td><td class="mono entity-id">{{ item.entityId || '—' }}</td><td class="mono">{{ item.ipAddress || '—' }}</td><td><details><summary>查看详情</summary><pre>{{ JSON.stringify(item.detail, null, 2) }}</pre></details></td></tr></tbody></table>
      <footer v-if="items.length" class="table-footer"><span>共 {{ pagination.total }} 条审计记录</span><div><button :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">‹</button><strong>{{ pagination.page }}</strong><button :disabled="pagination.page >= pagination.pages" @click="changePage(pagination.page + 1)">›</button></div></footer>
    </article>
  </section>
</template>

<style scoped>
.audit-filter { display: grid; padding: 13px; grid-template-columns: minmax(320px, 1fr) auto auto; gap: 9px; }.search-field { position: relative; }.search-field svg { position: absolute; top: 13px; left: 12px; color: var(--ca-quiet); }.search-field input { width: 100%; height: 44px; padding: 0 14px 0 39px; border: 1px solid var(--ca-border); border-radius: 8px; background: var(--ca-canvas); outline: 0; }.audit-card { margin-top: 13px; overflow: hidden; }.data-table td > small { display: block; margin-top: 4px; color: var(--ca-quiet); font-size: 8px; }.date-main { font-variant-numeric: tabular-nums; }.action-label { color: var(--ca-ink); }.entity-id { max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }details { position: relative; }summary { color: var(--ca-red); font-size: 10px; cursor: pointer; }pre { position: absolute; right: 0; z-index: 5; width: 300px; max-height: 180px; margin: 8px 0 0; padding: 12px; overflow: auto; border: 1px solid var(--ca-border); border-radius: 8px; background: var(--ca-canvas); box-shadow: var(--ca-shadow-control); color: var(--ca-ink-soft); font-size: 9px; }.table-footer { display: flex; height: 60px; padding: 0 16px 0 22px; align-items: center; justify-content: space-between; border-top: 1px solid var(--ca-border-light); color: var(--ca-quiet); font-size: 10px; }.table-footer div { display: flex; align-items: center; gap: 6px; }.table-footer button, .table-footer strong { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--ca-border); border-radius: 7px; background: var(--ca-surface); color: var(--ca-muted); }.table-footer strong { border-color: var(--ca-red); background: var(--ca-red); color: white; }.table-footer button:disabled { opacity: .35; }
</style>
