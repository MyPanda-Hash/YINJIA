<template>
  <div class="sline" :class="{ compact }">
    <div v-if="data.length" class="line-context">
      <span class="ctx-max">{{ tt('峰值') }} {{ peakText }}</span>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="line-svg">
      <line v-for="y in [30, 60, 90]" :key="y" x1="12" :y1="y" x2="308" :y2="y" class="grid-line" />
      <polygon :points="areaA" class="line-area" />
      <polyline :points="ptsA" fill="none" stroke="#537786" stroke-width="2" class="series-line" />
      <polyline :points="ptsB" fill="none" stroke="#116a5b" stroke-width="2" stroke-dasharray="5 4" class="series-line series-done" />
      <circle v-for="(p, i) in xysA" :key="'a' + i" :cx="p.x" :cy="p.y" r="2.5" fill="#537786" :class="{ peak: i === peakIdxA }" />
      <circle v-for="(p, i) in xysB" :key="'d' + i" :cx="p.x" :cy="p.y" r="2.5" fill="#116a5b" />
      <!-- 末点数值标注(at-a-glance:最后一天直接读数,不必追 Y 轴) -->
      <text v-if="lastA && data.length" :x="Math.min(lastA.x, W - 6)" :y="Math.max(lastA.y - 6, 10)" class="last-val" text-anchor="end">{{ lastText }}</text>
    </svg>
    <div class="line-x">
      <span v-for="d in data" :key="d.date" class="lx">{{ d.date }}</span>
    </div>
    <div class="line-legend">
      <span class="lg-k"><i class="lg-dot added"></i>{{ legendA }}</span>
      <span class="lg-k"><i class="lg-dot done"></i>{{ legendB }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  data: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
  // 图例文案(2026-09-28 桌面深度开发:出入库/送检合格等场景复用;默认保持原 新增/完工)
  legendA: { type: String, default: '新增' },
  legendB: { type: String, default: '完工' },
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
const lastA = computed(() => xysA.value[xysA.value.length - 1] || null)
const lastText = computed(() => {
  const d = props.data[props.data.length - 1]
  return d ? String(d.added || 0) : ''
})
</script>

<style scoped>
.sline {
  display: flex;
  flex-direction: column;
}
/* 语境标注行(峰值读数,2026-09-28 参考升级) */
.line-context {
  display: flex;
  justify-content: flex-end;
  font-size: 10px;
  color: var(--t-text-3);
  padding: 0 2px 2px;
}
.ctx-max {
  font-variant-numeric: tabular-nums;
}
.line-svg {
  width: 100%;
  height: 130px;
}
/* 峰值点放大强调 */
circle.peak {
  r: 4;
  stroke: #d79a2b;
  stroke-width: 1.5;
}
/* 末点数值标注 */
.last-val {
  font-size: 9px;
  font-weight: 650;
  fill: var(--t-text-2);
  font-variant-numeric: tabular-nums;
}
.grid-line {
  stroke: var(--t-border-light);
  stroke-width: 1;
}
.line-area {
  fill: #537786;
  opacity: 0.08;
}
.series-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw-line 0.9s ease forwards;
}
.series-line.series-done {
  stroke-dasharray: 5 4;
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
  display: flex;
  gap: 16px;
  justify-content: center;
  font-size: 12px;
  color: var(--t-text-2);
  margin-top: 8px;
}
.lg-k {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.lg-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.lg-dot.added { background: #537786; }
.lg-dot.done { background: #116a5b; }
.sline.compact .line-svg {
  height: 80px;
}
.sline.compact .line-x {
  padding-top: 0;
  font-size: 8px;
}
.sline.compact .line-legend {
  justify-content: flex-end;
  margin-top: 3px;
  font-size: 9px;
}

@media (prefers-reduced-motion: reduce) {
  .series-line {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
