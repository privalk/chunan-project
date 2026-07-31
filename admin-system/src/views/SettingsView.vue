<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import AppIcon from '../components/AppIcon.vue'
import type { SystemSettings } from '../types'

const settings = reactive<SystemSettings>({
  retention_days: 365, auto_archive_days: 90, online_threshold_seconds: 120, school_name: '淳安第三中学',
  wall_layout: 'brick', wall_title: '一笔一画，汇成三中记忆', wall_refresh_seconds: 5, wall_rotation_seconds: 20,
  postcard_session_timeout_seconds: 180, postcard_result_retention_days: 14, postcard_original_retention_hours: 24,
  postcard_max_print_copies: 2, postcard_min_print_interval_seconds: 15,
})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const toast = ref(false)
const showPurge = ref(false)
const purging = ref(false)

async function load() {
  loading.value = true
  try { Object.assign(settings, (await api<{ settings: SystemSettings }>('/api/settings')).settings) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '读取设置失败' }
  finally { loading.value = false }
}

async function save() {
  saving.value = true; error.value = ''
  try {
    const result = await api<{ settings: SystemSettings }>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) })
    Object.assign(settings, result.settings); toast.value = true; window.setTimeout(() => { toast.value = false }, 3000)
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '设置保存失败' }
  finally { saving.value = false }
}

