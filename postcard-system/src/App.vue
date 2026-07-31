<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from './components/AppIcon.vue'
import { postcardTemplates } from './data/templates'
import { usePostcardStore } from './stores/postcard'
import { usePrintQueueStore } from './stores/printQueue'
import { getSettings, listSyncQueue, purgeExpired, removeSync, saveSettings } from './utils/storage'
import { downloadRemotePrintImage, fetchPendingPrintJobs, fetchPostcardConfig, uploadPostcard } from './utils/api'
import ComposeView from './views/ComposeView.vue'
import OperatorView from './views/OperatorView.vue'
import PreviewView from './views/PreviewView.vue'
import ResultView from './views/ResultView.vue'
import SourceView from './views/SourceView.vue'
import WelcomeView from './views/WelcomeView.vue'

const store = usePostcardStore()
const printQueue = usePrintQueueStore()
const operatorMode = ref(location.hash === '#operator')
const now = ref(Date.now())
let timer = 0
let remotePrintTimer = 0
let pollingRemotePrint = false
const secondsLeft = computed(() => Math.max(0, Math.ceil((getSettings().sessionTimeoutSeconds * 1000 - (now.value - store.lastActivity)) / 1000)))
const showTimeout = computed(() => store.step !== 'welcome' && !operatorMode.value && secondsLeft.value <= 15)

function activity(event?: Event) {
  if (event?.type === 'keydown' && (event as KeyboardEvent).ctrlKey && (event as KeyboardEvent).shiftKey && (event as KeyboardEvent).key.toLowerCase() === 'o') {
    window.postcardTerminal?.openOperatorWindow()
    return
  }
  store.touch()
}
function hashChange() { operatorMode.value = location.hash === '#operator'; if (operatorMode.value) store.step = 'operator' }

onMounted(() => {
  if (operatorMode.value) store.step = 'operator'
  window.addEventListener('hashchange', hashChange)
  for (const type of ['pointerdown', 'pointermove', 'keydown'] as const) window.addEventListener(type, activity, { passive: true })
  const synchronize = async () => {
    try {
      const config = await fetchPostcardConfig()
      if (config.templates.length) postcardTemplates.splice(0, postcardTemplates.length, ...config.templates)
      saveSettings(config.settings)
      for (const pending of await listSyncQueue()) {
        await uploadPostcard(pending.artifacts, pending.printJob)
        if (pending.printJob) await printQueue.registerRemote(pending.printJob.id)
        await removeSync(pending.artifacts.draft.id)
      }
    } catch { /* Offline mode intentionally keeps the latest local configuration and outbox. */ }
  }
  const synchronizeRemotePrint = async () => {
    if (pollingRemotePrint || !window.postcardTerminal) return
    pollingRemotePrint = true
    try {
      for (const remote of await fetchPendingPrintJobs()) {
        const dataUrl = await downloadRemotePrintImage(remote)
        await printQueue.enqueueRemote(remote, dataUrl)
      }
    } catch { /* The next polling cycle retries when the backend becomes reachable. */ }
    finally { pollingRemotePrint = false }
  }
  void synchronize()
  void synchronizeRemotePrint()
  remotePrintTimer = window.setInterval(() => { void synchronizeRemotePrint() }, 5000)
  timer = window.setInterval(() => {
    now.value = Date.now()
    if (!operatorMode.value && store.step !== 'welcome' && secondsLeft.value <= 0) store.reset()
    if (now.value % 30000 < 1000) void synchronize()
  }, 1000)
  void purgeExpired()
  window.postcardTerminal?.enterFullscreen().catch(() => undefined)
})
onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.clearInterval(remotePrintTimer)
  window.removeEventListener('hashchange', hashChange)
  for (const type of ['pointerdown', 'pointermove', 'keydown'] as const) window.removeEventListener(type, activity)
})
</script>

<template>
  <OperatorView v-if="operatorMode || store.step === 'operator'" />
  <WelcomeView v-else-if="store.step === 'welcome'" />
  <SourceView v-else-if="store.step === 'source'" />
  <ComposeView v-else-if="store.step === 'compose'" />
  <PreviewView v-else-if="store.step === 'preview'" />
  <ResultView v-else />
  <div v-if="showTimeout" class="timeout-layer" role="alertdialog" aria-modal="true">
    <section><span><AppIcon name="clock" :size="30" /></span><p>SESSION TIMEOUT</p><h2>还要继续制作吗？</h2><div class="countdown">{{ secondsLeft }}</div><small>为保护照片和签名，本次内容将在倒计时结束后清空。</small><div><button class="secondary-button" @click="store.reset">结束并返回</button><button class="primary-button" @click="store.touch">继续制作</button></div></section>
  </div>
</template>

<style scoped>
.timeout-layer{position:fixed;inset:0;z-index:100;display:grid;padding:30px;place-items:center;background:rgba(26,26,22,.72);backdrop-filter:blur(10px)}.timeout-layer section{width:min(480px,90vw);padding:35px 40px 38px;border-radius:20px;background:var(--surface);box-shadow:var(--shadow-dialog);text-align:center}.timeout-layer section>span{display:grid;width:62px;height:62px;margin:0 auto 15px;place-items:center;border-radius:50%;background:#f1e9de;color:var(--red)}.timeout-layer p{margin:0;color:var(--red);font-size:8px;letter-spacing:.24em}.timeout-layer h2{margin:8px 0;font:500 26px var(--font-serif)}.countdown{margin:10px 0;color:var(--red);font:52px Georgia}.timeout-layer small{display:block;color:var(--muted);font-size:10px;line-height:1.7}.timeout-layer section>div:last-child{display:grid;margin-top:22px;grid-template-columns:1fr 1.2fr;gap:9px}.timeout-layer button{min-height:50px}
</style>
