<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { usePostcardStore } from '../stores/postcard'
import { createQrDataUrl } from '../utils/qrcode'

const store = usePostcardStore()
const qrDataUrl = ref('')
const exporting = ref('')
const message = ref('')

onMounted(async () => {
  if (!store.result) return store.reset()
  try { qrDataUrl.value = createQrDataUrl(store.result.pickupUrl, 360) }
  catch { qrDataUrl.value = '' }
})

async function exportFile(format: 'png' | 'jpeg' | 'pdf') {
  if (!store.result || exporting.value) return
  exporting.value = format
  try {
    if (window.postcardTerminal) {
      const response = await window.postcardTerminal.exportPostcard({ id: store.draft.id, format, dataUrl: format === 'jpeg' ? undefined : store.result.pngDataUrl })
      message.value = response.cancelled ? '' : `${format.toUpperCase()} 已保存`
    } else if (format !== 'pdf') {
      const link = document.createElement('a'); link.href = store.result.pngDataUrl; link.download = `${store.draft.id}.${format === 'jpeg' ? 'jpg' : 'png'}`; link.click()
    } else window.print()
  } catch (reason) { message.value = reason instanceof Error ? reason.message : '导出失败' }
  finally { exporting.value = '' }
}
</script>

<template>
  <main v-if="store.result" class="result-view paper-field">
    <div class="result-decoration" aria-hidden="true"><i /><i /><i /></div>
    <header><span class="seal">淳</span><div><b>淳安第三中学</b><small>ALUMNI POSTCARD</small></div></header>
    <section class="result-copy">
      <span class="success-mark"><AppIcon name="check" :size="42" /></span>
      <p>POSTCARD COMPLETED</p>
      <h1>明信片已珍藏</h1>
      <div class="result-status"><span v-if="store.result.printed"><i />已加入打印队列</span><span><i />高清文件已生成</span></div>
      <p class="tip">{{ store.result.printed ? '请稍候在取件区领取打印成品，也可扫码保存到手机。' : '请使用手机扫码，在校内网络中领取高清成品。' }}</p>
      <button class="primary-button restart" @click="store.reset">再制作一张 <AppIcon name="arrow" /></button>
      <span class="auto-note">页面将在操作超时后自动回到首页</span>
    </section>
    <section class="result-card">
      <div class="mini-postcard"><img :src="store.result.pngDataUrl" alt="生成的明信片" /><span>{{ store.draft.id }}</span></div>
      <div class="pickup">
        <div class="qr-wrap"><img v-if="qrDataUrl" :src="qrDataUrl" alt="手机取件二维码" /><span v-else>取件码<br />{{ store.draft.id.slice(-8) }}</span></div>
        <div><p>SCAN TO DOWNLOAD</p><h2>扫码领取高清成品</h2><span>请连接展厅 Wi-Fi 后使用手机扫码</span></div>
      </div>
      <div class="export-row"><button @click="exportFile('png')"><AppIcon name="download" :size="17" />PNG</button><button @click="exportFile('jpeg')"><AppIcon name="download" :size="17" />JPG</button><button @click="exportFile('pdf')"><AppIcon name="download" :size="17" />PDF</button></div>
      <p v-if="message" class="export-message">{{ message }}</p>
    </section>
    <footer>一纸寄湖山 · 一念念三中</footer>
  </main>
</template>

<style scoped>
.result-view{position:relative;display:grid;height:100%;padding:6vh 7vw;grid-template-columns:.78fr 1.22fr;align-items:center;overflow:hidden}.result-view>header{position:absolute;top:5%;left:6%;display:flex;align-items:center;gap:12px}.seal{display:grid;width:42px;height:42px;place-items:center;border:2px solid var(--red);color:var(--red);font:700 23px var(--font-serif)}header>div{display:grid}header b{font:600 15px var(--font-serif);letter-spacing:.12em}header small{color:var(--quiet);font-size:7px;letter-spacing:.18em}.result-copy{position:relative;z-index:2;max-width:560px}.success-mark{display:grid;width:76px;height:76px;margin-bottom:22px;place-items:center;border:1px solid #b9cabd;border-radius:50%;background:#edf2ec;color:var(--green)}.result-copy>p:nth-of-type(1){margin:0;color:var(--red);font-size:9px;letter-spacing:.24em}.result-copy h1{margin:10px 0 22px;font:500 clamp(45px,4.4vw,78px) var(--font-serif);letter-spacing:.1em}.result-status{display:flex;gap:18px;color:var(--green);font-size:11px}.result-status span{display:flex;align-items:center;gap:7px}.result-status i{width:7px;height:7px;border-radius:50%;background:var(--green)}.tip{max-width:450px;margin:24px 0;color:var(--muted);font-size:15px;line-height:1.8}.restart{min-width:210px;min-height:58px}.auto-note{display:block;margin-top:13px;color:var(--quiet);font-size:9px}.result-card{position:relative;z-index:2;width:min(760px,48vw);padding:24px;justify-self:end;border:1px solid var(--border);background:var(--surface);box-shadow:0 28px 70px rgba(62,47,28,.15)}.mini-postcard{position:relative}.mini-postcard>img{display:block;width:100%}.mini-postcard>span{position:absolute;right:10px;bottom:8px;padding:4px 8px;background:#fffefbc9;color:var(--quiet);font-size:7px}.pickup{display:grid;margin-top:18px;grid-template-columns:126px 1fr;align-items:center;gap:18px}.qr-wrap{display:grid;width:126px;height:126px;padding:5px;place-items:center;border:1px solid var(--border);background:white;text-align:center}.qr-wrap img{width:100%;height:100%}.pickup p{margin:0;color:var(--red);font-size:7px;letter-spacing:.22em}.pickup h2{margin:7px 0 5px;font:500 21px var(--font-serif)}.pickup span{color:var(--quiet);font-size:9px}.export-row{display:flex;margin-top:-43px;justify-content:flex-end;gap:7px}.export-row button{display:flex;min-height:38px;padding:0 11px;align-items:center;gap:5px;border:1px solid var(--border);border-radius:6px;background:var(--canvas);color:var(--muted);font-size:9px}.export-message{margin:8px 0 0;color:var(--green);font-size:9px;text-align:right}.result-view>footer{position:absolute;left:6%;bottom:5%;color:var(--quiet);font:11px var(--font-serif);letter-spacing:.15em}.result-decoration{position:absolute;inset:0;pointer-events:none}.result-decoration i{position:absolute;border:1px solid rgba(106,136,115,.12);border-radius:50%}.result-decoration i:nth-child(1){width:42vw;height:42vw;right:-15vw;top:-21vw}.result-decoration i:nth-child(2){width:52vw;height:52vw;right:-20vw;top:-26vw}.result-decoration i:nth-child(3){width:62vw;height:62vw;right:-25vw;top:-31vw}
@media(max-width:1200px){.result-view{padding:5vh 6vw}.result-copy h1{font-size:48px}.result-card{width:52vw}.pickup{grid-template-columns:100px 1fr}.qr-wrap{width:100px;height:100px}.export-row{margin-top:-30px}}
</style>
