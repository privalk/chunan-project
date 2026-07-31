<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { usePostcardStore } from '../stores/postcard'
import { usePrintQueueStore } from '../stores/printQueue'
import { createArtifacts } from '../utils/renderPostcard'
import { getSettings, savePostcardLocal } from '../utils/storage'
import { queueSync } from '../utils/storage'
import { uploadPostcard } from '../utils/api'
import type { PostcardArtifacts } from '../types'

const store = usePostcardStore()
const queue = usePrintQueueStore()
const artifacts = ref<PostcardArtifacts | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const wantPrint = ref(true)
const wantDownload = ref(true)
const copies = ref(1)
const maxCopies = getSettings().maxPrintCopies

onMounted(async () => {
  try { artifacts.value = await createArtifacts(store.draft) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '成品生成失败' }
  finally { loading.value = false }
})

async function confirm() {
  if (!artifacts.value || saving.value) return
  saving.value = true; error.value = ''
  try {
    const serializable = JSON.parse(JSON.stringify(artifacts.value)) as PostcardArtifacts
    await savePostcardLocal(serializable)
    let pickupUrl = `${import.meta.env.VITE_PICKUP_BASE_URL || 'http://127.0.0.1:8790/download'}/${store.draft.id}`
    if (window.postcardTerminal) {
      const saved = await window.postcardTerminal.savePostcard(serializable)
      if (saved.pickupUrl) pickupUrl = saved.pickupUrl
    } else {
      const link = document.createElement('a'); link.href = serializable.pngDataUrl; link.download = `${store.draft.id}.png`
      if (wantDownload.value) link.click()
    }
    let printJob
    if (wantPrint.value) {
      await queue.load()
      printJob = await queue.enqueue(serializable, copies.value)
    }
    try {
      await uploadPostcard(serializable, printJob)
      if (printJob) await queue.registerRemote(printJob.id)
    } catch {
      await queueSync({ artifacts: serializable, printJob })
    } finally {
      if (printJob) void queue.process()
    }
    store.result = { pickupUrl, qrDataUrl: '', pngDataUrl: serializable.pngDataUrl, printed: wantPrint.value }
    store.go('result')
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '保存失败，请重试' }
  finally { saving.value = false }
}
</script>

