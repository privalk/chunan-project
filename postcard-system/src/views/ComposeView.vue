<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import PostcardCanvas from '../components/PostcardCanvas.vue'
import { postcardTemplates } from '../data/templates'
import { usePostcardStore } from '../stores/postcard'
import type { Transform } from '../types'

const store = usePostcardStore()
const tab = ref<'template' | 'content' | 'adjust'>('template')
const compareOpen = ref(false)
const templateGroups = computed(() => [...new Set(postcardTemplates.filter((item) => item.enabled).map((item) => item.group))])

function updateTransform(kind: 'photo' | 'signature', value: Transform) { store.setTransform(kind, value) }
function scale(kind: 'photo' | 'signature', delta: number) {
  const current = kind === 'photo' ? store.draft.photo : store.draft.signatureTransform
  updateTransform(kind, { ...current, scale: Math.max(.65, Math.min(2.2, current.scale + delta)) })
}
function chooseTemplate(id: string) { store.draft.templateId = id; store.touch() }
function loadFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader(); reader.onload = () => store.setPhoto(String(reader.result)); reader.readAsDataURL(file)
}
</script>

<template>
  <main class="flow-page compose-view">
    <header class="flow-header"><button class="icon-button" aria-label="返回素材选择" @click="store.go('source')"><AppIcon name="back" /></button><div><p>STEP 02 / 03</p><h1>设计你的三中明信片</h1><span>拖动照片和签名调整位置，使用下方工具缩放</span></div><div class="step-dots"><b /><b /><i /></div></header>
    <section class="studio">
      <aside class="tool-panel paper-card">
        <nav><button :class="{ active: tab === 'template' }" @click="tab='template'"><AppIcon name="template" />模板</button><button :class="{ active: tab === 'content' }" @click="tab='content'"><AppIcon name="signature" />内容</button><button :class="{ active: tab === 'adjust' }" @click="tab='adjust'"><AppIcon name="image" />调整</button></nav>
        <div v-if="tab === 'template'" class="panel-body template-panel">
          <header><div><p>TEMPLATE LIBRARY</p><h2>选择年代风格</h2></div><button class="compare-button" @click="compareOpen=true"><AppIcon name="compare" :size="17" />对比</button></header>
          <section v-for="group in templateGroups" :key="group"><h3>{{ group }}</h3><div class="template-list"><button v-for="item in postcardTemplates.filter(t=>t.enabled&&t.group===group)" :key="item.id" :class="{ selected: store.draft.templateId === item.id }" @click="chooseTemplate(item.id)"><span :style="{ background:item.background, color:item.accent }">{{ item.year.slice(0,4) }}</span><b>{{ item.name }}</b><i v-if="store.draft.templateId===item.id"><AppIcon name="check" :size="14" /></i></button></div></section>
        </div>
        <div v-else-if="tab === 'content'" class="panel-body content-panel">
          <header><p>POSTCARD WORDS</p><h2>写下一句话</h2></header>
          <label><span>明信片正文 <small>{{ store.draft.message.length }}/80</small></span><textarea v-model="store.draft.message" maxlength="80" rows="5" placeholder="写给未来、同窗或母校…" @input="store.touch" /></label>
          <div class="quick-lines"><button v-for="line in ['归来仍少年，初心依旧。','愿此去前程似锦，再见仍如故。','湖光作序，青春为章。']" :key="line" @click="store.draft.message=line">{{ line }}</button></div>
          <label><span>署名</span><input v-model="store.draft.sender" maxlength="20" placeholder="未填写时显示“一位三中人”" @input="store.touch" /></label>
          <label><span>毕业年份</span><input v-model="store.draft.graduationYear" inputmode="numeric" maxlength="4" placeholder="例如：2008" @input="store.touch" /></label>
        </div>
        <div v-else class="panel-body adjust-panel">
          <header><p>LAYOUT ADJUSTMENT</p><h2>调整素材</h2></header>
          <section><div><AppIcon name="image" /><span><b>照片</b><small>拖动定位 · 缩放取景</small></span></div><div class="scale-control"><button @click="scale('photo',-.1)"><AppIcon name="minus" /></button><output>{{ Math.round(store.draft.photo.scale*100) }}%</output><button @click="scale('photo',.1)"><AppIcon name="plus" /></button></div><label class="replace-photo"><AppIcon name="upload" :size="17" />更换照片<input type="file" accept="image/*" @change="loadFile" /></label></section>
          <section><div><AppIcon name="signature" /><span><b>签名</b><small>{{ store.draft.signature ? '拖动定位 · 缩放大小' : '尚未选择签名' }}</small></span></div><div class="scale-control"><button :disabled="!store.draft.signature" @click="scale('signature',-.1)"><AppIcon name="minus" /></button><output>{{ Math.round(store.draft.signatureTransform.scale*100) }}%</output><button :disabled="!store.draft.signature" @click="scale('signature',.1)"><AppIcon name="plus" /></button></div><button class="replace-photo" @click="store.go('source')"><AppIcon name="search" :size="17" />重新检索</button></section>
          <button class="reset-layout" @click="store.draft.photo={x:.24,y:.48,scale:1};store.draft.signatureTransform={x:.73,y:.72,scale:1}"><AppIcon name="refresh" :size="17" />恢复默认排版</button>
        </div>
      </aside>
      <section class="canvas-stage paper-field">
        <div class="canvas-caption"><span>高清预览 · 输出尺寸 1748 × 1240 px</span><small>拖动带虚线边框的素材可调整位置</small></div>
        <div class="canvas-wrap"><PostcardCanvas :draft="store.draft" interactive @transform="updateTransform" /></div>
        <div class="legend"><span><i class="green" />照片已自动适配</span><span><i :class="{ green: store.draft.signature }" />{{ store.draft.signature ? '签名已关联' : '未关联签名' }}</span><span>模板：{{ store.template.name }}</span></div>
      </section>
    </section>
    <footer class="flow-actions"><button class="secondary-button" @click="store.go('source')">上一步</button><button class="primary-button" :disabled="!store.canPreview" @click="store.go('preview')">预览成品 <AppIcon name="arrow" /></button></footer>
    <div v-if="compareOpen" class="compare-layer" @click.self="compareOpen=false"><section><header><div><p>TEMPLATE COMPARISON</p><h2>多模板并排比较</h2></div><button class="icon-button" @click="compareOpen=false"><AppIcon name="close" /></button></header><div class="compare-grid"><button v-for="id in store.compareTemplateIds" :key="id" :class="{ selected: store.draft.templateId===id }" @click="chooseTemplate(id);compareOpen=false"><PostcardCanvas :draft="{...store.draft,templateId:id}" compact /><span>{{ postcardTemplates.find(t=>t.id===id)?.name }} <i v-if="store.draft.templateId===id">当前</i></span></button></div><p>在模板库中可继续浏览全部 10 套风格</p></section></div>
  </main>
