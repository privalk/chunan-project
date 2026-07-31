<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import type { SignatureContext, SignatureIdentityType } from '../types/signature'

const props = defineProps<{ initial: SignatureContext }>()
const emit = defineEmits<{ home: []; continue: [context: SignatureContext] }>()

const SESSION_SECONDS = 90
const secondsLeft = ref(SESSION_SECONDS)
const errorMessage = ref('')
const form = reactive({
  identity_type: props.initial.identity_type,
  display_name: props.initial.display_name || '',
  user_no: props.initial.user_no || '',
  class_name: props.initial.class_name || '',
})
let timer: number | undefined

const identities: Array<{ value: SignatureIdentityType; mark: string; label: string; hint: string }> = [
  { value: 'anonymous', mark: '匿', label: '匿名参与', hint: '不登记个人信息' },
  { value: 'student', mark: '学', label: '在校学生', hint: '姓名必填' },
  { value: 'teacher', mark: '师', label: '教师职工', hint: '姓名必填' },
  { value: 'alumni', mark: '友', label: '校友', hint: '姓名必填' },
  { value: 'visitor', mark: '访', label: '来访嘉宾', hint: '姓名必填' },
]

const isAnonymous = computed(() => form.identity_type === 'anonymous')
const showSchoolFields = computed(() => ['student', 'teacher', 'alumni'].includes(form.identity_type))
const numberLabel = computed(() => form.identity_type === 'teacher' ? '工号（选填）' : '学号（选填）')
const classLabel = computed(() => form.identity_type === 'teacher' ? '部门 / 教研组（选填）' : form.identity_type === 'alumni' ? '届次 / 原班级（选填）' : '班级（选填）')
const timeText = computed(() => `${String(Math.floor(secondsLeft.value / 60)).padStart(2, '0')}:${String(secondsLeft.value % 60).padStart(2, '0')}`)

watch(() => form.identity_type, (value) => {
  errorMessage.value = ''
  if (value === 'anonymous') {
    form.display_name = ''
    form.user_no = ''
    form.class_name = ''
  }
})

function submit() {
  const displayName = form.display_name.trim()
  if (!isAnonymous.value && !displayName) {
    errorMessage.value = '请选择姓名输入框，填写姓名后再继续'
    return
  }
  emit('continue', {
    identity_type: form.identity_type,
    template_id: 'exhibition-wall',
    ...(displayName ? { display_name: displayName.slice(0, 40) } : {}),
    ...(form.user_no.trim() ? { user_no: form.user_no.trim().slice(0, 40) } : {}),
    ...(form.class_name.trim() ? { class_name: form.class_name.trim().slice(0, 60) } : {}),
  })
}

onMounted(() => {
  timer = window.setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) emit('home')
  }, 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <main class="identity-view">
    <header>
      <button class="back-button" @click="$emit('home')"><span>‹</span> 返回首页</button>
      <div class="header-brand"><span class="mini-seal">三中</span><div><strong>淳安第三中学</strong><small>添砖加瓦 · 信息确认</small></div></div>
      <div class="timer" :class="{ warning: secondsLeft <= 15 }"><AppIcon name="clock" /><div><small>剩余操作时间</small><strong>{{ timeText }}</strong></div></div>
    </header>

    <section class="identity-content">
      <div class="title-row">
        <div><p class="eyebrow"><span>01</span> PARTICIPANT INFO</p><h1>请选择您的身份</h1><p>身份信息用于后台检索；您也可以选择匿名参与</p></div>
        <div class="step-indicator" aria-label="当前步骤 1，共 3 步"><span class="active">1</span><i /><span>2</span><i /><span>3</span><small>选择信息</small><small>书写签名</small><small>预览确认</small></div>
      </div>

      <div class="identity-grid" role="radiogroup" aria-label="参与者身份">
        <button v-for="item in identities" :key="item.value" type="button" role="radio" :aria-checked="form.identity_type === item.value" :class="{ selected: form.identity_type === item.value }" @click="form.identity_type = item.value">
          <span>{{ item.mark }}</span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small><i><AppIcon v-if="form.identity_type === item.value" name="check" /></i>
        </button>
      </div>

      <form class="information-card" @submit.prevent="submit">
        <div v-if="isAnonymous" class="anonymous-note"><span>匿</span><div><strong>匿名参与已开启</strong><p>本次签名不会登记姓名、编号或班级，仍可正常保存和展示。</p></div></div>
        <template v-else>
          <label class="field"><span>姓名 <b>必填</b></span><input v-model="form.display_name" maxlength="40" autocomplete="off" placeholder="请输入真实姓名" /></label>
          <label v-if="showSchoolFields" class="field"><span>{{ numberLabel }}</span><input v-model="form.user_no" maxlength="40" autocomplete="off" placeholder="便于同名人员准确检索" /></label>
          <label v-if="showSchoolFields" class="field"><span>{{ classLabel }}</span><input v-model="form.class_name" maxlength="60" autocomplete="off" placeholder="例如：高一（3）班" /></label>
          <div class="privacy-note"><i />仅采集签名业务所需信息，不采集身份证号、手机号或人脸信息。</div>
        </template>
        <p v-if="errorMessage" class="form-error"><span>!</span>{{ errorMessage }}</p>
        <button class="continue-button" type="submit">下一步，书写签名 <AppIcon name="arrow" /></button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.identity-view { min-height: 100%; background: var(--paper); }
