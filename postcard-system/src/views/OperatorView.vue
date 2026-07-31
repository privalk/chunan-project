<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { postcardTemplates } from '../data/templates'
import { usePrintQueueStore } from '../stores/printQueue'
import { getSettings, saveSettings } from '../utils/storage'
import type { LocalSettings } from '../types'

const queue = usePrintQueueStore()
const tab = ref<'queue' | 'templates' | 'settings'>('queue')
const settings = reactive<LocalSettings>(getSettings())
const selectedPrinter = ref(settings.preferredPrinterDeviceName)
const toast = ref('')
const counts = computed(() => ({
  waiting: queue.jobs.filter((job) => ['queued', 'paused'].includes(job.status)).length,
  failed: queue.jobs.filter((job) => job.status === 'failed').length,
  done: queue.jobs.filter((job) => job.status === 'succeeded').length,
}))
const statusLabels = { queued: '等待中', processing: '打印中', succeeded: '已完成', failed: '失败', paused: '已暂停', cancelled: '已取消' }
const activePrinter = computed(() => selectedPrinter.value
  ? queue.printers.find((printer) => printer.deviceName === selectedPrinter.value)
  : queue.printers.find((printer) => printer.isDefault) || queue.printers[0])
const activePrinterName = computed(() => activePrinter.value?.name || '尚未发现打印机')

onMounted(async () => {
  await queue.load()
  const saved = JSON.parse(localStorage.getItem('postcard-template-state') || '{}') as Record<string, boolean>
  postcardTemplates.forEach((item) => { if (typeof saved[item.id] === 'boolean') item.enabled = saved[item.id] })
})
function saveTemplateState() {
  localStorage.setItem('postcard-template-state', JSON.stringify(Object.fromEntries(postcardTemplates.map((item) => [item.id, item.enabled]))))
  toast.value = '模板状态已保存'; window.setTimeout(() => toast.value = '', 1800)
}
function saveConfig() {
  settings.sessionTimeoutSeconds = Math.max(60, settings.sessionTimeoutSeconds)
  settings.maxPrintCopies = Math.max(1, Math.min(10, settings.maxPrintCopies))
  saveSettings({ ...settings }); toast.value = '终端设置已保存'; window.setTimeout(() => toast.value = '', 1800)
}
function savePrinter() {
  settings.preferredPrinterDeviceName = selectedPrinter.value
  saveSettings({ preferredPrinterDeviceName: selectedPrinter.value })
  toast.value = selectedPrinter.value
    ? `已选择 ${activePrinter.value?.name || '指定打印机'}，后续新任务将使用该设备`
    : '已改为使用系统默认打印机'
  window.setTimeout(() => toast.value = '', 2200)
}
async function refreshPrinters() {
  await queue.refreshPrinters()
  toast.value = queue.printers.length ? `已发现 ${queue.printers.length} 台打印机` : '未检测到系统打印机'
  window.setTimeout(() => toast.value = '', 1800)
}
async function reprint(jobId: string) {
  const job = queue.jobs.find((item) => item.id === jobId)
  if (!job || !window.postcardTerminal) { toast.value = '本机成品已过期，无法重打'; return }
  const printerName = selectedPrinter.value || activePrinter.value?.deviceName
    || queue.printers.find((printer) => printer.isDefault)?.deviceName || queue.printers[0]?.deviceName
  if (!printerName) { toast.value = '请先选择打印机'; return }
  const response = await window.postcardTerminal.printPostcard({
    jobId: `${job.id}-REPRINT`,
    draftId: job.draftId,
    copies: job.copies,
    printerName,
  })
  toast.value = response.ok ? '已发送重打任务' : (response.error || '重打失败')
}
async function exitOperator() {
  if (window.postcardTerminal) {
    try { if (await window.postcardTerminal.closeOperatorWindow()) return }
    catch { /* Fall through to browser behavior. */ }
  }
  if (window.opener) window.close()
  else location.hash = ''
}
</script>

