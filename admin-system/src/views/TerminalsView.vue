<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, formatDateTime, formatRelative } from '../api'
import AppIcon from '../components/AppIcon.vue'
import StatusBadge from '../components/StatusBadge.vue'
import type { Terminal } from '../types'

const loading = ref(true)
const error = ref('')
const items = ref<Terminal[]>([])
const online = computed(() => items.value.filter((item) => item.status === 'online').length)
const queueTotal = computed(() => items.value.reduce((sum, item) => sum + item.queueCount, 0))

async function load() {
  loading.value = true
  error.value = ''
  try { items.value = (await api<{ items: Terminal[] }>('/api/terminals')).items }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '读取终端状态失败' }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">TERMINAL STATUS</p><h1>终端状态</h1><p class="description">监测签名终端的连接、版本与离线待同步数量</p></div><div class="page-actions"><button class="secondary-button" :disabled="loading" @click="load"><AppIcon name="refresh" />刷新状态</button></div></div>
    <div v-if="loading" class="loading-line" />
    <div v-else-if="error" class="empty-state paper-card"><div class="empty-mark">!</div><strong>终端状态读取失败</strong><p>{{ error }}</p><button class="secondary-button retry" @click="load">重新加载</button></div>
    <template v-else>
      <div class="terminal-summary">
        <article class="paper-card"><p>已登记终端</p><strong>{{ items.length }}</strong><span>台</span></article>
        <article class="paper-card"><p>当前在线</p><strong>{{ online }}</strong><span>台</span><small><i :class="{ warning: online < items.length }" />{{ online === items.length ? '连接状态正常' : '存在离线设备' }}</small></article>
        <article class="paper-card"><p>等待同步</p><strong>{{ queueTotal }}</strong><span>项</span><small>终端离线队列</small></article>
      </div>
      <div v-if="items.length" class="terminal-grid">
        <article v-for="terminal in items" :key="terminal.id" class="terminal-card paper-card" :class="{ offline: terminal.status === 'offline' }">
          <header><div class="terminal-mark"><AppIcon name="terminal" /><i /></div><StatusBadge :status="terminal.status" /></header>
          <p class="terminal-code">{{ terminal.id }}</p><h2>{{ terminal.name }}</h2><p class="location">{{ terminal.location }}</p>
          <dl><div><dt>最近心跳</dt><dd>{{ formatRelative(terminal.lastSeenAt) }}</dd></div><div><dt>应用版本</dt><dd class="mono">{{ terminal.appVersion || '尚未上报' }}</dd></div><div><dt>终端地址</dt><dd class="mono">{{ terminal.ipAddress || '—' }}</dd></div><div><dt>待同步队列</dt><dd :class="{ queue: terminal.queueCount > 0 }">{{ terminal.queueCount }} 项</dd></div></dl>
          <footer>登记于 {{ formatDateTime(terminal.createdAt) }}<span :class="terminal.status">{{ terminal.status === 'online' ? '实时连接' : '等待重连' }}</span></footer>
        </article>
      </div>
      <div v-else class="empty-state paper-card"><div class="empty-mark">端</div><strong>尚未登记终端</strong><p>配置终端密钥并启动设备后将在这里显示</p></div>
      <article class="health-note paper-card"><div class="note-mark">运</div><div><p>OPERATION NOTE</p><h3>终端在线判定</h3><span>终端每 30 秒发送一次心跳；超过系统设置的在线阈值未收到心跳即显示为离线。签名仍会保存在终端本地，恢复连接后按事件编号幂等同步。</span></div></article>
    </template>
  </section>
</template>

<style scoped>
.retry { margin-top: 18px; }.terminal-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }.terminal-summary article { position: relative; min-height: 124px; padding: 20px 23px; }.terminal-summary p { margin: 0 0 12px; color: var(--ca-muted); font-size: 11px; }.terminal-summary strong { font: 500 34px/1 var(--ca-font-display); }.terminal-summary > article > span { margin-left: 5px; color: var(--ca-quiet); font-size: 11px; }.terminal-summary small { display: block; margin-top: 14px; color: var(--ca-quiet); font-size: 9px; }.terminal-summary small i { display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: var(--ca-green); }.terminal-summary small i.warning { background: var(--ca-red); }
.terminal-grid { display: grid; margin-top: 16px; grid-template-columns: repeat(3, 1fr); gap: 16px; }.terminal-card { padding: 20px; }.terminal-card.offline { background: rgba(248,244,238,.72); }.terminal-card header { display: flex; align-items: flex-start; justify-content: space-between; }.terminal-mark { position: relative; display: grid; width: 50px; height: 50px; place-items: center; border: 1px solid rgba(106,136,115,.22); border-radius: 50%; background: rgba(106,136,115,.07); color: var(--ca-green); font-size: 22px; }.terminal-mark i { position: absolute; right: 1px; bottom: 3px; width: 9px; height: 9px; border: 2px solid var(--ca-surface); border-radius: 50%; background: var(--ca-green); }.offline .terminal-mark { border-color: rgba(159,41,37,.18); background: rgba(159,41,37,.05); color: var(--ca-red); }.offline .terminal-mark i { background: var(--ca-red); }.terminal-code { margin: 20px 0 6px; color: var(--ca-red); font-size: 9px; font-weight: 600; letter-spacing: .2em; }.terminal-card h2 { margin: 0; font: 500 21px var(--ca-font-display); letter-spacing: .08em; }.location { margin: 7px 0 20px; color: var(--ca-muted); font-size: 11px; }.terminal-card dl { display: grid; margin: 0; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--ca-border-light); border-left: 1px solid var(--ca-border-light); }.terminal-card dl div { min-height: 67px; padding: 11px; border-right: 1px solid var(--ca-border-light); border-bottom: 1px solid var(--ca-border-light); }.terminal-card dt { color: var(--ca-quiet); font-size: 9px; }.terminal-card dd { margin: 7px 0 0; color: var(--ca-ink-soft); font-size: 11px; }.terminal-card dd.queue { color: var(--ca-red); font-weight: 600; }.terminal-card footer { display: flex; margin-top: 14px; justify-content: space-between; color: var(--ca-quiet); font-size: 8px; }.terminal-card footer span::before { content: ''; display: inline-block; width: 5px; height: 5px; margin-right: 5px; border-radius: 50%; }.terminal-card footer span.online { color: var(--ca-green); }.terminal-card footer span.online::before { background: var(--ca-green); }.terminal-card footer span.offline { color: var(--ca-red); }.terminal-card footer span.offline::before { background: var(--ca-red); }
.health-note { display: flex; margin-top: 16px; padding: 19px 22px; align-items: center; gap: 17px; }.note-mark { display: grid; width: 48px; height: 48px; flex: 0 0 48px; place-items: center; border: 1px solid var(--ca-red); border-radius: 50%; color: var(--ca-red); font: 500 17px var(--ca-font-display); }.health-note p { margin: 0 0 4px; color: var(--ca-red); font-size: 7px; font-weight: 600; letter-spacing: .22em; }.health-note h3 { margin: 0 0 5px; font: 500 16px var(--ca-font-display); letter-spacing: .08em; }.health-note span { color: var(--ca-muted); font-size: 11px; line-height: 1.7; }
@media (max-width: 1350px) { .terminal-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
