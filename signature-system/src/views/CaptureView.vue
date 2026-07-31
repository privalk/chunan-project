<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import PreviewDialog from '../components/PreviewDialog.vue'
import SignatureCanvas from '../components/SignatureCanvas.vue'
import { useSignatureStore } from '../stores/signature'
import type { SignatureArtifacts, SignatureContext } from '../types/signature'
import { createArtifacts } from '../utils/renderSignature'
import { saveLocally } from '../utils/storage'

const props = defineProps<{ context: SignatureContext }>()

const emit = defineEmits<{
  back: []
  home: []
  saved: [id: string, displayName?: string]
}>()

const SESSION_SECONDS = 90
const store = useSignatureStore()
const secondsLeft = ref(SESSION_SECONDS)
const errorMessage = ref('')
const preview = ref<SignatureArtifacts | null>(null)
const saving = ref(false)
let timer: number | undefined

const timeText = computed(() => {
  const minutes = Math.floor(secondsLeft.value / 60)
  return `${String(minutes).padStart(2, '0')}:${String(secondsLeft.value % 60).padStart(2, '0')}`
})
const warningTime = computed(() => secondsLeft.value <= 15)

function goBack() {
  store.reset()
  emit('back')
}

function goHome() {
  store.reset()
  emit('home')
}

function clearAll() {
  store.clear()
  errorMessage.value = ''
}

function openPreview() {
  if (!store.isMeaningful) {
    errorMessage.value = '笔迹内容过少，请完整签写姓名后再继续'
    return
  }
  errorMessage.value = ''
  preview.value = createArtifacts(store.strokes, store.startedAt, props.context)
}

