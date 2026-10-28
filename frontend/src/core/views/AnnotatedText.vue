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
 * 标注笔交互(2026-10-28 第二轮:改回"划选即弹",与业界主流一致)
 *
 * 【用户反馈】「不好用，点击都弹不出来色盘」
 *   上一版做成了「划选 → 再点一下 → 弹盘」。实战不可行,原因是浏览器的既定行为:
 *   第二次点击时 `mousedown` 会**先清掉选区**,于是"选区已清"这个信号既可能是
 *   "用户第二次点击"、也可能是"用户点到别处",判据天然歧义 ⇒ 时灵时不灵。
 *
 * 【业界怎么做】(查证 GitHub,见下)一律是**划选结束就弹**:
 *   · recogito/text-annotator-js(BSD-3,用户最多的文本标注库):`selectionMode` 决定
 *     选中即创建,浮层由库自带;它显式提供 `dismissOnNotAnnotatable` 来控制"点空白处才收起"。
 *   · hypothesis/client(注释领域的元老级实现):`mouseup` 后弹 Adder。
 *   · openannotation/annotator:同样是 mouseup 后弹 Viewer/Adder。
 *   ⇒ 没有任何一个把"再点一下"作为主路径 —— 因为那正是本 bug 的来源。
 *
 * 【本实现】回到 mouseup 即弹,但用**两道守卫**避免上一版想解决的误触:
 *   ① 拖拽补发的 click 不再参与判断(根本不监听 click);
 *   ② 只在**真正的文字选区**上弹(非空、未折叠、同一文本节点),
 *      单纯点击(无拖拽)不会产生选区 ⇒ 不会误弹。
 *   ③ 弹盘后立即清选区(与主流一致:色盘一出现,选区使命就完成了)。
 *
 * 兼容:`armMaxAgeMs`/`armed` 保留为无害的过渡态(色盘弹出前的一瞬),
 * 便于将来若要做"二次确认"再挂逻辑,也让测试能观察到"已选中待确认"。
 */
const armMaxAgeMs = 3000
/** 最近一次有效划选(弹出瞬时态;色盘出现后即被清) */
const armed = ref(null)
/** 上次 mouseup 的时刻 */
let lastUpAt = 0

/** 标注笔:划选一段文字 → **立即**交范围给上层弹色盘(主流做法) */
function onMouseUp(ev) {
  if (!pen.value) return
  const r = rangeInTextNode(window.getSelection())
  lastUpAt = Date.now()
  if (!r) { armed.value = null; return }
  const base = Number(r.node.parentElement?.dataset?.start || 0)
  const sel = {
    fieldKey: props.fieldKey,
    start: base + r.start,
    end: base + r.end,
    text: r.node.textContent.slice(r.start, r.end),
    x: ev?.clientX ?? 0,
    y: ev?.clientY ?? 0,
  }
  armed.value = sel
  // 立即弹盘(不再等"第二次点击"):清理选区后交给上层
  window.getSelection?.()?.removeAllRanges?.()
  ctx.ask?.(sel.fieldKey, sel.start, sel.end, { x: sel.x, y: sel.y })
}

/** 保留给"点击已标注段"等场景;标注笔路径不再依赖它 */
function fireIfArmed(ev) {
  const a = armed.value
  if (!a || a.fieldKey !== props.fieldKey) return false
  if (Date.now() - lastUpAt > armMaxAgeMs) { armed.value = null; return false }
  armed.value = null
  ctx.ask?.(a.fieldKey, a.start, a.end, { x: ev?.clientX || a.x, y: ev?.clientY || a.y })
  return true
}

/** 橡皮擦:点在某个已标注的段上 → 擦掉它(后端只擦相交区间);标注笔路径已不再依赖 click */
function onClick(ev) {
  if (eraser.value) {
    const host = ev.target?.closest?.('.ann-seg[data-ann="1"]')
    if (!host) return
    const start = Number(host.dataset.start || 0)
    ctx.erase?.(props.fieldKey, start, start + (host.textContent || '').length)
  }
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
