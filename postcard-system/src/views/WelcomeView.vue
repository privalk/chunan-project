<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import { usePostcardStore } from '../stores/postcard'
const store = usePostcardStore()
</script>

<template>
  <main class="welcome-view page-shell paper-field">
    <div class="top-brand"><span class="seal">淳</span><div><b>淳安第三中学</b><small>CHUNAN NO.3 MIDDLE SCHOOL</small></div></div>
    <section class="welcome-copy">
      <p class="eyebrow">ALUMNI POSTCARD · 校友明信片</p>
      <h1>把此刻，<br /><em>寄给未来。</em></h1>
      <p class="intro">选择一段校园记忆，留下一张照片、一句话与熟悉的签名，制作属于你的三中明信片。</p>
      <button class="primary-button start-button" @click="store.go('source')">开始制作 <AppIcon name="arrow" /></button>
      <small class="privacy-note">照片与成品仅用于本次制作，并按系统设定期限自动清理</small>
    </section>
    <section class="postcard-stack" aria-hidden="true">
      <div class="card card-back"><span>写给同桌</span></div>
      <div class="card card-middle"><span>归来仍少年</span></div>
      <div class="card card-front">
        <div class="school-sketch"><i /><i /><i /><b>淳安三中</b></div>
        <p>一纸寄湖山</p><small>让今天成为明日珍藏</small><span class="round-stamp">三中<br />记忆</span>
      </div>
    </section>
    <div class="welcome-footer"><span>01</span><i /><p>触摸屏幕，开始一段校园来信</p></div>
  </main>
</template>

<style scoped>
.welcome-view { position:relative; display:grid; padding:clamp(30px,4vw,72px) clamp(46px,6vw,118px); grid-template-columns:.88fr 1.12fr; align-items:center; }
.top-brand { position:absolute; top:6.2%; left:6.2%; display:flex; align-items:center; gap:14px; }.top-brand .seal { display:grid; width:46px; height:46px; place-items:center; border:2px solid var(--red); color:var(--red); font:700 25px var(--font-serif); }.top-brand div { display:grid; gap:2px; }.top-brand b { font:600 17px var(--font-serif); letter-spacing:.12em; }.top-brand small { color:var(--quiet); font-size:7px; letter-spacing:.16em; }
.welcome-copy { position:relative; z-index:2; max-width:680px; }.eyebrow { margin:0 0 24px; color:var(--red); font-size:12px; font-weight:600; letter-spacing:.26em; }.welcome-copy h1 { margin:0; font:500 clamp(62px,6.2vw,118px)/1.12 var(--font-serif); letter-spacing:.07em; }.welcome-copy h1 em { color:var(--red); font-style:normal; }.intro { max-width:560px; margin:32px 0; color:var(--muted); font-size:clamp(15px,1.25vw,22px); line-height:1.9; }.start-button { width:250px; min-height:68px; font-size:18px; box-shadow:0 12px 30px rgba(159,41,37,.18); }.privacy-note { display:block; margin-top:17px; color:var(--quiet); font-size:11px; }
.postcard-stack { position:relative; width:min(46vw,850px); aspect-ratio:1.24; justify-self:end; }.card { position:absolute; width:78%; aspect-ratio:148/105; border:1px solid #d1c4b3; background:#e7dccb; box-shadow:0 32px 70px rgba(62,48,29,.17); }.card-back { top:1%; right:0; transform:rotate(8deg); }.card-middle { top:10%; right:10%; background:#d9e0d5; transform:rotate(-5deg); }.card-back span,.card-middle span { position:absolute; right:7%; bottom:7%; color:#766b5e; font:22px var(--font-serif); }.card-front { top:13%; right:7%; padding:8%; background:#efe5d4; transform:rotate(2deg); }.school-sketch { display:grid; height:56%; place-items:end center; border-bottom:1px solid #a4937e; background:linear-gradient(155deg,transparent 60%,rgba(105,130,110,.12)); }.school-sketch i { position:absolute; top:20%; left:18%; width:57%; height:25%; border:2px solid #847665; }.school-sketch i:nth-child(2) { top:26%; left:23%; width:47%; height:19%; background:repeating-linear-gradient(90deg,transparent 0 13%,#8b7e6c 13% 14%); }.school-sketch i:nth-child(3) { top:17%; left:42%; width:8%; height:7%; border-radius:50% 50% 0 0; }.school-sketch b { margin-bottom:4%; font:500 clamp(20px,2.2vw,40px) var(--font-serif); letter-spacing:.2em; }.card-front > p { margin:6% 0 1%; color:var(--red); font:500 clamp(22px,2.4vw,43px) var(--font-serif); }.card-front > small { color:#7e7367; font-size:clamp(9px,.9vw,14px); letter-spacing:.12em; }.round-stamp { position:absolute; right:8%; bottom:8%; display:grid; width:16%; aspect-ratio:1; place-items:center; border:4px double var(--red); border-radius:50%; color:var(--red); font:600 clamp(12px,1.2vw,21px)/1.2 var(--font-serif); text-align:center; transform:rotate(-12deg); }
.welcome-footer { position:absolute; left:6.2%; bottom:5%; display:flex; align-items:center; gap:12px; color:var(--quiet); font-size:10px; letter-spacing:.12em; }.welcome-footer span { color:var(--red); font:18px Georgia,serif; }.welcome-footer i { width:56px; border-top:1px solid var(--border); }
@media(max-width:1200px){.welcome-view{grid-template-columns:.85fr 1.15fr}.welcome-copy h1{font-size:64px}.postcard-stack{width:50vw}.intro{font-size:15px}.start-button{min-height:58px}}
@media(max-height:760px){.welcome-copy{transform:translateY(38px)}.top-brand{top:4.5%}.welcome-footer{bottom:3%}}
</style>
