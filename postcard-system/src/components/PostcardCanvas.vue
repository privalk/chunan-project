<script setup lang="ts">
import { computed, ref } from 'vue'
import { findTemplate } from '../data/templates'
import type { PostcardDraft } from '../types'

const props = defineProps<{ draft: PostcardDraft; interactive?: boolean; compact?: boolean }>()
const emit = defineEmits<{ transform: [kind: 'photo' | 'signature', value: { x: number; y: number; scale: number }] }>()
const template = computed(() => findTemplate(props.draft.templateId))
const dragging = ref<{ kind: 'photo' | 'signature'; pointerX: number; pointerY: number; startX: number; startY: number } | null>(null)

const motifClass = computed(() => `motif-${template.value.motif}`)
const photoStyle = computed(() => ({ transform: `translate(${(props.draft.photo.x - .24) * 24}%, ${(props.draft.photo.y - .48) * 20}%) scale(${props.draft.photo.scale})` }))
const signatureStyle = computed(() => ({ transform: `translate(${(props.draft.signatureTransform.x - .73) * 34}%, ${(props.draft.signatureTransform.y - .72) * 25}%) scale(${props.draft.signatureTransform.scale})` }))

function startDrag(event: PointerEvent, kind: 'photo' | 'signature') {
  if (!props.interactive) return
  const current = kind === 'photo' ? props.draft.photo : props.draft.signatureTransform
  dragging.value = { kind, pointerX: event.clientX, pointerY: event.clientY, startX: current.x, startY: current.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!dragging.value) return
  const rect = (event.currentTarget as HTMLElement).closest('.postcard-canvas')?.getBoundingClientRect()
  if (!rect) return
  emit('transform', dragging.value.kind, {
    x: Math.max(0, Math.min(1, dragging.value.startX + (event.clientX - dragging.value.pointerX) / rect.width)),
    y: Math.max(0, Math.min(1, dragging.value.startY + (event.clientY - dragging.value.pointerY) / rect.height)),
    scale: dragging.value.kind === 'photo' ? props.draft.photo.scale : props.draft.signatureTransform.scale,
  })
}
function endDrag() { dragging.value = null }
</script>

<template>
  <div class="postcard-canvas" :class="[motifClass, { compact }]" :style="{ '--pc-bg': template.background, '--pc-ink': template.ink, '--pc-accent': template.accent, '--pc-muted': template.muted }">
    <div class="double-frame" />
    <header>
      <div><small>CHUNAN NO.3 MIDDLE SCHOOL</small><h2>{{ template.title }}</h2><p>{{ template.subtitle }}</p></div>
      <b>{{ template.year }}</b>
    </header>
    <div class="photo-frame" :class="{ empty: !draft.photoDataUrl, movable: interactive }" :style="photoStyle" @pointerdown="startDrag($event, 'photo')" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag">
      <img v-if="draft.photoDataUrl" :src="draft.photoDataUrl" alt="选择的照片" draggable="false" />
      <span v-else>在这里留下一张今日影像</span>
    </div>
    <section class="letter">
      <small>A LETTER TO THE FUTURE</small>
      <p>{{ draft.message || '愿此刻被温柔珍藏。' }}</p>
      <i />
      <span>{{ draft.graduationYear ? `${draft.graduationYear}届` : '淳安三中校友' }}</span>
      <div v-if="draft.signature?.imageUrl" class="signature movable" :style="signatureStyle" @pointerdown="startDrag($event, 'signature')" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag"><img :src="draft.signature.imageUrl" alt="签名" draggable="false" /></div>
      <strong v-else>{{ draft.sender || '一位三中人' }}</strong>
      <time>{{ new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date()) }}</time>
    </section>
    <footer>NO. {{ draft.id }}</footer>
    <div class="decor decor-rings" /><div class="decor decor-grid" /><div class="decor decor-mountain" /><div class="decor decor-window" /><div class="decor decor-stamp">淳</div>
  </div>
</template>

