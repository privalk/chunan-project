<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import type { SignatureArtifacts } from '../types/signature'

const props = defineProps<{
  artifacts: SignatureArtifacts
  saving: boolean
}>()

defineEmits<{
  back: []
  confirm: []
}>()

const signatureNumber = computed(() => props.artifacts.record.id)
const participantName = computed(() => props.artifacts.record.context.display_name || '匿名参与')
</script>

<template>
  <div class="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="preview-title">
    <section class="dialog-card">
      <button class="dialog-close" aria-label="返回修改" :disabled="saving" @click="$emit('back')">
        <AppIcon name="close" />
      </button>
      <div class="step-mark"><AppIcon name="check" /></div>
      <p class="eyebrow">FINAL CHECK</p>
      <h2 id="preview-title">请确认您的签名</h2>
      <p class="dialog-lead">提交后经审核用于互动墙展示与纪念卡打印</p>

      <div class="preview-paper">
        <img :src="artifacts.displayPng" alt="签名预览" />
        <span>淳安第三中学 · 添砖加瓦</span>
      </div>

      <div class="signature-meta">
        <span class="participant-name">{{ participantName }}</span>
        <span>签名编号</span>
        <strong>{{ signatureNumber }}</strong>
        <span>{{ artifacts.record.metrics.stroke_count }} 笔 · {{ artifacts.record.metrics.point_count }} 个采样点</span>
      </div>

      <div class="dialog-actions">
        <button class="secondary-button" :disabled="saving" @click="$emit('back')">返回修改</button>
        <button class="primary-button" :disabled="saving" @click="$emit('confirm')">
          <span v-if="saving" class="spinner" />
          <AppIcon v-else name="check" />
          {{ saving ? '正在保存…' : '确认并提交' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 30px; background: rgba(24, 24, 20, .64); backdrop-filter: blur(8px); animation: fade .2s ease; }
.dialog-card { position: relative; width: min(760px, 90vw); padding: 38px 50px 42px; border-radius: 24px; background: #fbfaf6; box-shadow: 0 30px 90px rgba(0, 0, 0, .24); text-align: center; animation: rise .25s ease; }
.dialog-close { position: absolute; top: 18px; right: 18px; display: grid; width: 48px; height: 48px; place-items: center; border: 0; border-radius: 50%; background: #eeeae1; color: #5d584e; font-size: 20px; }
.step-mark { display: grid; width: 58px; height: 58px; margin: 0 auto 12px; place-items: center; border-radius: 50%; background: #e9efe9; color: #35614d; font-size: 26px; }
.eyebrow { margin: 0; color: var(--red); font: 600 11px/1 var(--font-sans); letter-spacing: .24em; }
h2 { margin: 10px 0 8px; color: #292a26; font: 500 clamp(28px, 3vw, 40px)/1.2 var(--font-serif); letter-spacing: .1em; }
.dialog-lead { margin: 0 0 24px; color: #7b756b; }
.preview-paper { position: relative; display: grid; height: 220px; place-items: center; padding: 28px 40px 42px; overflow: hidden; border: 1px solid #dfd8ca; border-radius: 12px; background-color: #fff; background-image: linear-gradient(rgba(136, 114, 83, .04) 1px, transparent 1px), linear-gradient(90deg, rgba(136, 114, 83, .04) 1px, transparent 1px); background-size: 22px 22px; }
.preview-paper::before { content: '淳'; position: absolute; top: 18px; left: 24px; color: rgba(159, 41, 37, .08); font: 700 90px/1 var(--font-serif); }
.preview-paper img { position: relative; z-index: 1; max-width: 88%; max-height: 135px; object-fit: contain; }
.preview-paper span { position: absolute; right: 22px; bottom: 14px; color: #9d9588; font: 12px var(--font-serif); letter-spacing: .08em; }
.signature-meta { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 18px 0 24px; color: #8d867a; font-size: 13px; }
.signature-meta strong { color: #4b4841; font: 600 14px var(--font-sans); letter-spacing: .05em; }
.signature-meta .participant-name { padding: 6px 10px; border-radius: 14px; background: rgba(159, 41, 37, .07); color: var(--red); }
.signature-meta .participant-name::before { content: none; }
.signature-meta span:last-child::before { content: '·'; margin-right: 12px; }
.dialog-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 14px; }
.dialog-actions button { min-height: 60px; }
.spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.35); border-top-color: white; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes fade { from { opacity: 0; } }
@keyframes rise { from { opacity: 0; transform: translateY(12px) scale(.98); } }
@keyframes spin { to { transform: rotate(1turn); } }
</style>
