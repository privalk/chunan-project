<script setup lang="ts">
import { ref } from 'vue'
import HomeView from './views/HomeView.vue'
import IdentityView from './views/IdentityView.vue'
import CaptureView from './views/CaptureView.vue'
import AppIcon from './components/AppIcon.vue'
import type { SignatureContext } from './types/signature'

type Screen = 'home' | 'identity' | 'capture' | 'success'
const screen = ref<Screen>('home')
const savedId = ref('')
const savedName = ref('')
const participant = ref<SignatureContext>({ identity_type: 'anonymous', template_id: 'exhibition-wall' })
let successTimer: number | undefined

function startCapture() {
  window.signatureTerminal?.enterFullscreen().catch(() => undefined)
  participant.value = { identity_type: 'anonymous', template_id: 'exhibition-wall' }
  screen.value = 'identity'
}

function confirmIdentity(context: SignatureContext) {
  participant.value = context
  screen.value = 'capture'
}

function showSuccess(id: string, displayName?: string) {
  savedId.value = id
  savedName.value = displayName || ''
  screen.value = 'success'
  window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => { screen.value = 'home' }, 5000)
}

function returnHome() {
  window.clearTimeout(successTimer)
  participant.value = { identity_type: 'anonymous', template_id: 'exhibition-wall' }
  screen.value = 'home'
}
</script>

<template>
  <HomeView v-if="screen === 'home'" @start="startCapture" />
  <IdentityView v-else-if="screen === 'identity'" :initial="participant" @home="returnHome" @continue="confirmIdentity" />
  <CaptureView v-else-if="screen === 'capture'" :context="participant" @back="screen = 'identity'" @home="returnHome" @saved="showSuccess" />
  <main v-else class="success-view" @click="returnHome">
    <div class="success-rings" aria-hidden="true"><i /><i /><i /></div>
    <section>
      <div class="success-check"><AppIcon name="check" /></div>
      <p class="eyebrow">SIGNATURE SAVED</p>
      <h1>签名已珍藏</h1>
      <p>{{ savedName ? `${savedName}，签名已珍藏，审核通过后将在展示墙呈现` : '签名已珍藏，审核通过后将在展示墙呈现' }}</p>
      <div class="saved-number"><span>您的签名编号</span><strong>{{ savedId }}</strong></div>
      <button class="primary-button" @click.stop="returnHome">完成并返回首页</button>
      <small>页面将在 5 秒后自动返回</small>
    </section>
  </main>
</template>

<style scoped>
.success-view { position: relative; display: grid; min-height: 100%; place-items: center; overflow: hidden; background: #f5f2ea; text-align: center; }
.success-rings { position: absolute; inset: 0; display: grid; place-items: center; }
.success-rings i { position: absolute; width: 38vw; height: 38vw; border: 1px solid rgba(159, 41, 37, .09); border-radius: 50%; animation: bloom .8s ease both; }
.success-rings i:nth-child(2) { width: 55vw; height: 55vw; animation-delay: .1s; }.success-rings i:nth-child(3) { width: 72vw; height: 72vw; animation-delay: .2s; }
.success-view section { position: relative; z-index: 1; }
.success-check { display: grid; width: 96px; height: 96px; margin: 0 auto 24px; place-items: center; border-radius: 50%; background: #6a8873; color: white; font-size: 47px; box-shadow: 0 12px 32px rgba(74, 104, 82, .22); }
.eyebrow { color: #8e8578; font: 600 10px var(--font-sans); letter-spacing: .35em; }
h1 { margin: 15px 0; color: #30312d; font: 500 clamp(44px, 5vw, 70px) var(--font-serif); letter-spacing: .12em; }
section > p:not(.eyebrow) { color: #7b7469; font: 17px var(--font-serif); letter-spacing: .08em; }
.saved-number { display: flex; width: min(440px, 78vw); margin: 32px auto; padding: 18px 26px; align-items: center; justify-content: space-between; border: 1px solid #ddd5c8; border-radius: 10px; background: rgba(255,255,255,.58); color: #8c8478; font-size: 12px; }
.saved-number strong { color: var(--red); font-size: 15px; letter-spacing: .05em; }
.success-view button { min-width: 250px; min-height: 60px; }
.success-view section > small { display: block; margin-top: 18px; color: #aba397; }
@keyframes bloom { from { opacity: 0; transform: scale(.75); } }
</style>
