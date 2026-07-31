import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'
import AdminLayout from './layouts/AdminLayout.vue'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'
import SignaturesView from './views/SignaturesView.vue'
import TerminalsView from './views/TerminalsView.vue'
import AuditView from './views/AuditView.vue'
import UsersView from './views/UsersView.vue'
import SettingsView from './views/SettingsView.vue'
import ReviewsView from './views/ReviewsView.vue'
import PostcardsView from './views/PostcardsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true, title: '登录' } },
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: '', name: 'dashboard', component: DashboardView, meta: { title: '运行总览', eyebrow: 'OVERVIEW' } },
        { path: 'signatures', name: 'signatures', component: SignaturesView, meta: { title: '签名档案', eyebrow: 'SIGNATURE ARCHIVE' } },
        { path: 'reviews', name: 'reviews', component: ReviewsView, meta: { title: '上墙审核', eyebrow: 'WALL REVIEW' } },
        { path: 'postcards', name: 'postcards', component: PostcardsView, meta: { title: '校友明信片', eyebrow: 'ALUMNI POSTCARD' } },
        { path: 'terminals', name: 'terminals', component: TerminalsView, meta: { title: '终端状态', eyebrow: 'TERMINAL STATUS' } },
        { path: 'audit', name: 'audit', component: AuditView, meta: { title: '审计日志', eyebrow: 'AUDIT TRAIL' } },
        { path: 'users', name: 'users', component: UsersView, meta: { title: '账号权限', eyebrow: 'ACCESS CONTROL', adminOnly: true } },
        { path: 'settings', name: 'settings', component: SettingsView, meta: { title: '系统设置', eyebrow: 'SYSTEM SETTINGS', adminOnly: true } },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const user = await auth.ensure()
  if (to.meta.public) return user ? { name: 'dashboard' } : true
  if (!user) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.adminOnly && user.role !== 'admin') return { name: 'dashboard' }
  return true
})

export default router