<template>
  <main class="flow-page preview-view">
    <header class="flow-header"><button class="icon-button" aria-label="返回编辑" @click="store.go('compose')"><AppIcon name="back" /></button><div><p>STEP 03 / 03</p><h1>确认你的明信片</h1><span>请检查照片、文字与签名，确认后将生成高清成品</span></div><div class="step-dots"><b /><b /><b /></div></header>
    <section class="preview-layout">
      <div class="final-preview paper-field">
        <div v-if="loading" class="generating"><i /><p>正在生成高清明信片…</p><span>1748 × 1240 px · 适配 300dpi 打印</span></div>
        <img v-else-if="artifacts" :src="artifacts.pngDataUrl" alt="明信片成品预览" />
        <div v-else class="generating error"><AppIcon name="close" :size="34" /><p>{{ error }}</p></div>
      </div>
      <aside class="confirm-panel paper-card">
        <p>FINAL CHECK</p><h2>成品确认</h2>
        <dl><div><dt>模板</dt><dd>{{ store.template.name }}</dd></div><div><dt>成品编号</dt><dd>{{ store.draft.id }}</dd></div><div><dt>照片</dt><dd>{{ store.draft.photoDataUrl ? '已添加' : '未添加' }}</dd></div><div><dt>签名</dt><dd>{{ store.draft.signature?.displayName || '未关联' }}</dd></div><div><dt>输出</dt><dd>PNG · JPG · PDF</dd></div></dl>
        <label class="output-option"><input v-model="wantPrint" type="checkbox" /><span><AppIcon name="print" /><b>加入打印队列</b><small>按顺序打印，防止重复提交</small></span></label>
        <div v-if="wantPrint" class="copy-picker"><span>打印份数</span><button :disabled="copies <= 1" aria-label="减少一份" @click="copies -= 1"><AppIcon name="minus" :size="16" /></button><b>{{ copies }}</b><button :disabled="copies >= maxCopies" aria-label="增加一份" @click="copies += 1"><AppIcon name="plus" :size="16" /></button><small>单次最多 {{ maxCopies }} 份</small></div>
        <label class="output-option"><input v-model="wantDownload" type="checkbox" /><span><AppIcon name="download" /><b>扫码领取</b><small>生成局域网取件二维码</small></span></label>
        <div class="consent"><AppIcon name="check" :size="16" /><p>确认即表示同意为本次制作处理照片与签名；系统将按设定期限自动清理。</p></div>
        <p v-if="error && artifacts" class="confirm-error">{{ error }}</p>
        <button class="primary-button confirm-button" :disabled="loading || !artifacts || saving || (!wantPrint && !wantDownload)" @click="confirm">{{ saving ? '正在保存…' : '确认生成' }} <AppIcon v-if="!saving" name="arrow" /></button>
        <button class="text-button" :disabled="saving" @click="store.go('compose')">返回继续调整</button>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.preview-layout{display:grid;min-height:0;grid-template-columns:1fr 360px;gap:20px}.final-preview{display:grid;min-width:0;min-height:0;padding:32px;place-items:center;overflow:hidden;border:1px solid var(--border);border-radius:12px}.final-preview>img{display:block;width:min(100%,1040px);max-height:100%;object-fit:contain;box-shadow:0 24px 65px rgba(59,46,29,.18)}.generating{display:grid;place-content:center;justify-items:center;color:var(--muted)}.generating i{width:54px;height:54px;border:2px solid #ddd5c9;border-top-color:var(--red);border-radius:50%;animation:spin 1s linear infinite}.generating p{margin:17px 0 5px;font:20px var(--font-serif)}.generating span{color:var(--quiet);font-size:9px}.generating.error{color:var(--red)}.confirm-panel{display:flex;min-height:0;padding:26px;flex-direction:column;overflow:auto}.confirm-panel>p:first-child{margin:0;color:var(--red);font-size:8px;letter-spacing:.22em}.confirm-panel>h2{margin:6px 0 20px;font:500 25px var(--font-serif)}dl{display:grid;margin:0 0 18px;grid-template-columns:1fr 1fr;border-top:1px solid var(--border-light);border-left:1px solid var(--border-light)}dl div{padding:11px;border-right:1px solid var(--border-light);border-bottom:1px solid var(--border-light)}dt{color:var(--quiet);font-size:8px}dd{margin:5px 0 0;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.output-option{position:relative;display:block;margin-bottom:9px}.output-option input{position:absolute;opacity:0}.output-option>span{display:grid;min-height:66px;padding:11px 12px 11px 48px;border:1px solid var(--border);border-radius:8px;background:var(--canvas)}.output-option svg{position:absolute;left:15px;top:20px;color:var(--quiet)}.output-option b{font-size:11px}.output-option small{margin-top:4px;color:var(--quiet);font-size:8px}.output-option input:checked+span{border-color:var(--green);background:#f0f4ef}.output-option input:checked+span svg{color:var(--green)}.copy-picker{display:grid;margin:-2px 0 9px;padding:8px 11px;grid-template-columns:1fr 34px 30px 34px;align-items:center;gap:5px;border:1px solid var(--border-light);border-radius:7px;background:#f7f4ed;font-size:10px}.copy-picker button{display:grid;width:32px;height:32px;padding:0;place-items:center;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--red)}.copy-picker b{text-align:center}.copy-picker small{grid-column:1/-1;color:var(--quiet);font-size:8px}.consent{display:flex;margin:9px 0;padding:10px;align-items:flex-start;gap:7px;border-radius:7px;background:#eee9df;color:var(--muted)}.consent svg{flex:none;color:var(--green)}.consent p{margin:0;font-size:8px;line-height:1.6}.confirm-button{min-height:55px;margin-top:auto}.text-button{min-height:38px;border:0;background:transparent;color:var(--muted)}.confirm-error{margin:0 0 8px!important;color:var(--red);font-size:9px!important;letter-spacing:0!important}
@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1200px){.preview-layout{grid-template-columns:1fr 320px}.final-preview{padding:18px}.confirm-panel{padding:18px}dl{margin-bottom:12px}.output-option>span{min-height:56px}.consent{display:none}}
</style>
