<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { usePostcardStore } from '../stores/postcard'
import { hydrateSignature, searchSignatures } from '../utils/api'
import { createQrDataUrl } from '../utils/qrcode'
import type { SignatureChoice } from '../types'

const store = usePostcardStore()
const query = ref('')
const results = ref<SignatureChoice[]>([])
const searching = ref(false)
const searchError = ref('')
const cameraOpen = ref(false)
const video = ref<HTMLVideoElement>()
const stream = ref<MediaStream | null>(null)
const uploadOpen = ref(false)
const uploadQr = ref('')
const uploadToken = ref('')
const uploadUrl = ref('')
const uploadStatus = ref('')
let uploadPoll: ReturnType<typeof setInterval> | undefined

async function search() {
  searchError.value = ''
  if (!query.value.trim()) { searchError.value = '请输入签名编号、姓名或学号'; return }
  searching.value = true
  try { results.value = await searchSignatures(query.value) }
  catch (reason) { searchError.value = reason instanceof Error ? reason.message : '检索失败' }
  finally { searching.value = false }
}
async function selectSignature(choice: SignatureChoice) {
  searching.value = true
  try { store.chooseSignature(await hydrateSignature(choice)) }
  catch (reason) { searchError.value = reason instanceof Error ? reason.message : '签名读取失败' }
  finally { searching.value = false }
}
function loadFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { searchError.value = '请选择 15MB 以内的 JPG、PNG 或 WebP 图片'; return }
  const reader = new FileReader()
  reader.onload = () => store.setPhoto(String(reader.result))
  reader.readAsDataURL(file)
}
async function openCamera() {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
    cameraOpen.value = true
    requestAnimationFrame(() => { if (video.value && stream.value) video.value.srcObject = stream.value })
  } catch { searchError.value = '摄像头不可用，请检查设备权限或改用本地照片' }
}
function closeCamera() { stream.value?.getTracks().forEach((track) => track.stop()); stream.value = null; cameraOpen.value = false }
function capture() {
  if (!video.value) return
  const canvas = document.createElement('canvas')
  canvas.width = video.value.videoWidth || 1280; canvas.height = video.value.videoHeight || 720
  canvas.getContext('2d')?.drawImage(video.value, 0, 0)
  store.setPhoto(canvas.toDataURL('image/jpeg', .92)); closeCamera()
}
async function openPhoneUpload() {
  searchError.value = ''
  if (!window.postcardTerminal) {
    searchError.value = '手机扫码上传需在展厅桌面版中使用；浏览器调试模式可直接选择本地照片'
    return
  }
  try {
    const session = await window.postcardTerminal.createPhotoUpload()
    uploadToken.value = session.token
    uploadUrl.value = session.url
    uploadQr.value = createQrDataUrl(session.url, 420)
    uploadStatus.value = '等待手机上传照片'
    uploadOpen.value = true
    uploadPoll = setInterval(async () => {
      if (!uploadToken.value || !window.postcardTerminal) return
      const result = await window.postcardTerminal.pollPhotoUpload(uploadToken.value)
      if (result.status === 'ready' && result.dataUrl) {
        store.setPhoto(result.dataUrl)
        uploadStatus.value = '照片已接收'
        window.setTimeout(closePhoneUpload, 650)
      } else if (result.status === 'expired') {
        uploadStatus.value = '二维码已过期，请关闭后重新生成'
        if (uploadPoll) clearInterval(uploadPoll)
      }
    }, 1200)
  } catch (reason) {
    searchError.value = reason instanceof Error ? reason.message : '无法启动手机上传'
  }
}
function closePhoneUpload() {
  if (uploadPoll) clearInterval(uploadPoll)
  uploadPoll = undefined
  if (uploadToken.value && window.postcardTerminal) window.postcardTerminal.cancelPhotoUpload(uploadToken.value).catch(() => undefined)
  uploadOpen.value = false
  uploadToken.value = ''
  uploadQr.value = ''
}
function next() { closeCamera(); closePhoneUpload(); store.go('compose') }
onBeforeUnmount(() => { closeCamera(); closePhoneUpload() })
</script>

