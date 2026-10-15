<template>
  <!-- 纸面只读值格:按标注切段着色。**每段都带 data-start**,便于把 DOM 选区换算回字段下标
       (切段后一个字段会变成多个文本节点,选区偏移是"节点内"的,必须加回该段的起点)。
       打印同一套 DOM ⇒ 颜色/加粗直接印出来(见 .ann-seg 的行内样式,不依赖 CSS 类以免被打印样式表覆盖)。 -->
  <span
    class="ann-host"
    :class="{ 'ann-pen': pen, 'ann-eraser': eraser }"
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
import { computed } from 'vue'
import { segments, rangeInTextNode } from '@core/panel/docAnnotation.js'
import { useAnnotations, annsOf } from '@core/panel/annotationBus.js'

const props = defineProps({
  text: { type: [String, Number], default: '' },
  fieldKey: { type: String, default: '' },
})

const ctx = useAnnotations()
const mode = computed(() => (ctx && ctx.mode ? ctx.mode.value : null))
const pen = computed(() => mode.value === 'pen' && canEdit())
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

/** 标注笔:选择一段文字 → 把 [start,end) 交给上层弹色盘 */
function onMouseUp(ev) {
  if (!pen.value) return
  const r = rangeInTextNode(window.getSelection())
  if (!r) return
  const base = Number(r.node.parentElement?.dataset?.start || 0)
  ctx.ask?.(props.fieldKey, base + r.start, base + r.end, { x: ev?.clientX, y: ev?.clientY })
  window.getSelection()?.removeAllRanges()
}

/** 橡皮擦:点在某个已标注的段上 → 擦掉它(后端只擦相交区间) */
function onClick(ev) {
  if (!eraser.value) return
  const host = ev.target?.closest?.('.ann-seg[data-ann="1"]')
  if (!host) return
  const start = Number(host.dataset.start || 0)
  ctx.erase?.(props.fieldKey, start, start + (host.textContent || '').length)
}
</script>

<style scoped>
.ann-host { display: inline; }
/* 只在标注模式下提示"可交互",不动纸面观感(颜色仍来自行内样式,打印才带得走) */
.ann-pen { cursor: text; }
.ann-pen::selection { background: #ffe9a8; }
.ann-eraser .ann-seg[data-ann='1'] { cursor: pointer; }
.ann-eraser .ann-seg[data-ann='1']:hover { background: #ffe0e0; }
</style>