<template>
  <main class="operator-view">
    <aside>
      <div class="operator-brand"><span>淳</span><div><b>明信片运维台</b><small>LOCAL OPERATOR</small></div></div>
      <nav><button class="active" @click="tab='queue'"><AppIcon name="print" />本机打印队列 <span>{{ counts.waiting }}</span></button></nav>
      <div class="device-state"><span><b>当前出纸设备</b><small>{{ activePrinterName }}</small></span></div>
      <button class="exit-button" @click="exitOperator"><AppIcon name="close" />关闭运维台</button>
    </aside>
    <section class="operator-content">
      <header><div><p>POSTCARD TERMINAL · Z3-25</p><h1>本机设备运维</h1><span class="admin-hint">模板、档案、打印任务与留存策略请在 adminsystem 统一管理</span></div><time>{{ new Intl.DateTimeFormat('zh-CN',{dateStyle:'long',timeStyle:'short'}).format(new Date()) }}</time></header>
      <template v-if="tab==='queue'">
        <section class="printer-toolbar paper-card">
          <div class="printer-heading"><span><AppIcon name="print" /></span><div><b>本机默认出纸设备</b><small>选择仅影响之后创建的任务；重新打印使用此刻选择的设备</small></div></div>
          <label><span>选择打印机</span><select v-model="selectedPrinter" @change="savePrinter"><option value="">系统默认打印机{{ queue.printers.find(p=>p.isDefault) ? ` · ${queue.printers.find(p=>p.isDefault)?.name}` : '' }}</option><option v-for="printer in queue.printers" :key="printer.deviceName" :value="printer.deviceName">{{ printer.name }}{{ printer.isDefault ? '（系统默认）' : '' }}</option></select></label>
          <!-- <div class="printer-health"><span><b>{{ activePrinterName }}</b></span></div> -->
          <button class="secondary-button" @click="refreshPrinters"><AppIcon name="refresh" :size="17" />刷新设备</button>
        </section>
        <div class="operator-metrics"><article><span>等待处理</span><b>{{ counts.waiting }}</b><small>份</small></article><article><span>打印完成</span><b>{{ counts.done }}</b><small>份</small></article><article :class="{warning:counts.failed}"><span>异常任务</span><b>{{ counts.failed }}</b><small>份</small></article><button :class="{paused:queue.paused}" @click="queue.setPaused(!queue.paused)"><AppIcon :name="queue.paused?'play':'pause'" />{{ queue.paused?'恢复队列':'暂停队列' }}</button></div>
        <section class="queue-table paper-card"><header><b>本机打印队列</b><span>任务状态会保留在本机；重复提交将被拦截</span></header><div class="table-head"><span>成品</span><span>任务 / 模板 / 打印机</span><span>提交时间</span><span>份数</span><span>状态</span><span>操作</span></div><div v-if="!queue.jobs.length" class="operator-empty"><AppIcon name="print" :size="38" /><p>暂无打印任务</p></div><div v-for="job in queue.jobs" v-else :key="job.id" class="job-row"><img :src="job.previewDataUrl" alt="" /><span><b>{{ job.id }}</b><small>{{ job.templateName }} · {{ job.draftId }}</small><small>出纸设备：{{ job.printerName || '系统默认打印机' }}</small></span><time>{{ new Date(job.createdAt).toLocaleString('zh-CN') }}</time><b>{{ job.copies }}</b><i :class="job.status">{{ statusLabels[job.status] }}</i><div><button v-if="job.status==='failed'" title="重新排队" @click="queue.retry(job.id)"><AppIcon name="refresh" /></button><button v-if="job.status==='succeeded'" title="重新打印" @click="reprint(job.id)"><AppIcon name="print" /></button><button v-if="['queued','paused','failed'].includes(job.status)" title="取消" @click="queue.cancel(job.id)"><AppIcon name="trash" /></button></div></div></section>
      </template>
      <template v-else-if="tab==='templates'">
        <div class="section-lead"><div><h2>内置模板库</h2><p>共 {{ postcardTemplates.length }} 套；停用后访客端将不再显示该模板。</p></div><button class="primary-button" @click="saveTemplateState">保存模板状态</button></div>
        <div class="operator-template-grid"><article v-for="item in postcardTemplates" :key="item.id" class="paper-card"><div class="template-swatch" :style="{background:item.background,color:item.accent}"><b>{{ item.title }}</b><span>{{ item.year }}</span><i :style="{borderColor:item.accent}">淳</i></div><section><div><b>{{ item.name }}</b><small>{{ item.group }} · 排序 {{ item.order }}</small></div><label><input v-model="item.enabled" type="checkbox" /><span /></label></section></article></div>
      </template>
      <template v-else>
        <div class="section-lead"><div><h2>终端与留存策略</h2><p>设置只影响本机，并写入浏览器持久存储。</p></div><button class="primary-button" @click="saveConfig">保存设置</button></div>
        <section class="settings-grid">
          <article class="paper-card"><header><AppIcon name="clock" /><div><b>访客会话</b><small>长时间无操作时保护个人内容</small></div></header><label><span>自动返回首页</span><div><input v-model.number="settings.sessionTimeoutSeconds" type="number" min="60" max="900" /><em>秒</em></div></label><label><span>原始照片保留</span><div><input v-model.number="settings.originalRetentionHours" type="number" min="1" max="72" /><em>小时</em></div></label><label><span>成品保留</span><div><input v-model.number="settings.resultRetentionDays" type="number" min="1" max="30" /><em>天</em></div></label></article>
          <article class="paper-card"><header><AppIcon name="print" /><div><b>打印保护</b><small>限制单次份数与连续操作</small></div></header><label><span>单次最多打印</span><div><input v-model.number="settings.maxPrintCopies" type="number" min="1" max="10" /><em>份</em></div></label><label><span>最短打印间隔</span><div><input v-model.number="settings.minPrintIntervalSeconds" type="number" min="5" max="120" /><em>秒</em></div></label><div class="printer-summary"><p>已安装打印机</p><span v-for="printer in queue.printers" :key="printer.name">{{ printer.name }}{{ printer.isDefault ? ' · 系统默认' : '' }}</span><span v-if="!queue.printers.length">未发现 Windows 打印机</span></div></article>
        </section>
      </template>
    </section>
    <p v-if="toast" class="operator-toast">{{ toast }}</p>
  </main>
