<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, downloadGet, formatDateTime } from '../api'
import AppIcon from '../components/AppIcon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useAuthStore } from '../stores/auth'
import type { Pagination, PostcardItem, PostcardTemplateItem, PrintJobItem } from '../types'
import { createQrDataUrl } from '../utils/qrcode'

const auth = useAuthStore()
const tab = ref<'archive' | 'print' | 'templates'>('archive')
const loading = ref(true)
const error = ref('')
const toast = ref('')
const keyword = ref('')
const status = ref('')
const postcards = ref<PostcardItem[]>([])
const jobs = ref<PrintJobItem[]>([])
const jobCounts = ref<Record<string, number>>({})
const templates = ref<PostcardTemplateItem[]>([])
const stats = ref({
  counts: { total: 0, today: 0, archived: 0 },
  popularTemplates: [] as Array<{ id: string; name: string; count: number }>,
  hourly: [] as Array<{ hour: string; count: number }>,
})
const pagination = ref<Pagination>({ page: 1, pageSize: 24, total: 0, pages: 1 })
const preview = ref<PostcardItem | null>(null)
const pickupQrDataUrl = ref('')
const pushCopies = ref(1)
const pushing = ref(false)
const createOpen = ref(false)
const creating = ref(false)
const custom = reactive({ group: '自定义模板', name: '', year: 'MEMORY', title: '三中记忆', subtitle: '一纸寄湖山 · 一念念三中', background: '#f0e8db', ink: '#30312d', accent: '#9f2925', muted: '#84786b', motif: 'stamp' })
const failedJobs = computed(() => Number(jobCounts.value.failed || 0))
const waitingJobs = computed(() => Number(jobCounts.value.created || 0) + Number(jobCounts.value.queued || 0) + Number(jobCounts.value.paused || 0))

