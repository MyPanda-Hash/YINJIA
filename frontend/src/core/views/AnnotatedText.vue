<template>
  <!-- 纸面只读值格:按标注切段着色。**每段都带 data-start**,便于把 DOM 选区换算回字段下标
       (切段后一个字段会变成多个文本节点,选区偏移是"节点内"的,必须加回该段的起点)。
       打印同一套 DOM ⇒ 颜色/加粗直接印出来(见 .ann-seg 的行内样式,不依赖 CSS 类以免被打印样式表覆盖)。 -->
  <span
    class="ann-host"
    :class="{ 'ann-pen': pen, 'ann-eraser': eraser, 'ann-armed': !!armed }"
    :title="armed ? tt('再点一下即弹出颜色盘') : ''"
    @mouseup="onMouseUp($event)"
    @click="onClick"
  >
    <span
      v-for="(s, i) in segs"
      :key="i"
      class="ann-seg"
      :data-start="offsets[i]"
      :data-ann="s.color ? 1 : 0"
      :style="s.color ? { color: s.color, fontWeight: s.bold ? 700 : 400 } : null"
    >{{ s.text }}</span>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue'
import { tt } from '@/i18n'
import { segments, rangeInTextNode } from '@core/panel/docAnnotation.js'
import { useAnnotations, annsOf } from '@core/panel/annotationBus.js'

const props = defineProps({
  text: { type: [String, Number], default: '' },
  fieldKey: { type: String, default: '' },
})

const ctx = useAnnotations()
const mode = computed(() => (ctx && ctx.mode ? ctx.mode.value : null))
// 2026-10-27(#11):「能不能直接划选标注」由上层给(penReady = 纸面只读 或 已开标注笔),
// 而不是只看 mode==='pen' —— 只读纸上划字就该能标注,不必先点「标注笔」。
// 若上层没提供 penReady(旧调用方/独立嵌入),退回原判据,行为与改前逐字一致。
const canPen = computed(() => {
  const ready = ctx && ctx.penReady ? ctx.penReady.value : null
  if (ready === true) return true
  if (ready === false) return false
  return mode.value === 'pen'
})
const pen = computed(() => canPen.value && canEdit())
const eraser = computed(() => mode.value === 'eraser' && canEdit())

const segs = computed(() => segments(String(props.text ?? ''), annsOf(ctx, props.fieldKey)))
/** 每段在原文里的起点(与 segs 一一对应) */
const offsets = computed(() => {
  const out = []
  let acc = 0
  for (const s of segs.value) { out.push(acc); acc += s.text.length }
  return out
})

function canEdit() {
  return !!(ctx && ctx.active && ctx.active.value && props.fieldKey)
}

/**
 * 两段式标注(2026-10-28 用户口径「可以直接鼠标划选然后点击一下就弹出颜色盘选择颜色」)
 *
 * ① 划选(mouseup)→ 只**记住**范围(armed),不弹盘、**不清选区** —— 用户要先看清自己选了哪几个字;
 * ② 在被选中的文字上**再点一下**(click)→ 才弹色盘。
 *
 * 【为什么必须两段】改前 mouseup 一抬手就弹:想选中某句话看清内容也会弹,误触很多。
 *
 * 【怎么区分"拖拽补发的 click"与"用户的第二次点击"】
 * 浏览器在 mousedown/mouseup 落回同一元素时会**补发**一次 click。
 *   · 第一版用时间差(<250ms 算补发)—— **不可靠**:实测用户在划选后稍停一下再点,
 *     间隔超过 250ms 就被判成"补发"而弹不出盘(反之手快时又可能真点击被判成补发)。
 *   · 现在改用 **window.getSelection() 是否仍停留在这次划选上**:
 *       补发的 click 紧跟在 mouseup 之后、**选区还在**;
 *       用户第二次点击时,浏览器会**先清掉选区**(点击即取消选择)⇒ collapsed=true。
 *     即:选区还在 = 同一次拖拽(不弹);选区没了 = 用户的第二次点击(弹)。
 *     这跟人的直觉一致,也不受手快手慢影响。
 *   · 兜底:若浏览器行为差异导致选区没被清,仍用 3 秒上限防"很久以后的点击误弹"。
 */
const armMaxAgeMs = 3000
/** 已划选、等待"再点一下"确认的范围;null=没在等 */
const armed = ref(null)
/** 上次 mouseup 的时刻(兜底上限用) */
let lastUpAt = 0

/** 标注笔:划选一段文字 → **只记住范围**(等用户再点一下才弹色盘) */
function onMouseUp(ev) {
  if (!pen.value) return
  const r = rangeInTextNode(window.getSelection())
  lastUpAt = Date.now()
  if (!r) { armed.value = null; return }
  const base = Number(r.node.parentElement?.dataset?.start || 0)
  armed.value = {
    fieldKey: props.fieldKey,
    start: base + r.start,
    end: base + r.end,
    text: r.node.textContent.slice(r.start, r.end),
    x: ev?.clientX ?? 0,
    y: ev?.clientY ?? 0,
  }
}

/** 标注笔的"再点一下":确认划选范围 → 弹色盘(拖拽补发的 click 不算) */
function fireIfArmed(ev) {
  const a = armed.value
  if (!a || a.fieldKey !== props.fieldKey) return false
  // 兜底上限:armed 放太久就不认(免得用户早先选过、很久后随手一点又弹盘)
  if (Date.now() - lastUpAt > armMaxAgeMs) { armed.value = null; return false }
  // 判据:选区还在 ⇒ 这是紧跟 mouseup 的**补发 click**(同一次拖拽),不弹;
  //       选区已被清 ⇒ 用户**第二次点击**(点击本身会取消选择),才弹。
  const sel = window.getSelection?.()
  const stillSelecting = !!sel && sel.rangeCount > 0 && !sel.isCollapsed
  if (stillSelecting) return false
  armed.value = null
  window.getSelection?.()?.removeAllRanges?.()   // 弹盘才清选区
  ctx.ask?.(a.fieldKey, a.start, a.end, { x: ev?.clientX || a.x, y: ev?.clientY || a.y })
  return true
}

/** 橡皮擦:点在某个已标注的段上 → 擦掉它(后端只擦相交区间);否则处理标注笔的"再点一下" */
function onClick(ev) {
  if (eraser.value) {
    const host = ev.target?.closest?.('.ann-seg[data-ann="1"]')
    if (!host) return
    const start = Number(host.dataset.start || 0)
    ctx.erase?.(props.fieldKey, start, start + (host.textContent || '').length)
    return
  }
  fireIfArmed(ev)
}
</script>

<style scoped>
.ann-host { display: inline; }
/* 只在标注模式下提示"可交互",不动纸面观感(颜色仍来自行内样式,打印才带得走) */
.ann-pen { cursor: text; }
.ann-pen::selection { background: #ffe9a8; }
.ann-eraser .ann-seg[data-ann='1'] { cursor: pointer; }
.ann-eraser .ann-seg[data-ann='1']:hover { background: #ffe0e0; }
/* 2026-10-28 两段式:已划选、等"再点一下"时给个轻提示(不改文字颜色,免得与标注色混淆)
   —— 用户看不清"我现在到底选没选中、要不要再点",会反复拖选。 */
.ann-armed { cursor: pointer; }
</style>
