<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { getSignatureCount } from '../utils/storage'

defineEmits<{ start: [] }>()

const signatureCount = ref(0)

onMounted(async () => {
  try {
    signatureCount.value = await getSignatureCount()
  } catch {
    signatureCount.value = 0
  }
})
</script>

<template>
  <main class="home-view">
    <div class="home-grid" aria-hidden="true" />
    <section class="brand-block">
      <div class="school-seal">
        <span class="seal-ring">淳安</span>
        <strong>三</strong>
        <small>中</small>
      </div>
      <div>
        <p class="brand-en">CHUN'AN NO.3 MIDDLE SCHOOL</p>
        <h1>淳安第三中学</h1>
        <p class="brand-subtitle">校史文化展厅 · 添砖加瓦互动墙</p>
      </div>
    </section>

    <section class="welcome-panel">
      <p class="eyebrow">LEAVE YOUR MARK</p>
      <h2>一笔一画，<br /><em>共筑我们的故事</em></h2>
      <p class="welcome-copy">留下您的名字，让记忆成为校园历史的一部分。</p>
      <button class="start-button" @click="$emit('start')">
        <span class="start-icon"><AppIcon name="pen" /></span>
        <span><small>TOUCH TO START</small>开始签名</span>
        <AppIcon name="arrow" />
      </button>
      <p class="interaction-hint"><span /> 轻触屏幕开始 · 支持手指与触控笔 <span /></p>
    </section>

    <footer>
      <p>CHUN'AN · ZHEJIANG</p>
      <div class="today-count">
        <span>本机已珍藏</span>
        <strong>{{ signatureCount }}</strong>
        <span>份签名</span>
      </div>
      <p>EST. 1958</p>
    </footer>
  </main>
</template>

<style scoped>
.home-view { position: relative; min-height: 100%; overflow: hidden; background: #f5f2ea; }
.home-view::before { content: ''; position: absolute; top: -22vw; right: -10vw; width: 60vw; height: 60vw; border: 1px solid rgba(159, 41, 37, .1); border-radius: 50%; box-shadow: 0 0 0 7vw rgba(159, 41, 37, .025), 0 0 0 14vw rgba(159, 41, 37, .02); }
.home-grid { position: absolute; inset: 0; opacity: .25; background-image: linear-gradient(rgba(80, 65, 44, .07) 1px, transparent 1px), linear-gradient(90deg, rgba(80, 65, 44, .07) 1px, transparent 1px); background-size: 80px 80px; mask-image: linear-gradient(to right, black, transparent 80%); }
.brand-block { position: relative; z-index: 1; display: flex; align-items: center; gap: 22px; padding: clamp(30px, 4vw, 64px) clamp(40px, 6vw, 110px); }
.school-seal { position: relative; display: grid; width: 82px; height: 82px; flex: 0 0 82px; place-content: center; border: 2px solid var(--red); border-radius: 50%; color: var(--red); text-align: center; box-shadow: inset 0 0 0 5px #f5f2ea, inset 0 0 0 6px var(--red); }
.school-seal strong { font: 600 32px/24px var(--font-serif); }
.school-seal small { font: 600 15px/18px var(--font-serif); }
.seal-ring { position: absolute; top: 8px; left: 0; width: 100%; font: 9px var(--font-sans); letter-spacing: .35em; text-indent: .35em; }
.brand-en { margin: 0 0 4px; color: #958b7c; font: 500 10px var(--font-sans); letter-spacing: .2em; }
.brand-block h1 { margin: 0; color: #34342f; font: 600 clamp(24px, 2.4vw, 36px) var(--font-serif); letter-spacing: .14em; }
.brand-subtitle { margin: 8px 0 0; color: #726b60; font-size: 14px; letter-spacing: .16em; }
.welcome-panel { position: relative; z-index: 2; width: min(760px, 72vw); margin: clamp(20px, 6vh, 80px) auto 0; text-align: center; }
.eyebrow { margin: 0; color: var(--red); font-size: 11px; font-weight: 600; letter-spacing: .42em; }
.eyebrow::before, .eyebrow::after { content: ''; display: inline-block; width: 38px; height: 1px; margin: 0 16px 4px; background: rgba(159, 41, 37, .42); }
h2 { margin: 22px 0; color: #30312d; font: 500 clamp(44px, 5.2vw, 78px)/1.32 var(--font-serif); letter-spacing: .08em; }
h2 em { color: var(--red); font-style: normal; }
.welcome-copy { margin: 0 0 38px; color: #756f64; font: 17px var(--font-serif); letter-spacing: .12em; }
.start-button { display: grid; width: min(420px, 80vw); min-height: 88px; margin: 0 auto; padding: 12px 20px 12px 14px; grid-template-columns: 62px 1fr 32px; align-items: center; border: 0; border-radius: 44px; background: var(--red); color: white; box-shadow: 0 14px 34px rgba(112, 27, 24, .24); font: 500 24px var(--font-serif); letter-spacing: .12em; transition: transform .18s ease, box-shadow .18s ease; }
.start-button:active { transform: scale(.98); box-shadow: 0 7px 18px rgba(112, 27, 24, .2); }
.start-button small { display: block; margin-bottom: 3px; color: rgba(255,255,255,.65); font: 8px var(--font-sans); letter-spacing: .2em; }
.start-icon { display: grid; width: 58px; height: 58px; place-items: center; border-radius: 50%; background: rgba(255,255,255,.13); font-size: 28px; }
.interaction-hint { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 24px; color: #aaa194; font-size: 12px; letter-spacing: .08em; }
.interaction-hint span { width: 24px; height: 1px; background: #d7d0c4; }
footer { position: absolute; right: clamp(40px, 6vw, 110px); bottom: 32px; left: clamp(40px, 6vw, 110px); z-index: 2; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; color: #a49c90; font-size: 9px; letter-spacing: .2em; }
footer p:last-child { text-align: right; }
.today-count { display: flex; align-items: baseline; gap: 8px; font-size: 12px; letter-spacing: .08em; }
.today-count strong { color: var(--red); font: 500 28px var(--font-serif); }
@media (max-height: 780px) { .welcome-panel { margin-top: 0; } h2 { margin: 10px 0; font-size: 44px; } .welcome-copy { margin-bottom: 18px; } }
</style>
