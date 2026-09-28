<template>
  <div class="sdonut">
    <template v-if="data.length">
    <div class="donut-wrap">
      <svg viewBox="0 0 120 120" class="donut-svg">
        <circle cx="60" cy="60" r="48" fill="none" stroke="var(--t-border-light)" stroke-width="16" />
        <circle
          v-for="(seg, i) in segments"
          :key="i"
          cx="60" cy="60" r="48" fill="none"
          :stroke="colorOf(i)" stroke-width="16"
          :stroke-dasharray="`${seg.len} ${C - seg.len}`"
          :stroke-dashoffset="-seg.offset"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div class="donut-center">
        <div class="donut-total">{{ total }}</div>
        <div class="donut-sub">{{ sub }}</div>
      </div>
    </div>
    <div class="donut-legend">
      <div v-for="(seg, i) in segments" :key="i" class="lg-item" :title="`${seg.name}：${fmt(seg.value)}（${pctOf(seg.value)}%）`">
        <span class="lg-dot" :style="{ background: colorOf(i) }"></span>
        <span class="lg-name">{{ seg.name }}</span>
        <span class="lg-val">{{ fmt(seg.value) }}</span>
        <span class="lg-pct">{{ pctOf(seg.value) }}%</span>
      </div>
    </div>
    </template>
    <div v-else class="chart-empty">{{ tt('暂无数据') }}</div>
  </div>
</template>

<script setup>
// SDonut —— 环形占比(桌面图表族)。
// 2026-09-28 参考升级:图例带占比百分比 + 数值千分位/万位紧凑(语境化);
// 空态文案走 tt();数字 tabular-nums。
import { computed } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  data: { type: Array, default: () => [] },
  sub: { type: String, default: '合计' },
  colors: { type: Array, default: () => ['#116a5b', '#d79a2b', '#537786', '#8a9a92', '#3b8978', '#b94d3f', '#9c7650', '#708575'] },
})

const C = 2 * Math.PI * 48
const total = computed(() => props.data.reduce((s, d) => s + (d.value || 0), 0))
const segments = computed(() => {
  let acc = 0
  return props.data.map((d) => {
    const len = total.value ? (d.value / total.value) * C : 0
    const seg = { name: d.name, value: d.value, len, offset: acc }
    acc += len
    return seg
  })
})
function colorOf(i) {
  return props.colors[i % props.colors.length]
}
function pctOf(v) {
  return total.value ? Math.round(((v || 0) / total.value) * 100) : 0
}
function fmt(v) {
  const n = Number(v || 0)
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString('zh-CN')
}
</script>

<style scoped>
.sdonut {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 4px 2px;
}
.donut-wrap {
  position: relative;
  width: 132px;
  height: 132px;
  flex-shrink: 0;
}
.donut-svg {
  width: 100%;
  height: 100%;
}
.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.donut-total {
  font-size: 22px;
  font-weight: 700;
  color: var(--t-text-1);
}
.donut-sub {
  font-size: 11px;
  color: var(--t-text-3);
}
.donut-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}
.lg-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--t-text-2);
}
.lg-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.lg-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lg-val {
  font-weight: 600;
  color: var(--t-text-1);
  font-variant-numeric: tabular-nums;
}
.lg-pct {
  width: 38px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--t-text-3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.chart-empty {
  color: var(--t-text-3);
  font-size: 12px;
  text-align: center;
  padding: 30px 0;
  width: 100%;
}
</style>
