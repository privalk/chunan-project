<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSignatureStore } from '../stores/signature'
import { renderStrokes } from '../utils/renderSignature'

withDefaults(defineProps<{ prompt?: string }>(), { prompt: '请在框内签写您的姓名' })

const store = useSignatureStore()
const canvas = ref<HTMLCanvasElement | null>(null)
const frame = ref<HTMLDivElement | null>(null)
let activePointerId: number | null = null
let resizeObserver: ResizeObserver | null = null

function redraw() {
  const element = canvas.value
  const container = frame.value
  if (!element || !container) return
  const bounds = container.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.round(bounds.width * dpr)
  const height = Math.round(bounds.height * dpr)
  if (element.width !== width || element.height !== height) {
    element.width = width
    element.height = height
  }
  const context = element.getContext('2d')
  if (!context) return
  renderStrokes(context, store.strokes, width, height)
}

function normalizedPoint(event: PointerEvent) {
  const bounds = canvas.value!.getBoundingClientRect()
  const pressure = event.pointerType === 'mouse' || event.pressure === 0 ? 0.5 : event.pressure
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    pressure: Number(pressure.toFixed(3)),
    time: Math.max(0, Date.now() - store.startedAt),
  }
}

function onPointerDown(event: PointerEvent) {
  if (activePointerId !== null) return
  event.preventDefault()
  activePointerId = event.pointerId
  canvas.value?.setPointerCapture(event.pointerId)
  store.beginStroke(normalizedPoint(event))
  redraw()
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return
  event.preventDefault()
  const coalesced = event.getCoalescedEvents?.() ?? [event]
  for (const pointEvent of coalesced) store.appendPoint(normalizedPoint(pointEvent))
  redraw()
}

function endStroke(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return
  event.preventDefault()
  if (event.type === 'pointerup') store.appendPoint(normalizedPoint(event))
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId)
  activePointerId = null
  redraw()
}

watch(() => [store.strokes.length, store.redoStack.length], () => nextTick(redraw))

onMounted(() => {
  resizeObserver = new ResizeObserver(redraw)
  if (frame.value) resizeObserver.observe(frame.value)
  redraw()
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div ref="frame" class="signature-frame" :class="{ empty: store.strokes.length === 0 }">
    <div class="corner top-left" />
    <div class="corner top-right" />
    <div class="corner bottom-left" />
    <div class="corner bottom-right" />
    <div v-if="store.strokes.length === 0" class="empty-hint" aria-hidden="true">
      <span class="guide-line" />
      <p>{{ prompt }}</p>
      <span>支持手指或触控笔</span>
    </div>
    <canvas
      ref="canvas"
      aria-label="手写签名区域"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endStroke"
      @pointercancel="endStroke"
      @contextmenu.prevent
    />
    <span class="baseline" />
  </div>
</template>

<style scoped>
.signature-frame { position: relative; min-height: 310px; height: clamp(310px, 41vh, 470px); overflow: hidden; border: 1px solid rgba(126, 101, 66, .24); border-radius: 18px; background-color: #fffefb; background-image: radial-gradient(circle, rgba(138, 109, 67, .14) 1px, transparent 1px); background-size: 24px 24px; box-shadow: inset 0 0 40px rgba(74, 52, 22, .025); }
canvas { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
.baseline { position: absolute; left: 7%; right: 7%; bottom: 26%; height: 1px; z-index: 1; background: linear-gradient(90deg, transparent, rgba(159, 41, 37, .2) 12%, rgba(159, 41, 37, .2) 88%, transparent); }
.empty-hint { position: absolute; inset: 0; z-index: 2; display: grid; place-content: center; justify-items: center; pointer-events: none; color: #857d70; text-align: center; transition: opacity .18s ease; }
.empty-hint p { margin: 14px 0 5px; color: #4e4a43; font-family: var(--font-serif); font-size: clamp(24px, 2.1vw, 34px); letter-spacing: .15em; }
.empty-hint span:last-child { font-size: 15px; letter-spacing: .08em; }
.guide-line { width: 46px; height: 46px; border: 2px solid rgba(159, 41, 37, .48); border-radius: 50%; }
.guide-line::after { content: ''; display: block; width: 18px; height: 2px; margin: 21px auto; background: rgba(159, 41, 37, .48); transform: rotate(-45deg); }
.corner { position: absolute; z-index: 4; width: 28px; height: 28px; border-color: var(--red); opacity: .78; pointer-events: none; }
.top-left { top: 16px; left: 16px; border-top: 2px solid; border-left: 2px solid; }
.top-right { top: 16px; right: 16px; border-top: 2px solid; border-right: 2px solid; }
.bottom-left { bottom: 16px; left: 16px; border-bottom: 2px solid; border-left: 2px solid; }
.bottom-right { right: 16px; bottom: 16px; border-right: 2px solid; border-bottom: 2px solid; }
</style>
