<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, formatDateTime } from '../api'
import AppIcon from '../components/AppIcon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import type { DashboardData } from '../types'

const loading = ref(true)
const error = ref('')
const data = ref<DashboardData | null>(null)

const bars = computed(() => {
  const source = new Map((data.value?.series || []).map((item) => [item.hour.slice(0, 13), item.count]))
  const values = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.now() - (23 - index) * 3600000)
    const key = date.toISOString().slice(0, 13)
    return { key, hour: new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false }).format(date), count: Number(source.get(key) || 0) }
  })
  const max = Math.max(1, ...values.map((item) => item.count))
  return values.map((item) => ({ ...item, height: Math.max(item.count ? 8 : 2, (item.count / max) * 100) }))
})

async function load() {
  loading.value = true
  error.value = ''
  try { data.value = await api<DashboardData>('/api/dashboard') }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '读取运行数据失败' }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">OVERVIEW</p><h1>运行总览</h1><p class="description">签名、明信片、打印设备与档案留存的实时概况</p></div>
      <div class="page-actions"><span class="updated">数据截至 {{ new Date().toLocaleTimeString('zh-CN', { hour12: false }) }}</span><button class="secondary-button" :disabled="loading" @click="load"><AppIcon name="refresh" />刷新数据</button></div>
    </div>
    <div v-if="loading" class="loading-line" />
    <div v-else-if="error" class="paper-card error-panel"><AppIcon name="warning" /><div><strong>暂时无法读取运行数据</strong><p>{{ error }}</p></div><button class="secondary-button" @click="load">重新加载</button></div>
    <template v-else-if="data">
      <div class="metrics-grid">
        <article class="metric-card paper-card"><div class="metric-index">01</div><p>今日新增签名</p><strong>{{ data.counts.today }}</strong><span>份</span><small>自今日 00:00 起</small></article>
        <article class="metric-card paper-card"><div class="metric-index">02</div><p>近七日采集</p><strong>{{ data.counts.week }}</strong><span>份</span><small>持续沉淀校园记忆</small></article>
        <article class="metric-card paper-card"><div class="metric-index">03</div><p>签名档案总量</p><strong>{{ data.counts.total }}</strong><span>份</span><small>其中 {{ data.counts.archived }} 份已归档</small></article>
        <article class="metric-card paper-card terminal-metric"><div class="metric-index">04</div><p>在线采集终端</p><strong>{{ data.terminals.online }}</strong><span>/ {{ data.terminals.total }}</span><small :class="{ warning: data.terminals.online < data.terminals.total }"><i />{{ data.terminals.online === data.terminals.total ? '所有终端运行正常' : '存在离线终端，请及时检查' }}</small></article>
        <article class="metric-card paper-card review-metric"><div class="metric-index">05</div><p>待审核签名</p><strong>{{ data.counts.pendingReview }}</strong><span>份</span><small><RouterLink to="/reviews">进入上墙审核 →</RouterLink></small></article>
        <article class="metric-card paper-card wall-metric"><div class="metric-index">06</div><p>当前上墙</p><strong>{{ data.counts.onWall }}</strong><span>份</span><small>已审核并公开展示</small></article>
        <article class="metric-card paper-card postcard-metric"><div class="metric-index">07</div><p>今日生成明信片</p><strong>{{ data.postcards.today }}</strong><span>份</span><small><RouterLink to="/postcards">累计 {{ data.postcards.total }} 份成品 →</RouterLink></small></article>
        <article class="metric-card paper-card print-metric"><div class="metric-index">08</div><p>等待打印</p><strong>{{ data.printJobs.waiting }}</strong><span>份</span><small :class="{ warning: data.printJobs.failed }">{{ data.printJobs.failed ? `${data.printJobs.failed} 份异常任务待处理` : `已完成 ${data.printJobs.succeeded} 份` }}</small></article>
      </div>

      <div class="dashboard-grid">
        <article class="chart-card paper-card">
          <header><div><p>24-HOUR ACTIVITY</p><h2>签名采集趋势</h2></div><span>每小时采集量</span></header>
          <div class="bar-chart">
            <div v-for="(bar, index) in bars" :key="bar.key" class="bar-column" :title="`${bar.hour}:00 · ${bar.count} 份`">
              <span v-if="bar.count" class="bar-value">{{ bar.count }}</span><i :style="{ height: `${bar.height}%` }" :class="{ highlighted: index >= 20 }" /><small v-if="index % 4 === 0 || index === 23">{{ bar.hour }}</small>
            </div>
          </div>
          <div class="chart-foot"><span><i />采集记录</span><span>时间（Asia/Shanghai）</span></div>
        </article>

        <article class="summary-card paper-card">
          <header><p>ARCHIVE HEALTH</p><h2>档案状态</h2></header>
          <div class="archive-ring" :style="{ '--ratio': `${Math.max(2, Math.round((data.counts.archived / Math.max(1, data.counts.total)) * 100))}%` }"><div><strong>{{ data.counts.total - data.counts.archived }}</strong><span>当前在库</span></div></div>
          <dl><div><dt><i class="active" />在库签名</dt><dd>{{ data.counts.total - data.counts.archived }}</dd></div><div><dt><i class="archived" />已归档</dt><dd>{{ data.counts.archived }}</dd></div></dl>
          <RouterLink to="/signatures" class="summary-link">查看全部签名档案 <span>→</span></RouterLink>
        </article>
      </div>

      <article class="recent-card paper-card">
        <header><div><p>RECENT SIGNATURES</p><h2>最近采集</h2></div><RouterLink to="/signatures">进入签名档案 <span>→</span></RouterLink></header>
        <div v-if="data.recent.length" class="recent-grid">
          <RouterLink v-for="item in data.recent" :key="item.id" :to="`/signatures?open=${item.id}`" class="recent-item">
            <div class="signature-thumb paper-grid"><img :src="item.thumbnailUrl" alt="签名缩略图" /></div>
            <div><strong class="mono">{{ item.id }}</strong><span>{{ formatDateTime(item.createdAt) }}</span></div><StatusBadge :status="item.status" />
          </RouterLink>
        </div>
        <div v-else class="empty-state compact"><div class="empty-mark">签</div><strong>尚无签名记录</strong><p>终端完成首份签名后将在这里显示</p></div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.updated { color: var(--ca-quiet); font-size: 10px; }.error-panel { display: flex; min-height: 110px; padding: 24px; align-items: center; gap: 16px; color: var(--ca-red); }.error-panel > svg { font-size: 28px; }.error-panel div { flex: 1; }.error-panel strong { color: var(--ca-ink); }.error-panel p { margin: 5px 0 0; color: var(--ca-muted); font-size: 12px; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }.metric-card { position: relative; min-height: 154px; padding: 22px 24px 19px; overflow: hidden; }.metric-card::after { content: ''; position: absolute; right: -34px; bottom: -53px; width: 112px; height: 112px; border: 1px solid rgba(159,41,37,.06); border-radius: 50%; box-shadow: 0 0 0 18px rgba(159,41,37,.018); }.metric-index { position: absolute; top: 16px; right: 18px; color: rgba(159,41,37,.25); font: 500 10px var(--ca-font-ui); letter-spacing: .1em; }.metric-card p { margin: 0 0 12px; color: var(--ca-muted); font-size: 12px; }.metric-card > strong { color: var(--ca-ink); font: 500 38px/1 var(--ca-font-display); }.metric-card > span { margin-left: 5px; color: var(--ca-quiet); font-size: 12px; }.metric-card > small { position: relative; z-index: 1; display: block; margin-top: 16px; color: var(--ca-quiet); font-size: 10px; }.terminal-metric > small { color: #5d7964; }.terminal-metric > small i { display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: var(--ca-green); }.terminal-metric > small.warning { color: var(--ca-red); }.terminal-metric > small.warning i { background: var(--ca-red); }
.dashboard-grid { display: grid; margin-top: 16px; grid-template-columns: minmax(0, 1.8fr) minmax(270px, .7fr); gap: 16px; }.chart-card, .summary-card, .recent-card { padding: 22px 24px; }.chart-card header, .recent-card header { display: flex; align-items: flex-start; justify-content: space-between; }.chart-card header p, .summary-card header p, .recent-card header p { margin: 0 0 6px; color: var(--ca-red); font-size: 8px; font-weight: 600; letter-spacing: .22em; }.chart-card h2, .summary-card h2, .recent-card h2 { margin: 0; font: 500 20px var(--ca-font-display); letter-spacing: .09em; }.chart-card header > span { color: var(--ca-quiet); font-size: 10px; }
.bar-chart { display: flex; height: 192px; margin: 25px 0 6px; align-items: flex-end; gap: 5px; border-bottom: 1px solid var(--ca-border-light); background-image: linear-gradient(to bottom, rgba(221,214,202,.6) 1px, transparent 1px); background-size: 100% 48px; }.bar-column { position: relative; display: flex; height: 100%; flex: 1; align-items: flex-end; justify-content: center; }.bar-column > i { display: block; width: min(16px, 70%); min-height: 2px; border-radius: 4px 4px 0 0; background: rgba(159,41,37,.35); transition: height .4s ease; }.bar-column > i.highlighted { background: var(--ca-red); }.bar-column small { position: absolute; bottom: -20px; color: var(--ca-quiet); font-size: 8px; }.bar-value { position: absolute; bottom: calc(var(--height) + 4px); margin-bottom: 4px; color: var(--ca-muted); font-size: 8px; }.chart-foot { display: flex; margin-top: 25px; justify-content: space-between; color: var(--ca-quiet); font-size: 8px; }.chart-foot span:first-child { display: flex; align-items: center; gap: 6px; }.chart-foot i { width: 13px; height: 4px; border-radius: 3px; background: var(--ca-red); }
.summary-card { display: flex; flex-direction: column; }.archive-ring { display: grid; width: 132px; height: 132px; margin: 18px auto 14px; place-items: center; border-radius: 50%; background: conic-gradient(var(--ca-red) var(--ratio), #e5ded2 0); }.archive-ring::before { content: ''; grid-area: 1/1; width: 104px; height: 104px; border-radius: 50%; background: var(--ca-surface); }.archive-ring div { position: relative; z-index: 1; display: flex; flex-direction: column; text-align: center; }.archive-ring strong { font: 500 30px var(--ca-font-display); }.archive-ring span { color: var(--ca-quiet); font-size: 9px; }.summary-card dl { margin: 0; }.summary-card dl div { display: flex; padding: 8px 0; justify-content: space-between; border-bottom: 1px solid rgba(221,214,202,.55); font-size: 11px; }.summary-card dt { display: flex; align-items: center; gap: 8px; color: var(--ca-muted); }.summary-card dt i { width: 7px; height: 7px; border-radius: 50%; }.summary-card dt i.active { background: var(--ca-red); }.summary-card dt i.archived { background: #b3aa9d; }.summary-card dd { margin: 0; color: var(--ca-ink); font-variant-numeric: tabular-nums; }.summary-link { display: flex; margin-top: auto; padding-top: 14px; justify-content: space-between; color: var(--ca-red); font-size: 11px; }
.recent-card { margin-top: 16px; }.recent-card header a { color: var(--ca-red); font-size: 11px; }.recent-grid { display: grid; margin-top: 18px; grid-template-columns: repeat(3, 1fr); gap: 10px; }.recent-item { display: grid; min-width: 0; padding: 9px; grid-template-columns: 100px minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 1px solid var(--ca-border-light); border-radius: 10px; background: rgba(255,255,255,.45); }.recent-item:hover { border-color: rgba(159,41,37,.2); }.signature-thumb { display: grid; width: 100px; height: 48px; place-items: center; overflow: hidden; border: 1px solid #eee8df; border-radius: 6px; }.signature-thumb img { max-width: 90%; max-height: 38px; }.recent-item > div:nth-child(2) { display: flex; min-width: 0; flex-direction: column; gap: 5px; }.recent-item strong { overflow: hidden; color: var(--ca-ink-soft); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.recent-item span { color: var(--ca-quiet); font-size: 9px; }.compact { min-height: 180px; }
@media (max-width: 1350px) { .metrics-grid { grid-template-columns: repeat(2, 1fr); }.recent-grid { grid-template-columns: repeat(2, 1fr); } }
.metrics-grid { grid-template-columns: repeat(4, 1fr); }.review-metric small a, .postcard-metric small a { color: var(--ca-red); }.wall-metric > small, .print-metric > small { color: #5d7964; }.print-metric > small.warning { color: var(--ca-red); }
@media (max-width: 1600px) { .metrics-grid { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 1350px) { .metrics-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
