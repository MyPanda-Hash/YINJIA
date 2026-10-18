<template>
  <div class="sline" :class="{ compact }">
    <!-- 图例上置 + 线型示意(2026-10-15:原先只有底部两个小圆点,只能表达颜色、
         表达不了"实线/虚线",而两条线又都是深色(蓝灰 vs 墨绿) ⇒ 用户报「分不出哪条线是什么」)。
         现在:每条 = 线型色块(实线/虚线) + 名称 + **最新值**,颜色与线型双重对应。 -->
    <div v-if="data.length" class="line-top">
      <span v-if="!compact" class="ctx-max">{{ tt('峰值') }} {{ peakText }}</span>
      <span class="line-legend" :title="tt('图例数字 = 区间合计')">
        <span class="lg-k">
          <i class="lg-chip" :style="{ background: colorA }"></i>{{ legendA }}
          <b class="lg-num" :style="{ color: colorA }">{{ sum.added }}</b>
        </span>
        <span class="lg-k">
          <i class="lg-chip dashed" :style="{ '--c': colorB }"></i>{{ legendB }}
          <b class="lg-num" :style="{ color: colorB }">{{ sum.done }}</b>
        </span>
      </span>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="line-svg">
      <line v-for="y in [30, 60, 90]" :key="y" x1="12" :y1="y" x2="308" :y2="y" class="grid-line" />
      <polygon :points="areaA" class="line-area" :style="{ fill: colorA }" />
      <polyline :points="ptsA" fill="none" :stroke="colorA" stroke-width="2" class="series-line" />
      <polyline :points="ptsB" fill="none" :stroke="colorB" stroke-width="2" class="series-line series-done" />
      <circle v-for="(p, i) in xysA" :key="'a' + i" :cx="p.x" :cy="p.y" r="1.8" :fill="colorA" :class="{ peak: i === peakIdxA }" />
      <circle v-for="(p, i) in xysB" :key="'d' + i" :cx="p.x" :cy="p.y" r="1.8" :fill="colorB" />
    </svg>
    <div class="line-x">
      <span v-for="d in xLabels" :key="d.i" class="lx">{{ d.date }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { tt } from '@/i18n'
import { thinLabels, sumValues } from './chartLabels.js'

const props = defineProps({
  data: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
  // 图例文案(2026-09-28 桌面深度开发:出入库/送检合格等场景复用;默认保持原 新增/完工)
  legendA: { type: String, default: '新增' },
  legendB: { type: String, default: '完工' },
  /** X 轴最多显示几个日期标签(2026-10-15:近 30 天趋势有 30 个点,全画会糊成一片) */
  maxLabels: { type: Number, default: 8 },
  /** 序列配色(2026-10-15):原 A=#537786 蓝灰 / B=#116a5b 墨绿,**两个都是深色、明度接近**,
   *  叠在一起分不出来。默认改成 暖琥珀(明) / 冷墨绿(深),拉开明度与冷暖。 */
  colorA: { type: String, default: '#d79a2b' },
  colorB: { type: String, default: '#116a5b' },
})

const W = 320
const H = 120
const PAD = 12

const max = computed(() => Math.max(...props.data.flatMap((d) => [d.added || 0, d.done || 0]), 1))
const xy = (key) => {
  const n = props.data.length
  return props.data.map((d, i) => ({
    x: n <= 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1),
    y: H - PAD - ((d[key] || 0) / max.value) * (H - PAD * 2),
  }))
}
const xysA = computed(() => xy('added'))
const xysB = computed(() => xy('done'))
const ptsA = computed(() => xysA.value.map((p) => `${p.x},${p.y}`).join(' '))
const ptsB = computed(() => xysB.value.map((p) => `${p.x},${p.y}`).join(' '))
const areaA = computed(() => {
  if (!xysA.value.length) return ''
  return `${PAD},${H - PAD} ${ptsA.value} ${W - PAD},${H - PAD}`
})
// 语境标注(2026-09-28 参考升级):峰值=added 序列最大值;末点=added 最后一天读数
const peakIdxA = computed(() => {
  let best = -1, bv = -1
  props.data.forEach((d, i) => { if ((d.added || 0) > bv) { bv = d.added || 0; best = i } })
  return best
})
const peakText = computed(() => {
  const d = props.data[peakIdxA.value]
  return d ? `${d.date} · ${d.added || 0}` : ''
})
/** 图例数字 = 区间合计(2026-10-18 用户报「显示 0」:原取最后一天,今天没业务就恒为 0) */
const sum = computed(() => sumValues(props.data))
/** X 轴标签抽稀(逻辑见 chartLabels.js,有单测):首尾必含、与折线等距点位对齐 */
const xLabels = computed(() => thinLabels(props.data, props.maxLabels))
</script>

<style scoped>
.sline {
  display: flex;
  flex-direction: column;
}
/* 顶行:左＝峰值读数,右＝图例(线型色块 + 名称 + 最新值)
   2026-10-15:图例从底部小圆点挪到顶部并画出**线型**(实线/虚线),配合拉开明度的配色,
   解决「两条深色线叠在一起分不出哪条是哪条」。 */
.line-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  color: var(--t-text-3);
  padding: 0 2px 4px;
}
.ctx-max {
  font-variant-numeric: tabular-nums;
}
.line-svg {
  width: 100%;
  height: 130px;
}
/* 峰值点放大强调(描边用砖红,避免与两条序列的琥珀/墨绿撞色) */
circle.peak {
  r: 4;
  stroke: #b94d3f;
  stroke-width: 1.5;
}
.grid-line {
  stroke: var(--t-border-light);
  stroke-width: 1;
}
.line-area {
  opacity: 0.1;
}
.series-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw-line 0.9s ease forwards;
}
.series-line.series-done {
  stroke-dasharray: 6 4;
  stroke-dashoffset: 1000;
}
@keyframes draw-line {
  to { stroke-dashoffset: 0; }
}
.line-x {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--t-text-3);
  padding: 2px 6px 0;
}
.lx {
  flex-shrink: 0;
}
.line-legend {
  display: inline-flex;
  gap: 14px;
  font-size: 11px;
  color: var(--t-text-2);
}
.lg-k {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
/* 线型色块:实线用纯色条,虚线用 repeating-gradient 画出一段一段,和折线样式一一对应 */
.lg-chip {
  width: 18px;
  height: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}
.lg-chip.dashed {
  background: repeating-linear-gradient(90deg, var(--c) 0 6px, transparent 6px 10px);
}
.lg-num {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sline.compact .line-svg {
  height: 80px;
}
.sline.compact .line-x {
  padding-top: 0;
  font-size: 8px;
}
.sline.compact .line-legend {
  font-size: 9px;
  gap: 10px;
}
.sline.compact .lg-chip { width: 12px; }

@media (prefers-reduced-motion: reduce) {
  .series-line {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