</template>

<style scoped>
.studio{display:grid;min-height:0;grid-template-columns:380px 1fr;gap:18px}.tool-panel{display:flex;min-height:0;overflow:hidden}.tool-panel>nav{display:grid;width:76px;flex:none;align-content:start;background:#eee9df;border-right:1px solid var(--border)}.tool-panel>nav button{display:grid;min-height:78px;padding:10px 4px;place-content:center;justify-items:center;gap:5px;border:0;border-bottom:1px solid #ddd6ca;background:transparent;color:var(--muted);font-size:10px}.tool-panel>nav button.active{position:relative;background:var(--surface);color:var(--red)}.tool-panel>nav button.active:before{position:absolute;left:0;inset-block:0;width:3px;background:var(--red);content:""}.panel-body{min-width:0;padding:22px;flex:1;overflow:auto}.panel-body>header{display:flex;margin-bottom:18px;align-items:center;justify-content:space-between}.panel-body header p{margin:0 0 5px;color:var(--red);font-size:7px;letter-spacing:.22em}.panel-body h2{margin:0;font:500 21px var(--font-serif)}.compare-button{display:flex;min-height:38px;padding:0 11px;align-items:center;gap:6px;border:1px solid var(--border);border-radius:7px;background:var(--canvas);color:var(--muted);font-size:10px}.template-panel>section>h3{margin:18px 0 9px;color:var(--quiet);font-size:9px;font-weight:500;letter-spacing:.12em}.template-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}.template-list button{position:relative;display:grid;min-height:82px;padding:8px;grid-template-rows:1fr auto;border:1px solid var(--border);border-radius:8px;background:var(--canvas);text-align:left}.template-list button.selected{border-color:var(--red);box-shadow:0 0 0 1px var(--red)}.template-list button>span{display:grid;place-items:center;border-radius:4px;font:15px Georgia}.template-list button>b{margin-top:6px;font-size:10px}.template-list button>i{position:absolute;top:5px;right:5px;display:grid;width:20px;height:20px;place-items:center;border-radius:50%;background:var(--red);color:white}.content-panel label{display:grid;margin-bottom:17px;gap:7px}.content-panel label>span{display:flex;justify-content:space-between;color:var(--muted);font-size:10px}.content-panel textarea,.content-panel input{width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--canvas);font:13px/1.7 var(--font-sans);outline:0;resize:none}.quick-lines{display:grid;margin:-7px 0 20px;gap:6px}.quick-lines button{padding:8px 10px;border:0;border-radius:6px;background:#eee9df;color:var(--muted);font:10px var(--font-serif);text-align:left}.adjust-panel>section{margin-bottom:16px;padding:15px;border:1px solid var(--border);border-radius:9px;background:var(--canvas)}.adjust-panel>section>div:first-child{display:flex;align-items:center;gap:10px}.adjust-panel>section>div:first-child>svg{color:var(--red)}.adjust-panel>section span{display:grid;gap:2px}.adjust-panel small{color:var(--quiet);font-size:8px}.scale-control{display:grid;margin:14px 0 9px;grid-template-columns:44px 1fr 44px;align-items:center;border:1px solid var(--border);border-radius:7px;overflow:hidden}.scale-control button{height:38px;border:0;background:#eee9df}.scale-control output{text-align:center;font-size:10px}.replace-photo,.reset-layout{display:flex;width:100%;min-height:38px;align-items:center;justify-content:center;gap:6px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--muted);font-size:10px}.replace-photo input{display:none}.reset-layout{margin-top:20px}.canvas-stage{position:relative;display:flex;min-width:0;min-height:0;padding:24px 30px;flex-direction:column;justify-content:center;overflow:hidden;border:1px solid var(--border);border-radius:12px}.canvas-caption,.legend{display:flex;align-items:center;justify-content:space-between;color:var(--quiet);font-size:9px}.canvas-caption{margin-bottom:12px}.canvas-wrap{width:min(100%,1050px,calc((100vh - 240px) * 1.4095));margin:auto}.legend{margin-top:12px;justify-content:flex-start;gap:20px}.legend span{display:flex;align-items:center;gap:6px}.legend i{width:7px;height:7px;border-radius:50%;background:#b6ada1}.legend i.green{background:var(--green)}.compare-layer{position:fixed;inset:0;z-index:70;display:grid;padding:5vh;place-items:center;background:rgba(22,22,19,.73);backdrop-filter:blur(8px)}.compare-layer>section{width:min(1300px,94vw);padding:28px;border-radius:20px;background:var(--surface)}.compare-layer header{display:flex;align-items:center;justify-content:space-between}.compare-layer header p{margin:0;color:var(--red);font-size:8px;letter-spacing:.24em}.compare-layer h2{margin:5px 0 22px;font:500 26px var(--font-serif)}.compare-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:17px}.compare-grid button{padding:8px;border:2px solid transparent;border-radius:8px;background:#eee8dd;text-align:left}.compare-grid button.selected{border-color:var(--red)}.compare-grid button>span{display:flex;padding:10px 4px 3px;justify-content:space-between}.compare-grid button i{padding:2px 6px;border-radius:8px;background:var(--red);color:white;font-size:8px}.compare-layer>section>p{margin:16px 0 0;color:var(--quiet);font-size:9px;text-align:center}
@media(max-width:1200px){.studio{grid-template-columns:330px 1fr}.tool-panel>nav{width:64px}.panel-body{padding:16px}.canvas-stage{padding:16px}.template-list button{min-height:68px}}
</style>