function notify(message: string) { toast.value = message; window.setTimeout(() => { toast.value = '' }, 2400) }
function openPreview(item: PostcardItem) {
  preview.value = item
  pushCopies.value = 1
  try {
    pickupQrDataUrl.value = createQrDataUrl(new URL(item.pickupUrl, location.origin).toString(), 320)
  } catch {
    pickupQrDataUrl.value = ''
  }
}
async function downloadPostcard(item: PostcardItem, format: 'png' | 'jpg') {
  try {
    await downloadGet(`/api/postcards/${encodeURIComponent(item.id)}/file/${format}?download=1`, `${item.id}.${format}`)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '成品下载失败'
  }
}
function downloadPickupQr(item: PostcardItem) {
  if (!pickupQrDataUrl.value) return
  const anchor = document.createElement('a')
  anchor.href = pickupQrDataUrl.value
  anchor.download = `${item.id}-取件二维码.png`
  anchor.click()
}
async function loadPostcards(page = 1) {
  const params = new URLSearchParams({ page: String(page), pageSize: '24' })
  if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
  if (status.value) params.set('status', status.value)
  const result = await api<{ items: PostcardItem[]; pagination: Pagination }>(`/api/postcards?${params}`)
  postcards.value = result.items; pagination.value = result.pagination
}
async function loadJobs() {
  const result = await api<{ items: PrintJobItem[]; counts: Record<string, number> }>('/api/print-jobs')
  jobs.value = result.items; jobCounts.value = result.counts
}
async function loadTemplates() { templates.value = (await api<{ items: PostcardTemplateItem[] }>('/api/postcard-templates')).items }
async function loadStats() { stats.value = await api<typeof stats.value>('/api/postcard-stats') }
async function load() {
  loading.value = true; error.value = ''
  try { await Promise.all([loadPostcards(), loadJobs(), loadTemplates(), loadStats()]) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '明信片业务数据读取失败' }
  finally { loading.value = false }
}
async function batch(item: PostcardItem, action: 'archive' | 'restore' | 'delete') {
  if (!auth.canWrite) return
  await api('/api/postcards/batch', { method: 'POST', body: JSON.stringify({ ids: [item.id], action }) })
  notify(action === 'archive' ? '明信片已归档' : action === 'restore' ? '明信片已恢复在库' : '明信片已进入回收记录')
  preview.value = null; await loadPostcards(pagination.value.page)
}
async function jobAction(job: PrintJobItem, action: 'pause' | 'resume' | 'retry' | 'cancel' | 'archive') {
  try {
    await api(`/api/print-jobs/${encodeURIComponent(job.id)}/action`, { method: 'POST', body: JSON.stringify({ action }) })
    notify('打印任务状态已更新'); await loadJobs()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '任务操作失败' }
}
async function pushPrint(item: PostcardItem) {
  if (!auth.canWrite || item.status === 'deleted' || pushing.value) return
  pushing.value = true; error.value = ''
  try {
    await api(`/api/postcards/${encodeURIComponent(item.id)}/print`, {
      method: 'POST',
      body: JSON.stringify({ copies: Math.max(1, Math.min(10, Number(pushCopies.value || 1))) }),
    })
    preview.value = null
    tab.value = 'print'
    notify('打印任务已推送到明信片终端')
    await loadJobs()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '推送打印失败'
  } finally {
    pushing.value = false
  }
}
async function toggleTemplate(item: PostcardTemplateItem) {
  if (!auth.isAdmin) return
  const next = !item.enabled
  await api(`/api/postcard-templates/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ enabled: next, order: item.order }) })
  item.enabled = next; notify(next ? '模板已上架' : '模板已下架')
}
async function createTemplate() {
  creating.value = true; error.value = ''
  try {
    await api('/api/postcard-templates', { method: 'POST', body: JSON.stringify(custom) })
    createOpen.value = false; custom.name = ''; notify('自定义模板已创建'); await loadTemplates()
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '模板创建失败' }
  finally { creating.value = false }
}
onMounted(load)
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">ALUMNI POSTCARD</p><h1>校友明信片</h1><p class="description">统一管理成品档案、打印任务与终端模板；签名仍来自签名档案</p></div><div class="page-actions"><button class="secondary-button" @click="load"><AppIcon name="refresh" />刷新</button><button v-if="auth.isAdmin && tab==='templates'" class="primary-button" @click="createOpen=true"><AppIcon name="plus" />新增模板</button></div></div>
    <nav class="business-tabs"><button :class="{active:tab==='archive'}" @click="tab='archive'">成品档案 <span>{{ pagination.total }}</span></button><button :class="{active:tab==='print'}" @click="tab='print'">打印队列 <span :class="{danger:failedJobs}">{{ waitingJobs + failedJobs }}</span></button><button :class="{active:tab==='templates'}" @click="tab='templates'">模板管理 <span>{{ templates.length }}</span></button></nav>
    <div v-if="loading" class="loading-line" />
    <p v-else-if="error" class="page-error"><AppIcon name="warning" />{{ error }}</p>

    <template v-if="!loading && tab==='archive'">
      <div class="postcard-stats"><article class="paper-card"><span>今日生成</span><b>{{ stats.counts.today }}</b><small>份</small></article><article class="paper-card"><span>成品总量</span><b>{{ stats.counts.total }}</b><small>份</small></article><article class="paper-card"><span>已归档</span><b>{{ stats.counts.archived }}</b><small>份</small></article><article class="paper-card popular-stat"><span>热门模板</span><b>{{ stats.popularTemplates[0]?.name || '暂无数据' }}</b><small>{{ stats.popularTemplates[0]?.count || 0 }} 次使用</small></article></div>
      <form class="archive-toolbar paper-card" @submit.prevent="loadPostcards(1)"><div class="field search-field"><AppIcon name="search" /><input v-model="keyword" placeholder="明信片编号、署名、签名编号或正文关键词" /></div><select v-model="status"><option value="">在库与归档</option><option value="active">仅在库</option><option value="archived">仅归档</option><option value="deleted">回收记录</option></select><button class="primary-button">查询</button></form>
      <div v-if="!postcards.length" class="empty-state paper-card"><span class="empty-mark">笺</span><strong>暂无明信片成品</strong><p>终端完成制作并同步后会显示在这里</p></div>
      <div v-else class="postcard-grid">
        <article v-for="item in postcards" :key="item.id" class="postcard-card paper-card"><button class="postcard-image" @click="openPreview(item)"><img :src="item.previewUrl" alt="明信片缩略图" /><span>查看高清成品</span></button><div class="postcard-meta"><div><b>{{ item.sender || '匿名校友' }}</b><small>{{ item.templateName || item.templateId }} · {{ item.graduationYear ? `${item.graduationYear}届` : '未登记届别' }}</small></div><StatusBadge :status="item.status" /></div><p>{{ item.message || '未填写明信片正文' }}</p><footer><span class="mono">{{ item.id }}</span><time>{{ formatDateTime(item.createdAt) }}</time></footer></article>
      </div>
      <footer v-if="pagination.pages>1" class="pagination"><span>第 {{ pagination.page }} / {{ pagination.pages }} 页</span><div><button :disabled="pagination.page<=1" @click="loadPostcards(pagination.page-1)">上一页</button><button :disabled="pagination.page>=pagination.pages" @click="loadPostcards(pagination.page+1)">下一页</button></div></footer>
    </template>

    <template v-if="!loading && tab==='print'">
      <div class="queue-metrics"><article class="paper-card"><span>等待处理</span><b>{{ waitingJobs }}</b><small>份</small></article><article class="paper-card"><span>正在打印</span><b>{{ jobCounts.processing || 0 }}</b><small>份</small></article><article class="paper-card" :class="{danger:failedJobs}"><span>异常任务</span><b>{{ failedJobs }}</b><small>份</small></article><article class="paper-card"><span>今日记录</span><b>{{ jobs.length }}</b><small>条</small></article></div>
      <div class="paper-card table-wrap"><table class="data-table"><thead><tr><th>成品</th><th>任务编号</th><th>终端 / 打印机</th><th>份数</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="job in jobs" :key="job.id"><td><img class="job-thumb" :src="job.previewUrl" alt="" /></td><td><b class="mono">{{ job.id }}</b><small class="subline">{{ job.postcardId }}</small></td><td>{{ job.terminalId }}<small class="subline">{{ job.printerName || '等待终端上报' }}</small></td><td>{{ job.copies }}</td><td>{{ formatDateTime(job.createdAt) }}</td><td><StatusBadge :status="job.status" /><small v-if="job.errorMessage" class="job-error">{{ job.errorMessage }}</small></td><td><div v-if="auth.canWrite" class="row-actions"><button v-if="job.status==='queued'" @click="jobAction(job,'pause')">暂停</button><button v-if="job.status==='paused'" @click="jobAction(job,'resume')">恢复</button><button v-if="job.status==='failed'" @click="jobAction(job,'retry')">重试</button><button v-if="['created','queued','paused','failed'].includes(job.status)" @click="jobAction(job,'cancel')">取消</button><button v-if="job.status==='succeeded'" @click="jobAction(job,'archive')">归档</button></div><span v-else class="muted">只读</span></td></tr></tbody></table><div v-if="!jobs.length" class="empty-state"><span class="empty-mark">印</span><strong>暂无打印任务</strong></div></div>
    </template>

    <template v-if="!loading && tab==='templates'">
      <div class="template-note paper-card"><AppIcon name="postcard" /><div><b>终端每次启动及恢复联网时读取这里的模板配置</b><span>下架不会删除历史成品；只读审计员仅可查看。</span></div></div>
      <div class="template-grid"><article v-for="item in templates" :key="item.id" class="template-card paper-card" :class="{disabled:!item.enabled}"><div class="template-preview" :style="{background:item.background,color:item.ink}"><span :style="{color:item.accent}">{{ item.year }}</span><b>{{ item.title }}</b><small :style="{color:item.muted}">{{ item.subtitle }}</small><i :style="{borderColor:item.accent,color:item.accent}">淳</i></div><footer><div><b>{{ item.name }}</b><span>{{ item.group }} · 排序 {{ item.order }}</span></div><button v-if="auth.isAdmin" :class="item.enabled?'danger-button':'primary-button'" @click="toggleTemplate(item)">{{ item.enabled ? '下架' : '上架' }}</button><StatusBadge v-else :status="item.enabled?'active':'disabled'" /></footer></article></div>
    </template>

    <div v-if="preview" class="dialog-backdrop" @click.self="preview=null">
      <section class="preview-dialog">
        <button class="dialog-close" @click="preview=null"><AppIcon name="close" /></button>
        <p>POSTCARD ARCHIVE</p>
        <h2>{{ preview.id }}</h2>
        <div class="preview-main">
          <img :src="preview.imageUrl" alt="明信片高清预览" />
          <aside class="pickup-panel">
            <img v-if="pickupQrDataUrl" :src="pickupQrDataUrl" alt="手机取件二维码" />
            <div v-else class="qr-unavailable">二维码暂不可用</div>
            <b>扫码下载成品</b>
            <small>二维码打开后台取件页，可下载 PNG 或 JPG</small>
            <button class="secondary-button" :disabled="!pickupQrDataUrl" @click="downloadPickupQr(preview)">下载二维码</button>
          </aside>
        </div>
        <dl><div><dt>署名</dt><dd>{{ preview.sender || '匿名校友' }}</dd></div><div><dt>关联签名</dt><dd>{{ preview.signatureId || '未关联' }}</dd></div><div><dt>模板</dt><dd>{{ preview.templateName || preview.templateId }}</dd></div><div><dt>采集终端</dt><dd>{{ preview.terminalId }}</dd></div></dl>
        <div class="download-actions">
          <span>本地下载</span>
          <button class="secondary-button" @click="downloadPostcard(preview,'png')"><AppIcon name="download" />下载 PNG</button>
          <button class="secondary-button" @click="downloadPostcard(preview,'jpg')"><AppIcon name="download" />下载 JPG</button>
        </div>
        <div v-if="auth.canWrite" class="dialog-actions">
          <label v-if="preview.status!=='deleted'" class="push-copies">打印份数 <input v-model.number="pushCopies" type="number" min="1" max="10" /></label>
          <button v-if="preview.status!=='deleted'" class="primary-button" :disabled="pushing" @click="pushPrint(preview)">{{ pushing ? '正在推送…' : '推送打印' }}</button>
          <button v-if="preview.status==='active'" class="secondary-button" @click="batch(preview,'archive')">归档</button>
          <button v-if="preview.status!=='active'" class="secondary-button" @click="batch(preview,'restore')">恢复在库</button>
          <button v-if="preview.status!=='deleted'" class="danger-button" @click="batch(preview,'delete')">进入回收记录</button>
        </div>
      </section>
    </div>
    <div v-if="createOpen" class="dialog-backdrop" @click.self="createOpen=false"><form class="create-dialog" @submit.prevent="createTemplate"><p>CUSTOM TEMPLATE</p><h2>新增自定义模板</h2><div class="form-grid"><div class="field"><label>模板名称</label><input v-model="custom.name" required maxlength="40" /></div><div class="field"><label>分组</label><input v-model="custom.group" maxlength="30" /></div><div class="field"><label>年代标识</label><input v-model="custom.year" maxlength="20" /></div><div class="field"><label>主标题</label><input v-model="custom.title" maxlength="40" /></div><div class="field wide"><label>副标题</label><input v-model="custom.subtitle" maxlength="80" /></div><div class="field"><label>纸张颜色</label><input v-model="custom.background" type="color" /></div><div class="field"><label>学校红</label><input v-model="custom.accent" type="color" /></div><div class="field wide"><label>底纹</label><select v-model="custom.motif"><option value="stamp">印章</option><option value="grid">细网格</option><option value="rings">年轮</option><option value="mountain">湖山</option><option value="window">校窗</option></select></div></div><div class="dialog-actions"><button type="button" class="secondary-button" @click="createOpen=false">取消</button><button class="primary-button" :disabled="creating">{{ creating?'正在创建…':'创建模板' }}</button></div></form></div>
    <div v-if="toast" class="toast"><AppIcon name="check" />{{ toast }}</div>
  </section>
</template>

<style scoped>
.business-tabs{display:flex;margin-bottom:16px;gap:6px}.business-tabs button{min-height:43px;padding:0 17px;border:0;border-radius:8px;background:transparent;color:var(--ca-muted)}.business-tabs button.active{background:var(--ca-surface);color:var(--ca-red);box-shadow:0 4px 14px rgba(66,52,33,.05)}.business-tabs span{display:inline-grid;min-width:23px;height:20px;margin-left:6px;padding:0 5px;place-items:center;border-radius:10px;background:#e8e1d6;font-size:9px}.business-tabs span.danger{background:#f1dfdc;color:var(--ca-red)}.page-error{display:flex;padding:13px;align-items:center;gap:8px;border-radius:8px;background:#f7e9e6;color:var(--ca-red)}.archive-toolbar{display:grid;margin-bottom:15px;padding:13px;grid-template-columns:1fr 170px 100px;gap:10px}.search-field{position:relative}.search-field svg{position:absolute;z-index:1;top:13px;left:14px;color:var(--ca-quiet)}.search-field input{padding-left:42px}.archive-toolbar select{border:1px solid var(--ca-border);border-radius:8px;background:var(--ca-canvas);padding:0 12px}.postcard-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.postcard-card{padding:10px}.postcard-image{position:relative;display:block;width:100%;padding:0;overflow:hidden;border:0;background:#eee7db}.postcard-image img{display:block;width:100%;aspect-ratio:148/105;object-fit:cover}.postcard-image>span{position:absolute;inset:auto 0 0;padding:22px 8px 8px;background:linear-gradient(transparent,rgba(30,29,25,.7));color:white;font-size:8px;opacity:0}.postcard-image:hover span{opacity:1}.postcard-meta{display:flex;margin-top:11px;align-items:center;justify-content:space-between;gap:8px}.postcard-meta>div{display:grid;gap:3px}.postcard-meta b{font:500 15px var(--ca-font-display)}.postcard-meta small{color:var(--ca-quiet);font-size:8px}.postcard-card>p{height:34px;margin:10px 0;color:var(--ca-muted);font:10px/1.7 var(--ca-font-display);overflow:hidden}.postcard-card>footer{display:flex;padding-top:8px;align-items:center;justify-content:space-between;border-top:1px solid var(--ca-border-light);color:var(--ca-quiet);font-size:7px}.pagination{display:flex;height:60px;align-items:center;justify-content:space-between;color:var(--ca-quiet);font-size:10px}.pagination div{display:flex;gap:7px}.pagination button{min-height:36px;padding:0 13px;border:1px solid var(--ca-border);border-radius:6px;background:var(--ca-surface)}.queue-metrics{display:grid;margin-bottom:14px;grid-template-columns:repeat(4,1fr);gap:12px}.queue-metrics article{display:flex;min-height:83px;padding:16px;align-items:baseline}.queue-metrics span{margin-right:auto;color:var(--ca-muted);font-size:10px}.queue-metrics b{color:var(--ca-green);font:30px Georgia}.queue-metrics article.danger b{color:var(--ca-red)}.queue-metrics small{margin-left:4px;color:var(--ca-quiet)}.table-wrap{overflow:hidden}.job-thumb{width:76px;height:48px;object-fit:cover}.subline{display:block;margin-top:4px;color:var(--ca-quiet);font-size:8px}.job-error{display:block;max-width:160px;margin-top:4px;color:var(--ca-red);font-size:8px}.row-actions{display:flex;flex-wrap:wrap;gap:4px}.row-actions button{min-height:30px;padding:0 8px;border:1px solid var(--ca-border);border-radius:5px;background:var(--ca-canvas);font-size:8px}.template-note{display:flex;margin-bottom:14px;padding:16px;align-items:center;gap:12px;color:var(--ca-green)}.template-note>div{display:grid;gap:4px;color:var(--ca-ink)}.template-note span{color:var(--ca-muted);font-size:9px}.template-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.template-card{padding:9px}.template-card.disabled{opacity:.58}.template-preview{position:relative;display:grid;aspect-ratio:148/88;padding:16px;align-content:end;overflow:hidden}.template-preview>span{position:absolute;top:10px;right:12px;font:11px Georgia}.template-preview>b{font:21px var(--ca-font-display);letter-spacing:.08em}.template-preview>small{margin-top:5px;font-size:8px}.template-preview>i{position:absolute;top:11px;left:11px;display:grid;width:35px;height:35px;place-items:center;border:3px double;font:15px var(--ca-font-display);font-style:normal;opacity:.55}.template-card>footer{display:flex;padding:12px 4px 3px;align-items:center;justify-content:space-between}.template-card>footer>div{display:grid;gap:4px}.template-card>footer>div>span{color:var(--ca-quiet);font-size:8px}.template-card button{min-height:34px;padding-inline:11px;font-size:9px}.dialog-backdrop{position:fixed;inset:0;z-index:60;display:grid;padding:30px;place-items:center;background:rgba(24,24,20,.64);backdrop-filter:blur(8px)}.preview-dialog,.create-dialog{position:relative;width:min(900px,92vw);padding:28px 32px;border-radius:20px;background:var(--ca-surface);box-shadow:var(--ca-shadow-dialog)}.dialog-close{position:absolute;top:14px;right:14px;display:grid;width:42px;height:42px;place-items:center;border:0;border-radius:50%;background:#eee8de}.preview-dialog>p,.create-dialog>p{margin:0;color:var(--ca-red);font-size:8px;letter-spacing:.23em}.preview-dialog h2,.create-dialog h2{margin:6px 0 18px;font:500 24px var(--ca-font-display)}.preview-dialog>img{display:block;width:100%;max-height:58vh;object-fit:contain;background:#eee8dd}.preview-dialog dl{display:grid;margin:14px 0 0;grid-template-columns:repeat(4,1fr)}.preview-dialog dl div{padding:10px;border:1px solid var(--ca-border-light)}.preview-dialog dt{color:var(--ca-quiet);font-size:8px}.preview-dialog dd{margin:4px 0 0;font-size:10px}.dialog-actions{display:flex;margin-top:16px;justify-content:flex-end;gap:8px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.form-grid .wide{grid-column:1/-1}.form-grid select{min-height:44px;border:1px solid var(--ca-border);border-radius:8px;background:var(--ca-canvas);padding:0 10px}
@media(max-width:1400px){.postcard-grid,.template-grid{grid-template-columns:repeat(3,1fr)}}
.postcard-stats{display:grid;margin-bottom:12px;grid-template-columns:repeat(4,1fr);gap:10px}.postcard-stats article{display:flex;min-height:72px;padding:14px;align-items:baseline}.postcard-stats span{margin-right:auto;color:var(--ca-muted);font-size:9px}.postcard-stats b{color:var(--ca-green);font:27px Georgia}.postcard-stats small{margin-left:4px;color:var(--ca-quiet);font-size:8px}.postcard-stats .popular-stat{display:grid;grid-template-columns:1fr auto;align-content:center}.postcard-stats .popular-stat b{grid-row:1/3;grid-column:2;font:500 16px var(--ca-font-display)}.postcard-stats .popular-stat small{margin:5px 0 0}
.dialog-actions{align-items:center}.push-copies{display:flex;min-height:42px;padding:0 10px;align-items:center;gap:8px;border:1px solid var(--ca-border);border-radius:8px;color:var(--ca-muted);font-size:9px}.push-copies input{width:52px;height:30px;border:0;border-left:1px solid var(--ca-border-light);background:transparent;text-align:center}
.preview-main{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:16px;align-items:center}.preview-main>img{display:block;width:100%;max-height:48vh;object-fit:contain;background:#eee8dd}.pickup-panel{display:grid;padding:13px;justify-items:center;gap:8px;border:1px solid var(--ca-border);border-radius:10px;background:var(--ca-canvas);text-align:center}.pickup-panel>img,.qr-unavailable{width:148px;height:148px;background:white}.qr-unavailable{display:grid;place-items:center;color:var(--ca-quiet);font-size:9px}.pickup-panel b{font:500 15px var(--ca-font-display)}.pickup-panel small{color:var(--ca-quiet);font-size:8px;line-height:1.55}.pickup-panel button{width:100%;min-height:36px}.download-actions{display:flex;margin-top:12px;padding:10px 12px;align-items:center;gap:8px;border-radius:8px;background:#f2ede4}.download-actions>span{margin-right:auto;color:var(--ca-muted);font-size:9px}.download-actions button{display:flex;min-height:36px;align-items:center;gap:5px;font-size:9px}
</style>
