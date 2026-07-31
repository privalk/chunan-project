import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { findTemplate, postcardTemplates } from '../data/templates'
import type { AppStep, PostcardDraft, SignatureChoice, Transform } from '../types'

function uuid(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

function freshDraft(): PostcardDraft {
  return {
    id: uuid('PC'),
    traceId: uuid('TRACE'),
    createdAt: new Date().toISOString(),
    templateId: postcardTemplates[7].id,
    message: '愿我们走过万水千山，归来仍记得三中的晨光。',
    sender: '',
    graduationYear: '',
    photoDataUrl: '',
    signature: null,
    photo: { x: 0.24, y: 0.48, scale: 1 },
    signatureTransform: { x: 0.73, y: 0.72, scale: 1 },
  }
}

export const usePostcardStore = defineStore('postcard', () => {
  const step = ref<AppStep>('welcome')
  const draft = ref<PostcardDraft>(freshDraft())
  const compareTemplateIds = ref<string[]>([postcardTemplates[7].id, postcardTemplates[3].id, postcardTemplates[9].id])
  const lastActivity = ref(Date.now())
  const result = ref<{ pickupUrl: string; qrDataUrl: string; pngDataUrl: string; printed: boolean } | null>(null)
  const template = computed(() => findTemplate(draft.value.templateId))
  const canPreview = computed(() => Boolean(draft.value.message.trim() || draft.value.photoDataUrl || draft.value.signature))

  function touch() { lastActivity.value = Date.now() }
  function go(next: AppStep) { step.value = next; touch() }
  function chooseSignature(signature: SignatureChoice | null) {
    draft.value.signature = signature
    if (signature && !draft.value.sender.trim() && signature.identityType !== 'anonymous' && signature.displayName !== '匿名参与') {
      draft.value.sender = signature.displayName
    }
    touch()
  }
  function setPhoto(dataUrl: string) { draft.value.photoDataUrl = dataUrl; touch() }
  function setTransform(kind: 'photo' | 'signature', value: Transform) {
    if (kind === 'photo') draft.value.photo = value
    else draft.value.signatureTransform = value
    touch()
  }
  function reset() {
    draft.value = freshDraft()
    compareTemplateIds.value = [postcardTemplates[7].id, postcardTemplates[3].id, postcardTemplates[9].id]
    result.value = null
    step.value = 'welcome'
    touch()
  }

  return { step, draft, template, result, lastActivity, compareTemplateIds, canPreview, go, touch, chooseSignature, setPhoto, setTransform, reset }
})