async function confirmSave() {
  if (!preview.value || saving.value) return
  saving.value = true
  try {
    const result = await saveLocally(preview.value)
    if (!result.ok) throw new Error('保存失败')
    emit('saved', preview.value.record.id, preview.value.record.context.display_name)
    store.reset()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '签名保存失败，请联系工作人员'
    preview.value = null
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  store.reset()
  timer = window.setInterval(() => {
    if (preview.value) return
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) goHome()
  }, 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <main class="capture-view">
    <header>
      <button class="back-button" @click="goBack">
        <span>‹</span>
        修改信息
      </button>
      <div class="header-brand">
        <span class="mini-seal">三中</span>
        <div><strong>淳安第三中学</strong><small>{{ context.display_name || '匿名访客' }} · 添砖加瓦</small></div>
      </div>
      <div class="timer" :class="{ warning: warningTime }">
        <AppIcon name="clock" />
        <div><small>剩余操作时间</small><strong>{{ timeText }}</strong></div>
      </div>
    </header>

    <section class="capture-content">
      <div class="title-row">
        <div>
          <p class="eyebrow"><span>02</span> SIGN YOUR NAME</p>
          <h1>留下您的签名</h1>
          <p>请在下方虚线区域内清晰、完整地签写</p>
        </div>
        <div class="step-indicator" aria-label="当前步骤 2，共 3 步">
          <span class="done"><AppIcon name="check" /></span><i />
          <span class="active">2</span><i />
          <span>3</span>
          <small>选择信息</small><small>书写签名</small><small>预览确认</small>
        </div>
      </div>

      <SignatureCanvas :prompt="context.identity_type === 'anonymous' ? '请在框内留下您的签名' : '请在框内签写您的姓名'" />

      <div class="tool-row">
        <div class="history-tools">
          <button :disabled="!store.canUndo" @click="store.undo"><AppIcon name="undo" /> 撤销</button>
          <button :disabled="!store.canRedo" @click="store.redo"><AppIcon name="redo" /> 重做</button>
          <button :disabled="store.strokes.length === 0" class="clear-button" @click="clearAll"><AppIcon name="clear" /> 清空重签</button>
        </div>

        <div class="pen-settings">
          <div class="setting-group">
            <span>笔迹颜色</span>
            <button
              v-for="item in store.colors"
              :key="item"
              class="color-choice"
              :class="{ selected: store.color === item }"
              :style="{ '--choice-color': item }"
              :aria-label="`选择颜色 ${item}`"
              @click="store.color = item"
            />
          </div>
          <div class="setting-divider" />
          <div class="setting-group widths">
            <span>笔迹粗细</span>
            <button v-for="size in [4, 6, 9]" :key="size" :class="{ selected: store.width === size }" @click="store.width = size">
              <i :style="{ height: `${Math.max(2, size / 2)}px` }" />
            </button>
          </div>
        </div>

        <button class="continue-button" :class="{ ready: store.isMeaningful }" @click="openPreview">
          预览并确认 <AppIcon name="arrow" />
        </button>
      </div>

      <div class="status-line">
        <p v-if="errorMessage" class="error-message"><span>!</span>{{ errorMessage }}</p>
        <p v-else><span class="status-dot" /> 已记录 {{ store.strokes.length }} 笔 / {{ store.pointCount }} 个采样点，原始轨迹将安全保存</p>
      </div>
    </section>

    <PreviewDialog
      v-if="preview"
      :artifacts="preview"
      :saving="saving"
      @back="preview = null"
      @confirm="confirmSave"
    />
  </main>
</template>

<style scoped>
.capture-view { min-height: 100%; background: var(--paper); }
header { display: grid; height: 86px; padding: 0 clamp(28px, 4.5vw, 82px); grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 1px solid #e4ded2; background: rgba(250, 248, 243, .95); }
.back-button { justify-self: start; display: flex; min-height: 48px; align-items: center; gap: 9px; border: 0; background: transparent; color: #615c53; font-size: 14px; }
.back-button span { font-size: 30px; font-weight: 200; line-height: 0; }
.header-brand { display: flex; align-items: center; gap: 12px; }
.mini-seal { display: grid; width: 43px; height: 43px; place-items: center; border: 1px solid var(--red); border-radius: 50%; color: var(--red); font: 600 13px var(--font-serif); }
.header-brand div { display: flex; flex-direction: column; }
.header-brand strong { color: #393934; font: 600 17px var(--font-serif); letter-spacing: .12em; }
.header-brand small { margin-top: 3px; color: #9b9387; font-size: 9px; letter-spacing: .16em; }
.timer { justify-self: end; display: flex; align-items: center; gap: 10px; color: #8a8175; }
.timer > svg { font-size: 22px; }
.timer div { display: flex; align-items: baseline; gap: 10px; }
.timer small { font-size: 11px; }
.timer strong { color: #3c3b36; font: 500 24px var(--font-sans); font-variant-numeric: tabular-nums; }
.timer.warning, .timer.warning strong { color: var(--red); }
.capture-content { width: min(1510px, calc(100% - 8vw)); margin: 0 auto; padding: clamp(26px, 3.5vh, 45px) 0 18px; }
.title-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
.eyebrow { margin: 0 0 10px; color: #a0988b; font: 600 10px var(--font-sans); letter-spacing: .2em; }
.eyebrow span { display: inline-grid; width: 26px; height: 26px; margin-right: 8px; place-items: center; border-radius: 50%; background: var(--red); color: white; letter-spacing: 0; }
.title-row h1 { margin: 0; color: #30312d; font: 500 clamp(30px, 3vw, 43px)/1.2 var(--font-serif); letter-spacing: .1em; }
.title-row p:last-child { margin: 8px 0 0; color: #888075; font-size: 14px; letter-spacing: .05em; }
.step-indicator { display: grid; width: 330px; margin-top: 12px; grid-template-columns: 32px 1fr 32px 1fr 32px; align-items: center; justify-items: center; color: #a59d91; }
.step-indicator span { display: grid; width: 28px; height: 28px; place-items: center; border: 1px solid #ccc4b7; border-radius: 50%; background: var(--paper); font-size: 12px; }
.step-indicator span.active { border-color: var(--red); background: var(--red); color: white; }
.step-indicator span.done { border-color: #6c8a75; background: #6c8a75; color: white; }
.step-indicator i { width: 100%; height: 1px; background: #d9d2c6; }
.step-indicator small { margin-top: 7px; font-size: 10px; white-space: nowrap; }
.step-indicator small:nth-of-type(1) { grid-column: 1; }.step-indicator small:nth-of-type(2) { grid-column: 3; color: var(--red); }.step-indicator small:nth-of-type(3) { grid-column: 5; }
.tool-row { display: grid; margin-top: 18px; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; }
.history-tools { display: flex; gap: 8px; }
.history-tools button { display: flex; min-width: 92px; min-height: 54px; padding: 0 16px; align-items: center; justify-content: center; gap: 7px; border: 1px solid #ddd6ca; border-radius: 9px; background: #fbfaf6; color: #57534b; font-size: 13px; }
.history-tools button:disabled { opacity: .36; }
.history-tools .clear-button { color: #8d3b37; }
.pen-settings { display: flex; min-height: 54px; padding: 0 18px; align-items: center; gap: 18px; border: 1px solid #ddd6ca; border-radius: 9px; background: #fbfaf6; }
.setting-group { display: flex; align-items: center; gap: 10px; }
.setting-group > span { margin-right: 2px; color: #8b8377; font-size: 11px; }
.color-choice { position: relative; width: 27px; height: 27px; padding: 0; border: 4px solid #fbfaf6; border-radius: 50%; background: var(--choice-color); outline: 1px solid transparent; }
.color-choice.selected { outline-color: var(--choice-color); }
.setting-divider { width: 1px; height: 26px; background: #e1dbd0; }
.widths button { display: grid; width: 32px; height: 32px; padding: 0; place-items: center; border: 1px solid transparent; border-radius: 6px; background: transparent; }
.widths button.selected { border-color: #c7b9a8; background: #f0ece4; }
.widths i { width: 19px; border-radius: 9px; background: #343b48; }
.continue-button { justify-self: end; display: flex; min-width: 210px; min-height: 58px; padding: 0 24px; align-items: center; justify-content: center; gap: 14px; border: 0; border-radius: 8px; background: #aaa49a; color: white; font: 500 17px var(--font-serif); letter-spacing: .08em; box-shadow: 0 8px 18px rgba(42, 36, 28, .1); }
.continue-button.ready { background: var(--red); box-shadow: 0 9px 22px rgba(112, 27, 24, .19); }
.status-line { min-height: 30px; text-align: center; }
.status-line p { display: inline-flex; align-items: center; gap: 8px; margin: 11px 0 0; color: #aaa295; font-size: 11px; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #78947f; box-shadow: 0 0 0 4px rgba(120, 148, 127, .12); }
.status-line .error-message { color: var(--red); font-size: 13px; }
.error-message span { display: grid; width: 19px; height: 19px; place-items: center; border: 1px solid currentColor; border-radius: 50%; font-weight: 700; }
@media (max-width: 1180px) { .tool-row { grid-template-columns: 1fr 1fr; }.pen-settings { grid-row: 2; grid-column: 1 / -1; justify-self: center; }.continue-button { grid-column: 2; grid-row: 1; } }
@media (max-height: 830px) { .capture-content { padding-top: 18px; }.title-row { margin-bottom: 14px; }.title-row h1 { font-size: 31px; }.title-row p:last-child { display: none; } }
</style>