async function purgeExpired() {
  purging.value = true
  error.value = ''
  try {
    const result = await api<{ purged: number }>('/api/maintenance/purge', { method: 'POST', body: JSON.stringify({ olderThanDays: settings.retention_days }) })
    showPurge.value = false
    if (result.purged === 0) error.value = '没有超过留存期限的回收记录需要清理'
    else { toast.value = true; window.setTimeout(() => { toast.value = false }, 3000) }
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '数据清理失败' }
  finally { purging.value = false }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">SYSTEM SETTINGS</p><h1>系统设置</h1><p class="description">配置数据留存、终端监测与签名展示墙运行方式</p></div></div>
    <div v-if="loading" class="loading-line" />
    <form v-else class="settings-layout" @submit.prevent="save">
      <article class="settings-card paper-card"><header><div class="section-mark">档</div><div><p>ARCHIVE POLICY</p><h2>档案留存策略</h2><span>策略变更后将立即执行一次自动归档检查</span></div></header><div class="settings-fields"><div class="field"><label for="retention">数据留存期限（天）</label><input id="retention" v-model.number="settings.retention_days" type="number" min="1" max="3650" /><small>用于后续清理策略，建议不少于 365 天</small></div><div class="field"><label for="archive">自动归档时间（天）</label><input id="archive" v-model.number="settings.auto_archive_days" type="number" min="0" max="3650" /><small>超过该天数的在库签名自动转为归档；0 表示关闭</small></div></div></article>
      <article class="settings-card paper-card"><header><div class="section-mark">端</div><div><p>TERMINAL POLICY</p><h2>终端监测策略</h2><span>控制后台对终端在线与离线状态的判定</span></div></header><div class="settings-fields"><div class="field"><label for="threshold">离线判定阈值（秒）</label><input id="threshold" v-model.number="settings.online_threshold_seconds" type="number" min="30" max="3600" /><small>建议设为心跳间隔的 3–4 倍</small></div><div class="field"><label for="school">系统显示名称</label><input id="school" v-model="settings.school_name" maxlength="60" /><small>用于管理后台和导出文件的学校标识</small></div></div></article>
      <article class="settings-card paper-card"><header><div class="section-mark">墙</div><div><p>SIGNATURE WALL</p><h2>展示墙设置</h2><span>保存后，大屏将在下一次轮询时自动应用</span></div></header><div class="layout-options" role="radiogroup" aria-label="展示墙布局"><button type="button" :class="{ active: settings.wall_layout === 'brick' }" @click="settings.wall_layout = 'brick'"><strong>砖墙矩阵</strong><span>错位暖纸砖块，适合集中浏览</span></button><button type="button" :class="{ active: settings.wall_layout === 'float' }" @click="settings.wall_layout = 'float'"><strong>签名漂浮墙</strong><span>克制缓慢漂移，适合沉浸展示</span></button></div><div class="settings-fields wall-fields"><div class="field"><label for="wall-title">墙面标题</label><input id="wall-title" v-model="settings.wall_title" maxlength="80" /></div><div class="field"><label for="refresh">数据刷新间隔（秒）</label><input id="refresh" v-model.number="settings.wall_refresh_seconds" type="number" min="3" max="60" /></div><div class="field"><label for="rotation">分页轮换间隔（秒）</label><input id="rotation" v-model.number="settings.wall_rotation_seconds" type="number" min="10" max="120" /></div></div></article>
      <article class="settings-card paper-card"><header><div class="section-mark">笺</div><div><p>ALUMNI POSTCARD</p><h2>明信片终端策略</h2><span>终端启动与恢复联网时读取；离线期间继续使用最近一次成功配置</span></div></header><div class="settings-fields postcard-fields"><div class="field"><label for="postcard-timeout">无操作返回首页（秒）</label><input id="postcard-timeout" v-model.number="settings.postcard_session_timeout_seconds" type="number" min="60" max="900" /></div><div class="field"><label for="postcard-photo">原始照片保留（小时）</label><input id="postcard-photo" v-model.number="settings.postcard_original_retention_hours" type="number" min="1" max="72" /></div><div class="field"><label for="postcard-result">成品保留（天）</label><input id="postcard-result" v-model.number="settings.postcard_result_retention_days" type="number" min="1" max="30" /></div><div class="field"><label for="postcard-copies">单次最多打印（份）</label><input id="postcard-copies" v-model.number="settings.postcard_max_print_copies" type="number" min="1" max="10" /></div><div class="field"><label for="postcard-interval">最短打印间隔（秒）</label><input id="postcard-interval" v-model.number="settings.postcard_min_print_interval_seconds" type="number" min="5" max="120" /></div></div></article>
      <article class="security-card paper-card"><AppIcon name="warning" /><div><p>SECURITY NOTE</p><h3>安全与隐私提醒</h3><span>生产环境请通过环境变量设置独立管理员初始密码和终端密钥，并在 HTTPS 反向代理后运行。导出、删除和设置变更均会写入审计日志。</span></div></article>
      <article class="maintenance-card paper-card"><div><p>DATA MAINTENANCE</p><h3>回收记录清理</h3><span>永久清理已进入回收记录且超过 {{ settings.retention_days }} 天的数据及关联文件。未到期的数据不会受影响。</span></div><button type="button" class="danger-button" @click="showPurge = true"><AppIcon name="trash" />清理到期记录</button></article>
      <p v-if="error" class="form-error"><AppIcon name="warning" />{{ error }}</p>
      <div class="form-actions"><button type="button" class="secondary-button" :disabled="saving" @click="load">放弃修改</button><button class="primary-button" :disabled="saving"><span v-if="saving" class="spinner" /><AppIcon v-else name="check" />{{ saving ? '正在保存…' : '保存系统设置' }}</button></div>
    </form>
    <div v-if="showPurge" class="dialog-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="purge-title"><section class="purge-dialog"><div class="purge-mark"><AppIcon name="warning" /></div><p>PERMANENT CLEANUP</p><h2 id="purge-title">确认清理到期记录？</h2><span>超过 {{ settings.retention_days }} 天的回收记录及文件将被永久删除，此操作不可撤销，并会写入审计日志。</span><div><button class="secondary-button" :disabled="purging" @click="showPurge = false">取消</button><button class="danger-button" :disabled="purging" @click="purgeExpired"><span v-if="purging" class="spinner" />确认永久清理</button></div></section></div>
    <div v-if="toast" class="toast"><AppIcon name="check" />系统设置已保存并生效</div>
  </section>
</template>

<style scoped>
.settings-layout { display: grid; max-width: 980px; gap: 16px; }.settings-card { padding: 25px 27px 28px; }.settings-card header { display: flex; align-items: center; gap: 15px; }.section-mark { display: grid; width: 50px; height: 50px; flex: 0 0 50px; place-items: center; border: 1px solid var(--ca-red); border-radius: 50%; color: var(--ca-red); font: 500 17px var(--ca-font-display); }.settings-card header p, .security-card p, .maintenance-card p { margin: 0 0 4px; color: var(--ca-red); font-size: 7px; font-weight: 600; letter-spacing: .23em; }.settings-card header h2 { margin: 0 0 4px; font: 500 20px var(--ca-font-display); letter-spacing: .09em; }.settings-card header span, .security-card span, .maintenance-card span { color: var(--ca-muted); font-size: 11px; line-height: 1.7; }.settings-fields { display: grid; margin-top: 25px; grid-template-columns: 1fr 1fr; gap: 18px; }.settings-fields input { min-height: 50px; }.field small { color: var(--ca-quiet); font-size: 9px; }.security-card { display: flex; padding: 20px 24px; align-items: flex-start; gap: 15px; border-color: rgba(159,41,37,.13); background: rgba(159,41,37,.025); }.security-card > svg { margin-top: 2px; color: var(--ca-red); font-size: 23px; }.security-card h3, .maintenance-card h3 { margin: 0 0 5px; font: 500 16px var(--ca-font-display); letter-spacing: .07em; }.maintenance-card { display: flex; padding: 20px 24px; align-items: center; justify-content: space-between; gap: 25px; }.maintenance-card button { flex: none; }.form-actions { display: flex; justify-content: flex-end; gap: 10px; }.form-actions button { min-width: 150px; min-height: 50px; }.form-error { display: flex; margin: 0; align-items: center; gap: 8px; color: var(--ca-red); font-size: 12px; }.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 30px; background: rgba(24,24,20,.64); backdrop-filter: blur(8px); }.purge-dialog { width: min(500px, 90vw); padding: 36px 40px 38px; border-radius: 22px; background: var(--ca-surface); box-shadow: var(--ca-shadow-dialog); text-align: center; }.purge-mark { display: grid; width: 58px; height: 58px; margin: 0 auto 14px; place-items: center; border-radius: 50%; background: rgba(159,41,37,.08); color: var(--ca-red); font-size: 25px; }.purge-dialog > p { margin: 0 0 7px; color: var(--ca-red); font-size: 8px; font-weight: 600; letter-spacing: .24em; }.purge-dialog h2 { margin: 0 0 10px; font: 500 26px var(--ca-font-display); letter-spacing: .08em; }.purge-dialog > span { color: var(--ca-muted); font-size: 12px; line-height: 1.7; }.purge-dialog > div:last-child { display: grid; margin-top: 24px; grid-template-columns: 1fr 1.2fr; gap: 10px; }.purge-dialog button { min-height: 50px; }
.layout-options { display: grid; margin-top: 24px; grid-template-columns: 1fr 1fr; gap: 12px; }.layout-options button { display: grid; min-height: 82px; padding: 16px 18px; gap: 5px; border: 1px solid var(--ca-border); border-radius: 10px; background: var(--ca-canvas); color: var(--ca-muted); text-align: left; }.layout-options button strong { color: var(--ca-ink); font: 500 16px var(--ca-font-display); letter-spacing: .06em; }.layout-options button span { font-size: 10px; }.layout-options button.active { border-color: rgba(159,41,37,.42); background: rgba(159,41,37,.035); box-shadow: inset 3px 0 var(--ca-red); }.wall-fields { grid-template-columns: 1.6fr .7fr .7fr; }
.postcard-fields { grid-template-columns: repeat(3, 1fr); }
</style>
