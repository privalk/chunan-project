<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const roleName = computed(() => ({ admin: '系统管理员', operator: '业务管理员', auditor: '只读审计' }[auth.user?.role || 'auditor']))
const dateText = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const navItems = computed(() => [
  { to: '/', icon: 'dashboard' as const, label: '运行总览', hint: 'Overview' },
  { to: '/signatures', icon: 'signature' as const, label: '签名档案', hint: 'Archive' },
  { to: '/reviews', icon: 'review' as const, label: '上墙审核', hint: 'Wall review' },
  { to: '/postcards', icon: 'postcard' as const, label: '校友明信片', hint: 'Postcards' },
  { to: '/terminals', icon: 'terminal' as const, label: '终端状态', hint: 'Terminals' },
  { to: '/audit', icon: 'audit' as const, label: '审计日志', hint: 'Audit' },
  ...(auth.isAdmin ? [
    { to: '/users', icon: 'users' as const, label: '账号权限', hint: 'Access' },
    { to: '/settings', icon: 'settings' as const, label: '系统设置', hint: 'Settings' },
  ] : []),
])

async function logout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-seal"><span>淳安</span><strong>三</strong><small>中</small></div>
        <div><p>CHUN'AN NO.3</p><h2>展厅管理中心</h2><span>数字内容与终端</span></div>
      </div>

      <div class="nav-caption"><span />业务管理<span /></div>
      <nav aria-label="后台功能导航">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ active: route.path === item.to }">
          <span class="nav-icon"><AppIcon :name="item.icon" /></span>
          <span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
          <i />
        </RouterLink>
      </nav>

      <div class="sidebar-foot">
        <div class="service-state"><i />服务运行正常</div>
        <div class="user-card">
          <div class="avatar">{{ auth.user?.displayName.slice(0, 1) }}</div>
          <div><strong>{{ auth.user?.displayName }}</strong><small>{{ roleName }}</small></div>
          <button aria-label="退出登录" title="退出登录" @click="logout"><AppIcon name="logout" /></button>
        </div>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div><p>{{ route.meta.eyebrow }}</p><strong>{{ route.meta.title }}</strong></div>
        <div class="topbar-meta"><span>{{ dateText }}</span><i /><span class="system-dot">内网私有化运行</span></div>
      </header>
      <main class="page-content"><RouterView /></main>
    </section>
  </div>
</template>

<style scoped>
.admin-shell { display: grid; min-height: 100vh; grid-template-columns: 264px 1fr; background: var(--ca-paper); }
.sidebar { position: fixed; inset: 0 auto 0 0; z-index: 10; display: flex; width: 264px; padding: 28px 20px 22px; flex-direction: column; border-right: 1px solid #ded7ca; background: #f1ede4; }
.sidebar::before { content: ''; position: absolute; inset: 0; opacity: .18; pointer-events: none; background-image: linear-gradient(rgba(80,65,44,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(80,65,44,.07) 1px, transparent 1px); background-size: 52px 52px; mask-image: linear-gradient(to bottom, black, transparent 70%); }
.brand { position: relative; display: flex; align-items: center; gap: 13px; padding: 0 8px 29px; }
.brand-seal { position: relative; display: grid; width: 58px; height: 58px; flex: 0 0 58px; place-content: center; border: 1.5px solid var(--ca-red); border-radius: 50%; color: var(--ca-red); text-align: center; box-shadow: inset 0 0 0 4px #f1ede4, inset 0 0 0 5px var(--ca-red); }
.brand-seal span { position: absolute; top: 6px; left: 0; width: 100%; font-size: 6px; letter-spacing: .18em; text-indent: .18em; }.brand-seal strong { font: 600 23px/17px var(--ca-font-display); }.brand-seal small { font: 600 10px var(--ca-font-display); }
.brand p { margin: 0 0 3px; color: var(--ca-quiet); font-size: 7px; letter-spacing: .22em; }.brand h2 { margin: 0; font: 600 17px var(--ca-font-display); letter-spacing: .1em; }.brand div:last-child > span { color: var(--ca-muted); font-size: 10px; letter-spacing: .12em; }
.nav-caption { position: relative; display: flex; align-items: center; gap: 8px; margin: 0 8px 12px; color: #aaa194; font-size: 9px; letter-spacing: .14em; }.nav-caption span { width: 15px; height: 1px; background: #d2c9bb; }
nav { position: relative; display: grid; gap: 5px; }
nav a { position: relative; display: grid; min-height: 58px; padding: 0 13px; grid-template-columns: 36px 1fr 3px; align-items: center; border: 1px solid transparent; border-radius: 10px; color: #746d62; }
nav a:hover { background: rgba(255,255,255,.42); } nav a.active { border-color: rgba(159,41,37,.11); background: rgba(255,255,255,.7); color: var(--ca-red); box-shadow: 0 5px 16px rgba(70,52,27,.04); }
.nav-icon { display: grid; width: 30px; height: 30px; place-items: center; font-size: 17px; }.nav-icon + span { display: flex; flex-direction: column; gap: 2px; }.nav-icon + span strong { font-size: 13px; font-weight: 500; }.nav-icon + span small { color: #aaa194; font-size: 8px; letter-spacing: .08em; }.nav-icon ~ i { width: 3px; height: 22px; border-radius: 2px; background: transparent; }nav a.active i { background: var(--ca-red); }
.sidebar-foot { position: relative; margin-top: auto; }.service-state { display: flex; margin: 0 12px 14px; align-items: center; gap: 8px; color: #7e8e80; font-size: 10px; }.service-state i { width: 6px; height: 6px; border-radius: 50%; background: var(--ca-green); box-shadow: 0 0 0 4px rgba(106,136,115,.11); }
.user-card { display: grid; min-height: 64px; padding: 9px; grid-template-columns: 40px 1fr 34px; align-items: center; gap: 10px; border: 1px solid #ddd5c8; border-radius: 11px; background: rgba(251,250,246,.72); }.avatar { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 50%; background: var(--ca-red); color: white; font: 500 16px var(--ca-font-display); }.user-card div:nth-child(2) { display: flex; min-width: 0; flex-direction: column; gap: 3px; }.user-card strong { overflow: hidden; font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }.user-card small { color: var(--ca-quiet); font-size: 9px; }.user-card button { display: grid; width: 34px; height: 34px; padding: 0; place-items: center; border: 0; border-radius: 7px; background: transparent; color: #8d8579; }.user-card button:hover { background: #eee8dd; color: var(--ca-red); }
.workspace { grid-column: 2; min-width: 0; }.topbar { position: sticky; top: 0; z-index: 8; display: flex; height: 78px; padding: 0 38px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--ca-border-light); background: rgba(246,243,236,.92); backdrop-filter: blur(12px); }.topbar > div:first-child { display: flex; align-items: baseline; gap: 12px; }.topbar p { margin: 0; color: var(--ca-red); font: 600 8px var(--ca-font-ui); letter-spacing: .22em; }.topbar strong { font: 500 17px var(--ca-font-display); letter-spacing: .1em; }.topbar-meta { display: flex; align-items: center; gap: 14px; color: var(--ca-quiet); font-size: 10px; }.topbar-meta > i { width: 1px; height: 14px; background: var(--ca-border); }.system-dot::before { content: ''; display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: var(--ca-green); }
.page-content { padding: 32px 38px 44px; }
@media (max-width: 1250px) { .admin-shell { grid-template-columns: 232px 1fr; }.sidebar { width: 232px; }.brand h2 { font-size: 15px; }.page-content { padding-inline: 28px; } }
</style>