<style scoped>
.postcard-canvas { position: relative; width: 100%; aspect-ratio: 148/105; overflow: hidden; background: var(--pc-bg); color: var(--pc-ink); box-shadow: 0 20px 60px rgba(64,50,31,.16); isolation: isolate; touch-action: none; }
.double-frame::before,.double-frame::after { position:absolute; z-index:4; content:""; pointer-events:none; }.double-frame::before { inset:2.2%; border:1.5px solid color-mix(in srgb,var(--pc-accent) 55%,transparent); }.double-frame::after { inset:3.15%; border:1px solid color-mix(in srgb,var(--pc-muted) 40%,transparent); }
header { position:absolute; z-index:3; top:7.5%; left:6.3%; right:6.3%; display:flex; align-items:flex-start; justify-content:space-between; } header small,.letter small { color:var(--pc-accent); font:600 clamp(7px,1.05vw,14px) var(--font-sans); letter-spacing:.25em; } header h2 { margin:.6em 0 .15em; font:600 clamp(24px,3.6vw,55px) var(--font-serif); letter-spacing:.08em; } header p { margin:0; color:var(--pc-muted); font:clamp(10px,1.45vw,20px) var(--font-serif); } header b { color:var(--pc-accent); font:500 clamp(12px,1.7vw,24px) Georgia,serif; }
.photo-frame { position:absolute; z-index:2; top:26.5%; left:6.2%; width:47%; height:55.7%; overflow:hidden; border:1px solid color-mix(in srgb,var(--pc-muted) 55%,transparent); border-radius:4px; transform-origin:center; }.photo-frame img { width:100%; height:100%; object-fit:cover; pointer-events:none; }.photo-frame.empty { display:grid; place-items:center; background:#ffffff62; color:color-mix(in srgb,var(--pc-muted) 72%,transparent); font-size:clamp(9px,1.25vw,17px); }.movable { cursor:grab; }.movable:active { cursor:grabbing; outline:2px solid color-mix(in srgb,var(--pc-accent) 65%,transparent); outline-offset:-2px; }
.letter { position:absolute; z-index:3; top:30%; right:7.1%; width:35%; height:59%; }.letter > p { min-height:37%; margin:8% 0 5%; font:clamp(14px,2vw,28px)/1.65 var(--font-serif); white-space:pre-wrap; }.letter > i { display:block; border-top:1px solid color-mix(in srgb,var(--pc-muted) 35%,transparent); }.letter > span,.letter > time { display:block; margin-top:5%; color:var(--pc-muted); font:clamp(8px,1.1vw,15px) var(--font-sans); }.letter > strong { display:block; margin-top:5%; font:clamp(18px,2.4vw,34px) "STKaiti","KaiTi",cursive; }.signature { width:67%; height:18%; margin-top:4%; transform-origin:left center; }.signature img { width:100%; height:100%; object-fit:contain; object-position:left center; pointer-events:none; }.letter > time { position:absolute; bottom:2%; left:0; }
footer { position:absolute; z-index:3; right:6.4%; bottom:4.7%; color:var(--pc-muted); font:clamp(7px,.9vw,12px) var(--font-sans); letter-spacing:.08em; }
.decor { position:absolute; z-index:0; display:none; pointer-events:none; }.motif-rings .decor-rings { top:-24%; right:-10%; display:block; width:47%; aspect-ratio:1; border:1px solid color-mix(in srgb,var(--pc-muted) 22%,transparent); border-radius:50%; box-shadow:0 0 0 45px color-mix(in srgb,var(--pc-muted) 5%,transparent),0 0 0 90px color-mix(in srgb,var(--pc-muted) 5%,transparent),0 0 0 135px color-mix(in srgb,var(--pc-muted) 5%,transparent); }
.motif-grid .decor-grid { inset:0; display:block; opacity:.16; background-image:linear-gradient(var(--pc-muted) 1px,transparent 1px),linear-gradient(90deg,var(--pc-muted) 1px,transparent 1px); background-size:6% 8%; }
.motif-mountain .decor-mountain { display:block; right:-3%; bottom:-13%; width:72%; height:42%; border-radius:50% 30% 0 0; background:color-mix(in srgb,var(--pc-muted) 12%,transparent); transform:rotate(-7deg); }
.motif-window .decor-window { display:block; top:9%; right:6%; width:31%; height:26%; opacity:.18; background:repeating-linear-gradient(90deg,transparent 0 21%,var(--pc-muted) 21% 22%); border:1px solid var(--pc-muted); }
.motif-stamp .decor-stamp { top:8%; right:7%; display:grid; width:14%; aspect-ratio:1; place-items:center; border:6px double var(--pc-accent); border-radius:50%; color:var(--pc-accent); font:700 clamp(38px,6vw,90px) var(--font-serif); opacity:.12; transform:rotate(-12deg); }
.compact { box-shadow:none; }.compact header h2 { font-size:clamp(14px,2.4vw,28px); }.compact .letter > p { font-size:clamp(9px,1.25vw,15px); }
</style>