<template>
  <main class="flow-page source-view">
    <header class="flow-header"><button class="icon-button" aria-label="返回首页" @click="store.go('welcome')"><AppIcon name="back" /></button><div><p>STEP 01 / 03</p><h1>找到你的校园印记</h1><span>照片与签名均可跳过，以匿名方式继续制作</span></div><div class="step-dots"><b /><i /><i /></div></header>
    <section class="source-grid">
      <article class="source-card paper-card">
        <header><span class="number">01</span><div><p>SIGNATURE</p><h2>选择签名</h2></div><AppIcon name="signature" :size="34" /></header>
        <form class="search-box" @submit.prevent="search"><AppIcon name="search" /><input v-model="query" maxlength="80" placeholder="输入姓名、签名编号或学号" autocomplete="off" /><button :disabled="searching">{{ searching ? '检索中' : '查找' }}</button></form>
        <div v-if="store.draft.signature" class="selected-signature"><img :src="store.draft.signature.imageUrl" alt="已选签名" /><div><small>已选择</small><b>{{ store.draft.signature.displayName }}</b><span>{{ store.draft.signature.identityLabel }} · {{ store.draft.signature.id }}</span></div><button class="text-button" @click="store.chooseSignature(null)">移除</button></div>
        <div v-else-if="results.length" class="signature-results">
          <button v-for="choice in results" :key="choice.id" @click="selectSignature(choice)"><span><b>{{ choice.displayName }}</b><small>{{ choice.identityLabel }} · {{ choice.id }}</small></span><AppIcon name="arrow" :size="18" /></button>
        </div>
        <div v-else class="empty-state"><span class="ink-mark">签</span><p>检索已在入口终端留下的签名</p><small>未找到也没关系，可以直接继续</small></div>
      </article>
      <article class="source-card paper-card photo-source">
        <header><span class="number">02</span><div><p>PORTRAIT</p><h2>留下一张照片</h2></div><AppIcon name="camera" :size="34" /></header>
        <div v-if="store.draft.photoDataUrl" class="photo-preview"><img :src="store.draft.photoDataUrl" alt="已选照片" /><div><b>照片已就绪</b><span>系统将自动适配模板取景框</span></div><button class="text-button" @click="store.setPhoto('')">重新选择</button></div>
        <div v-else class="photo-actions">
          <button class="capture-button" @click="openCamera"><span><AppIcon name="camera" :size="32" /></span><b>现场拍照</b><small>使用终端摄像头</small></button>
          <label class="capture-button"><span><AppIcon name="upload" :size="32" /></span><b>选择照片</b><small>支持 JPG / PNG</small><input type="file" accept="image/jpeg,image/png,image/webp" @change="loadFile" /></label>
          <button class="capture-button" @click="openPhoneUpload"><span><AppIcon name="qr" :size="32" /></span><b>手机上传</b><small>扫码从相册发送</small></button>
        </div>
        <div class="privacy-strip"><span>隐私提示</span><p>原始照片默认保留 24 小时，生成结果按系统设置自动清理。</p></div>
      </article>
    </section>
    <p v-if="searchError" class="page-error">{{ searchError }}</p>
    <footer class="flow-actions"><button class="secondary-button" @click="store.go('welcome')">返回</button><button class="primary-button" @click="next">继续制作 <AppIcon name="arrow" /></button></footer>
    <div v-if="cameraOpen" class="camera-layer"><section><header><div><p>LIVE CAMERA</p><h2>请看向镜头</h2></div><button class="icon-button" @click="closeCamera"><AppIcon name="close" /></button></header><video ref="video" autoplay playsinline muted /><p>保持人物位于画面中央，背景将按模板自动裁切</p><button class="shutter" aria-label="拍照" @click="capture"><i /></button></section></div>
    <div v-if="uploadOpen" class="upload-layer">
      <section>
        <header><div><p>MOBILE UPLOAD</p><h2>用手机上传照片</h2></div><button class="icon-button" aria-label="关闭" @click="closePhoneUpload"><AppIcon name="close" /></button></header>
        <div class="upload-body"><img :src="uploadQr" alt="手机照片上传二维码" /><div><span class="seal">传</span><h3>扫描二维码</h3><p>使用手机相机扫码，选择照片并发送。终端收到后会自动关闭此窗口。</p><small>{{ uploadStatus }}</small><code>{{ uploadUrl }}</code></div></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.source-grid{display:grid; min-height:0; grid-template-columns:1fr 1fr; gap:20px}.source-card{display:flex; min-height:0; padding:24px; flex-direction:column}.source-card>header{display:flex; align-items:center; gap:14px; border-bottom:1px solid var(--border-light); padding-bottom:18px}.source-card>header>svg{margin-left:auto;color:var(--green)}.number{display:grid;width:42px;height:42px;place-items:center;border:1px solid var(--red);color:var(--red);font:17px Georgia}.source-card header p{margin:0 0 3px;color:var(--red);font-size:8px;letter-spacing:.22em}.source-card header h2{margin:0;font:500 23px var(--font-serif);letter-spacing:.08em}.search-box{display:grid;margin-top:20px;grid-template-columns:auto 1fr auto;align-items:center;border:1px solid var(--border);border-radius:9px;background:var(--canvas);overflow:hidden}.search-box>svg{margin-left:16px;color:var(--quiet)}.search-box input{height:54px;border:0;padding:0 14px;background:transparent;font-size:14px;outline:0}.search-box button{height:42px;margin-right:6px;padding:0 22px;border:0;border-radius:7px;background:var(--red);color:white}.empty-state{display:grid;min-height:220px;place-content:center;justify-items:center;color:var(--muted);text-align:center}.ink-mark{display:grid;width:72px;height:72px;place-items:center;border:1px solid #d8cfc2;border-radius:50%;color:#b6a894;font:35px var(--font-serif)}.empty-state p{margin:16px 0 5px}.empty-state small{color:var(--quiet)}.signature-results{display:grid;margin-top:14px;overflow:auto}.signature-results button{display:flex;min-height:58px;padding:10px 12px;align-items:center;justify-content:space-between;border:0;border-bottom:1px solid var(--border-light);background:transparent;text-align:left}.signature-results button span{display:grid;gap:4px}.signature-results small{color:var(--quiet);font-size:9px}.selected-signature{display:grid;margin-top:18px;padding:18px;grid-template-columns:140px 1fr auto;align-items:center;gap:18px;border:1px solid #d6dfd7;border-radius:10px;background:#f1f5f0}.selected-signature img{width:140px;height:68px;object-fit:contain}.selected-signature div{display:grid;gap:4px}.selected-signature small{color:var(--green);font-size:9px}.selected-signature span{color:var(--quiet);font-size:9px}.text-button{border:0;background:transparent;color:var(--red)}.photo-actions{display:grid;min-height:250px;margin-top:20px;grid-template-columns:repeat(3,1fr);gap:10px}.capture-button{display:grid;place-content:center;justify-items:center;border:1px dashed var(--border);border-radius:12px;background:var(--canvas);color:var(--ink);gap:8px}.capture-button span{display:grid;width:58px;height:58px;place-items:center;border-radius:50%;background:#efeae0;color:var(--red)}.capture-button small{color:var(--quiet)}.capture-button input{display:none}.photo-preview{position:relative;height:265px;margin-top:18px;overflow:hidden;border-radius:11px}.photo-preview img{width:100%;height:100%;object-fit:cover}.photo-preview div{position:absolute;left:0;right:0;bottom:0;display:grid;padding:34px 18px 15px;background:linear-gradient(transparent,rgba(22,22,19,.76));color:white}.photo-preview div span{font-size:9px;opacity:.75}.photo-preview button{position:absolute;top:10px;right:10px;padding:8px 12px;border-radius:6px;background:#f8f5edcc}.privacy-strip{display:flex;margin-top:auto;padding:12px 14px;align-items:center;gap:12px;border-radius:8px;background:#eee9df;color:var(--muted);font-size:9px}.privacy-strip span{color:var(--red);font-weight:600}.privacy-strip p{margin:0}.page-error{position:absolute;left:50%;bottom:72px;margin:0;padding:8px 15px;border-radius:7px;background:#9f2925;color:white;font-size:11px;transform:translateX(-50%)}.camera-layer,.upload-layer{position:fixed;inset:0;z-index:80;display:grid;padding:4vh;place-items:center;background:rgba(22,22,19,.84);backdrop-filter:blur(8px)}.camera-layer section,.upload-layer section{width:min(920px,86vw);padding:22px;border-radius:18px;background:var(--surface);box-shadow:var(--shadow-dialog)}.camera-layer header,.upload-layer header{display:flex;align-items:center;justify-content:space-between}.camera-layer header p,.upload-layer header p{margin:0;color:var(--red);font-size:8px;letter-spacing:.22em}.camera-layer h2,.upload-layer h2{margin:5px 0 14px;font:500 25px var(--font-serif)}.camera-layer video{display:block;width:100%;max-height:58vh;border-radius:10px;background:#1d1d1b;object-fit:cover;transform:scaleX(-1)}.camera-layer section>p{text-align:center;color:var(--muted);font-size:11px}.shutter{display:grid;width:66px;height:66px;margin:14px auto 0;padding:5px;place-items:center;border:2px solid var(--red);border-radius:50%;background:transparent}.shutter i{width:48px;height:48px;border-radius:50%;background:var(--red)}.upload-body{display:grid;padding:22px;grid-template-columns:320px 1fr;align-items:center;gap:36px;border:1px solid var(--border-light);border-radius:12px;background:var(--canvas)}.upload-body img{width:100%;border:1px solid var(--border-light)}.upload-body h3{margin:18px 0 8px;font:500 26px var(--font-serif)}.upload-body p{max-width:330px;color:var(--muted);font-size:12px;line-height:1.8}.upload-body small{display:block;margin-top:18px;color:var(--green)}.upload-body code{display:block;max-width:340px;margin-top:14px;color:var(--quiet);font-size:9px;overflow-wrap:anywhere;user-select:text}.seal{display:grid;width:50px;height:50px;place-items:center;border:1px solid var(--red);color:var(--red);font:24px var(--font-serif)}
@media(max-width:1120px){.source-card{padding:17px}.photo-actions{min-height:190px}.selected-signature{grid-template-columns:100px 1fr}.selected-signature img{width:100px}.privacy-strip{display:none}}
</style>
