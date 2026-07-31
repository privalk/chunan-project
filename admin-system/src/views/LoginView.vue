<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const username = ref('admin')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (!username.value || !password.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    await router.replace(String(route.query.redirect || '/'))
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '登录失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-view">
    <div class="login-grid" aria-hidden="true" />
    <div class="login-rings" aria-hidden="true"><i /><i /><i /></div>
    <section class="identity-panel">
      <div class="large-seal"><span>淳安</span><strong>三</strong><small>中</small></div>
      <p class="eyebrow">CHUN'AN NO.3 MIDDLE SCHOOL</p>
      <h1>珍藏每一笔<br /><em>守护校园记忆</em></h1>
      <p>签名、展示墙、校友明信片与终端设备的统一管理中心</p>
      <footer><span>CHUN'AN · ZHEJIANG</span><span>PRIVATE DEPLOYMENT</span></footer>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <p class="eyebrow">ADMINISTRATION</p>
        <h2>管理后台登录</h2>
        <p class="lead">请使用已授权的管理账号进入系统</p>
        <form @submit.prevent="submit">
          <div class="field"><label for="username">管理账号</label><input id="username" v-model="username" autocomplete="username" placeholder="请输入账号" /></div>
          <div class="field"><label for="password">登录密码</label><input id="password" v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></div>
          <p v-if="error" class="login-error"><AppIcon name="warning" />{{ error }}</p>
          <button class="login-button" :disabled="loading || !username || !password">
            <span v-if="loading" class="spinner" />
            <template v-else>进入管理中心 <span>→</span></template>
          </button>
        </form>
        <div class="security-note"><i />账号操作将被记录至审计日志</div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-view { position: relative; display: grid; min-height: 100vh; grid-template-columns: 1.08fr .92fr; overflow: hidden; background: var(--ca-paper-soft); }
.login-grid { position: absolute; inset: 0 46% 0 0; opacity: .22; background-image: linear-gradient(rgba(80,65,44,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(80,65,44,.07) 1px, transparent 1px); background-size: 72px 72px; }
.login-rings { position: absolute; top: -28vw; left: -21vw; width: 75vw; height: 75vw; border: 1px solid rgba(159,41,37,.08); border-radius: 50%; box-shadow: 0 0 0 8vw rgba(159,41,37,.018), 0 0 0 16vw rgba(159,41,37,.015); }
.identity-panel { position: relative; z-index: 1; display: flex; padding: 8vh 8vw 6vh; flex-direction: column; justify-content: center; }
.large-seal { position: relative; display: grid; width: 88px; height: 88px; margin-bottom: 32px; place-content: center; border: 2px solid var(--ca-red); border-radius: 50%; color: var(--ca-red); text-align: center; box-shadow: inset 0 0 0 6px var(--ca-paper-soft), inset 0 0 0 7px var(--ca-red); }.large-seal span { position: absolute; top: 9px; left: 0; width: 100%; font-size: 9px; letter-spacing: .3em; text-indent: .3em; }.large-seal strong { font: 600 34px/25px var(--ca-font-display); }.large-seal small { font: 600 15px var(--ca-font-display); }
.eyebrow { margin: 0; color: var(--ca-red); font-size: 9px; font-weight: 600; letter-spacing: .3em; }
.identity-panel h1 { margin: 18px 0 20px; color: var(--ca-ink); font: 500 clamp(46px, 4.6vw, 72px)/1.35 var(--ca-font-display); letter-spacing: .08em; }.identity-panel h1 em { color: var(--ca-red); font-style: normal; }.identity-panel > p:last-of-type { max-width: 520px; margin: 0; color: var(--ca-muted); font: 16px/1.9 var(--ca-font-display); letter-spacing: .08em; }
.identity-panel footer { position: absolute; right: 7vw; bottom: 32px; left: 8vw; display: flex; justify-content: space-between; color: #a49c90; font-size: 8px; letter-spacing: .2em; }
.login-panel { position: relative; z-index: 2; display: grid; place-items: center; padding: 40px; border-left: 1px solid rgba(221,214,202,.7); background: rgba(251,250,246,.62); backdrop-filter: blur(8px); }
.login-card { width: min(430px, 88%); padding: 44px 42px 38px; border: 1px solid var(--ca-border-light); border-radius: 20px; background: rgba(255,254,251,.86); box-shadow: 0 24px 70px rgba(61,47,28,.1); }
.login-card h2 { margin: 11px 0 8px; font: 500 34px var(--ca-font-display); letter-spacing: .1em; }.lead { margin: 0 0 28px; color: var(--ca-muted); font-size: 13px; }.login-card form { display: grid; gap: 18px; }.login-card input { min-height: 52px; background: white; }.login-button { display: flex; min-height: 58px; margin-top: 5px; align-items: center; justify-content: center; gap: 18px; border: 0; border-radius: 9px; background: var(--ca-red); color: white; box-shadow: var(--ca-shadow-primary); font: 500 17px var(--ca-font-display); letter-spacing: .1em; }.login-button span:last-child { font-family: var(--ca-font-ui); font-size: 22px; }.login-button:disabled { opacity: .55; }.login-error { display: flex; margin: -2px 0; align-items: center; gap: 8px; color: var(--ca-red); font-size: 12px; }.security-note { display: flex; margin-top: 25px; align-items: center; justify-content: center; gap: 8px; color: var(--ca-quiet); font-size: 10px; }.security-note i { width: 6px; height: 6px; border-radius: 50%; background: var(--ca-green); }
</style>