header { display: grid; height: 86px; padding: 0 clamp(28px, 4.5vw, 82px); grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 1px solid #e4ded2; background: rgba(250,248,243,.95); }
.back-button { justify-self: start; display: flex; min-height: 48px; align-items: center; gap: 9px; border: 0; background: transparent; color: #615c53; font-size: 14px; }.back-button span { font-size: 30px; font-weight: 200; line-height: 0; }
.header-brand { display: flex; align-items: center; gap: 12px; }.mini-seal { display: grid; width: 43px; height: 43px; place-items: center; border: 1px solid var(--red); border-radius: 50%; color: var(--red); font: 600 13px var(--font-serif); }.header-brand div { display: flex; flex-direction: column; }.header-brand strong { color: #393934; font: 600 17px var(--font-serif); letter-spacing: .12em; }.header-brand small { margin-top: 3px; color: #9b9387; font-size: 9px; letter-spacing: .16em; }
.timer { justify-self: end; display: flex; align-items: center; gap: 10px; color: #8a8175; }.timer > svg { font-size: 22px; }.timer div { display: flex; align-items: baseline; gap: 10px; }.timer small { font-size: 11px; }.timer strong { color: #3c3b36; font: 500 24px var(--font-sans); font-variant-numeric: tabular-nums; }.timer.warning,.timer.warning strong { color: var(--red); }
.identity-content { width: min(1420px, calc(100% - 9vw)); margin: 0 auto; padding: clamp(28px,4vh,48px) 0 30px; }.title-row { display: flex; align-items: flex-start; justify-content: space-between; }.eyebrow { margin: 0 0 10px; color: #a0988b; font: 600 10px var(--font-sans); letter-spacing: .2em; }.eyebrow span { display: inline-grid; width: 26px; height: 26px; margin-right: 8px; place-items: center; border-radius: 50%; background: var(--red); color: white; letter-spacing: 0; }.title-row h1 { margin: 0; color: #30312d; font: 500 clamp(30px,3vw,43px)/1.2 var(--font-serif); letter-spacing: .1em; }.title-row p:last-child { margin: 8px 0 0; color: #888075; font-size: 14px; }
.step-indicator { display: grid; width: 330px; margin-top: 12px; grid-template-columns: 32px 1fr 32px 1fr 32px; align-items: center; justify-items: center; color: #a59d91; }.step-indicator span { display: grid; width: 28px; height: 28px; place-items: center; border: 1px solid #ccc4b7; border-radius: 50%; background: var(--paper); font-size: 12px; }.step-indicator span.active { border-color: var(--red); background: var(--red); color: white; }.step-indicator i { width: 100%; height: 1px; background: #d9d2c6; }.step-indicator small { margin-top: 7px; font-size: 10px; white-space: nowrap; }.step-indicator small:nth-of-type(1){grid-column:1;color:var(--red)}.step-indicator small:nth-of-type(2){grid-column:3}.step-indicator small:nth-of-type(3){grid-column:5}
.identity-grid { display: grid; margin-top: clamp(28px,4vh,46px); grid-template-columns: repeat(5,1fr); gap: 13px; }.identity-grid button { position: relative; display: grid; min-height: 142px; padding: 18px 12px; place-items: center; align-content: center; gap: 7px; border: 1px solid #ddd6ca; border-radius: 13px; background: rgba(251,250,246,.9); color: #69635a; }.identity-grid button > span { display: grid; width: 48px; height: 48px; place-items: center; border: 1px solid #cfc6b8; border-radius: 50%; color: #81786c; font: 500 19px var(--font-serif); }.identity-grid button strong { font: 500 17px var(--font-serif); letter-spacing: .08em; }.identity-grid button small { color: #a49b8f; font-size: 10px; }.identity-grid button > i { position: absolute; top: 11px; right: 11px; display: grid; width: 21px; height: 21px; place-items: center; border: 1px solid #d7cec1; border-radius: 50%; color: white; font-size: 12px; }.identity-grid button.selected { border-color: rgba(159,41,37,.5); background: rgba(159,41,37,.035); box-shadow: 0 8px 24px rgba(112,27,24,.06); color: var(--red); }.identity-grid button.selected > span { border-color: var(--red); background: var(--red); color: white; }.identity-grid button.selected > i { border-color: #6a8873; background: #6a8873; }
.information-card { display: grid; min-height: 184px; margin-top: 18px; padding: 24px; grid-template-columns: repeat(3,1fr) auto; align-items: end; gap: 16px; border: 1px solid #ddd6ca; border-radius: 14px; background: rgba(255,254,251,.85); box-shadow: 0 8px 25px rgba(66,52,33,.035); }.field { display: grid; gap: 8px; }.field span { color: #716a60; font-size: 12px; }.field b { margin-left: 5px; color: var(--red); font-size: 9px; }.field input { width: 100%; min-height: 58px; padding: 0 17px; border: 1px solid #d9d1c5; border-radius: 9px; background: white; color: #353630; font-size: 16px; outline: 0; }.field input:focus { border-color: rgba(159,41,37,.55); box-shadow: 0 0 0 4px rgba(159,41,37,.07); }.field input::placeholder { color: #bbb3a8; }.continue-button { display: flex; min-width: 235px; min-height: 60px; padding: 0 24px; align-items: center; justify-content: center; gap: 13px; border: 0; border-radius: 9px; background: var(--red); color: white; box-shadow: 0 9px 22px rgba(112,27,24,.19); font: 500 17px var(--font-serif); letter-spacing: .07em; }
.anonymous-note { grid-column: 1 / 4; display: flex; min-height: 106px; align-items: center; gap: 18px; }.anonymous-note > span { display: grid; width: 58px; height: 58px; flex: 0 0 58px; place-items: center; border-radius: 50%; background: rgba(106,136,115,.1); color: #557460; font: 500 21px var(--font-serif); }.anonymous-note strong { color: #3f4941; font: 500 18px var(--font-serif); letter-spacing: .08em; }.anonymous-note p { margin: 7px 0 0; color: #847d72; font-size: 12px; }.privacy-note { grid-column: 1 / 4; display: flex; align-items: center; gap: 8px; color: #8e867a; font-size: 10px; }.privacy-note i { width: 6px; height: 6px; border-radius: 50%; background: #6a8873; }.form-error { grid-column: 1 / -1; margin: -5px 0 0; color: var(--red); font-size: 12px; }.form-error span { display: inline-grid; width: 18px; height: 18px; margin-right: 7px; place-items: center; border: 1px solid currentColor; border-radius: 50%; }
@media(max-width:1180px){.identity-grid{grid-template-columns:repeat(5,minmax(150px,1fr));overflow-x:auto}.information-card{grid-template-columns:1fr 1fr}.continue-button{grid-column:2}.anonymous-note,.privacy-note{grid-column:1}.information-card:not(:has(.anonymous-note)) .continue-button{grid-column:2}}
@media(max-height:830px){.identity-content{padding-top:18px}.identity-grid{margin-top:20px}.identity-grid button{min-height:115px}.identity-grid button>span{width:40px;height:40px}.information-card{min-height:150px;padding:18px}.field input{min-height:50px}}
</style>
