import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { SignaturePoint, SignatureStroke } from '../types/signature'

const COLORS = ['#172033', '#9f2925', '#1d4f47'] as const

export const useSignatureStore = defineStore('signature', () => {
  const strokes = ref<SignatureStroke[]>([])
  const redoStack = ref<SignatureStroke[]>([])
  const color = ref<string>(COLORS[0])
  const width = ref(6)
  const startedAt = ref(Date.now())

  const canUndo = computed(() => strokes.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const pointCount = computed(() => strokes.value.reduce((total, stroke) => total + stroke.points.length, 0))
  const pathLength = computed(() => strokes.value.reduce((total, stroke) => {
    return total + stroke.points.slice(1).reduce((strokeTotal, point, index) => {
      const previous = stroke.points[index]
      return strokeTotal + Math.hypot(point.x - previous.x, point.y - previous.y)
    }, 0)
  }, 0))
  const isMeaningful = computed(() => strokes.value.length > 0 && pointCount.value >= 12 && pathLength.value >= 0.1)

  function beginStroke(point: SignaturePoint) {
    redoStack.value = []
    const strokeNumber = strokes.value.length + 1
    strokes.value.push({
      stroke_id: `stroke-${String(strokeNumber).padStart(3, '0')}`,
      color: color.value,
      width: width.value,
      points: [point],
    })
  }

  function appendPoint(point: SignaturePoint) {
    strokes.value.at(-1)?.points.push(point)
  }

  function undo() {
    const stroke = strokes.value.pop()
    if (stroke) redoStack.value.push(stroke)
  }

  function redo() {
    const stroke = redoStack.value.pop()
    if (stroke) strokes.value.push(stroke)
  }

  function clear() {
    strokes.value = []
    redoStack.value = []
  }

  function reset() {
    clear()
    color.value = COLORS[0]
    width.value = 6
    startedAt.value = Date.now()
  }

  return {
    strokes,
    redoStack,
    color,
    width,
    startedAt,
    canUndo,
    canRedo,
    pointCount,
    pathLength,
    isMeaningful,
    colors: COLORS,
    beginStroke,
    appendPoint,
    undo,
    redo,
    clear,
    reset,
  }
})