</template>

<style scoped>
.operator-view{display:grid;width:100%;height:100%;grid-template-columns:230px 1fr;background:var(--paper);overflow:hidden}.operator-view>aside{display:flex;padding:24px 16px;flex-direction:column;background:#2e322e;color:#f2eee5}.operator-brand{display:flex;padding:0 8px 25px;align-items:center;gap:11px;border-bottom:1px solid #ffffff18}.operator-brand>span{display:grid;width:38px;height:38px;place-items:center;border:1px solid #b96259;color:#d57c73;font:22px var(--font-serif)}.operator-brand>div{display:grid}.operator-brand b{font:15px var(--font-serif);letter-spacing:.08em}.operator-brand small{margin-top:3px;color:#ffffff66;font-size:6px;letter-spacing:.18em}aside nav{display:grid;margin-top:22px;gap:5px}aside nav button{display:grid;min-height:48px;padding:0 13px;grid-template-columns:24px 1fr auto;align-items:center;border:0;border-radius:7px;background:transparent;color:#ffffff98;text-align:left}aside nav button.active{background:#ffffff10;color:white}aside nav button.active svg{color:#d57c73}aside nav button span{display:grid;min-width:21px;height:21px;place-items:center;border-radius:11px;background:#9f2925;color:white;font-size:8px}.device-state{display:flex;margin-top:auto;padding:15px 7px;align-items:center;gap:10px;border-top:1px solid #ffffff18}.device-state>i{width:8px;height:8px;border-radius:50%;background:#8b6c68}.device-state>i.online{background:#86b18d}.device-state span{display:grid;gap:3px}.device-state b{font-size:9px}.device-state small{color:#ffffff60;font-size:7px}.exit-button{display:flex;min-height:40px;align-items:center;justify-content:center;gap:7px;border:1px solid #ffffff20;border-radius:6px;background:transparent;color:#ffffff90;font-size:9px}.operator-content{min-width:0;padding:26px 34px;overflow:auto}.operator-content>header{display:flex;margin-bottom:24px;align-items:flex-end;justify-content:space-between}.operator-content>header p{margin:0;color:var(--red);font-size:7px;letter-spacing:.22em}.operator-content h1{margin:4px 0 0;font:500 28px var(--font-serif);letter-spacing:.08em}.operator-content>header time{color:var(--quiet);font-size:9px}.operator-metrics{display:grid;margin-bottom:15px;grid-template-columns:repeat(3,1fr) 150px;gap:10px}.operator-metrics article{display:flex;min-height:80px;padding:15px;align-items:baseline;border:1px solid var(--border);border-radius:8px;background:var(--surface)}.operator-metrics article>span{margin-right:auto;color:var(--muted);font-size:9px}.operator-metrics article>b{font:30px Georgia;color:var(--green)}.operator-metrics article.warning>b{color:var(--red)}.operator-metrics article>small{margin-left:4px;color:var(--quiet)}.operator-metrics>button{display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--red);border-radius:8px;background:var(--red);color:white}.operator-metrics>button.paused{background:var(--green);border-color:var(--green)}.queue-table{overflow:hidden}.queue-table>header{display:flex;height:53px;padding:0 17px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light)}.queue-table>header span{color:var(--quiet);font-size:8px}.table-head,.job-row{display:grid;padding:0 16px;grid-template-columns:100px 1.5fr 1fr 60px 90px 100px;align-items:center;gap:12px}.table-head{height:38px;background:#eee9df;color:var(--quiet);font-size:8px}.job-row{min-height:75px;border-top:1px solid var(--border-light);font-size:9px}.job-row>img{width:86px;height:54px;object-fit:cover}.job-row>span{display:grid;min-width:0;gap:4px}.job-row>span>b{overflow:hidden;text-overflow:ellipsis}.job-row small,.job-row time{color:var(--quiet);font-size:7px}.job-row>i{justify-self:start;padding:5px 8px;border-radius:9px;background:#eee9df;color:var(--muted);font-style:normal;font-size:8px}.job-row>i.succeeded{background:#e6efe6;color:var(--green)}.job-row>i.failed{background:#f2e3df;color:var(--red)}.job-row>i.processing{background:#e4ebe9;color:#436c62}.job-row>div{display:flex;gap:5px}.job-row>div button{display:grid;width:31px;height:31px;place-items:center;border:1px solid var(--border);border-radius:5px;background:var(--canvas);color:var(--muted)}.operator-empty{display:grid;min-height:250px;place-content:center;justify-items:center;color:var(--quiet)}.section-lead{display:flex;margin-bottom:17px;align-items:center;justify-content:space-between}.section-lead h2{margin:0 0 5px;font:500 22px var(--font-serif)}.section-lead p{margin:0;color:var(--quiet);font-size:9px}.section-lead button{min-height:44px}.operator-template-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}.operator-template-grid article{padding:9px}.template-swatch{position:relative;display:grid;aspect-ratio:148/83;padding:12px;align-content:end;overflow:hidden}.template-swatch>b{font:18px var(--font-serif)}.template-swatch>span{position:absolute;top:9px;right:9px;font:10px Georgia}.template-swatch>i{position:absolute;top:9px;left:9px;display:grid;width:28px;height:28px;place-items:center;border:2px double;font:12px var(--font-serif);font-style:normal;opacity:.55}.operator-template-grid article>section{display:flex;padding:10px 4px 3px;align-items:center;justify-content:space-between}.operator-template-grid article>section>div{display:grid;gap:4px}.operator-template-grid small{color:var(--quiet);font-size:7px}.operator-template-grid label input{display:none}.operator-template-grid label span{position:relative;display:block;width:34px;height:20px;border-radius:10px;background:#cfc8bd}.operator-template-grid label span:after{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:white;content:"";transition:.15s}.operator-template-grid label input:checked+span{background:var(--green)}.operator-template-grid label input:checked+span:after{left:17px}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.settings-grid article{padding:22px}.settings-grid article>header{display:flex;padding-bottom:17px;align-items:center;gap:11px;border-bottom:1px solid var(--border-light)}.settings-grid article>header svg{color:var(--red)}.settings-grid article>header div{display:grid}.settings-grid article>header small{margin-top:4px;color:var(--quiet);font-size:8px}.settings-grid label{display:flex;min-height:61px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light);font-size:10px}.settings-grid label div{display:flex;align-items:center}.settings-grid input{width:88px;height:36px;padding:0 9px;border:1px solid var(--border);border-radius:6px;background:var(--canvas);text-align:right}.settings-grid em{width:36px;color:var(--quiet);font-size:9px;font-style:normal;text-align:right}.printer-summary{display:grid;margin-top:17px;gap:8px}.printer-summary p{margin:0 0 3px;font-size:10px}.printer-summary span{display:flex;align-items:center;gap:7px;color:var(--quiet);font-size:8px}.printer-summary i{width:7px;height:7px;border-radius:50%;background:#b8afa3}.printer-summary i.online{background:var(--green)}.operator-toast{position:fixed;left:50%;bottom:30px;padding:11px 18px;border-radius:7px;background:#30312d;color:white;font-size:10px;transform:translateX(-50%)}
@media(max-width:1200px){.operator-view{grid-template-columns:200px 1fr}.operator-content{padding:20px}.operator-template-grid{grid-template-columns:repeat(3,1fr)}}
</style>

<style scoped>
.operator-content>header{margin-bottom:20px}.printer-toolbar{display:grid;min-height:82px;margin-bottom:12px;padding:13px 15px;grid-template-columns:minmax(230px,1fr) minmax(260px,1.15fr) minmax(210px,.9fr) 112px;align-items:center;gap:14px}.printer-heading{display:flex;align-items:center;gap:11px}.printer-heading>span{display:grid;width:42px;height:42px;flex:none;place-items:center;border-radius:50%;background:#efe8de;color:var(--red)}.printer-heading>div,.printer-health span{display:grid;gap:4px}.printer-heading small{color:var(--quiet);font-size:7px;line-height:1.45}.printer-toolbar>label{display:grid;gap:5px}.printer-toolbar>label>span{color:var(--quiet);font-size:7px}.printer-toolbar select{width:100%;height:39px;padding:0 34px 0 10px;border:1px solid var(--border);border-radius:7px;background:var(--canvas);font-size:10px}.printer-health{display:flex;min-width:0;align-items:center;gap:9px}.printer-health b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}.printer-toolbar>button{min-height:39px;padding:0 12px;font-size:9px}.operator-metrics{margin-bottom:12px}.operator-metrics article{min-height:72px;padding:14px}.operator-metrics article>b{font-size:28px}.queue-table>header{height:49px}.table-head{height:36px}.job-row{min-height:82px}.job-row>span{gap:3px}.operator-empty{min-height:210px}
@media(max-width:1200px){.printer-toolbar{grid-template-columns:minmax(200px,1fr) minmax(240px,1.3fr) 104px}.printer-health{display:none}}
</style>
