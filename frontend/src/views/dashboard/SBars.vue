<template>
  <div class="sbars">
    <template v-if="data.length">
      <div v-for="(d, i) in data" :key="i" class="bar-row" :class="{ top: i === 0 && sorted }" :title="`${d.name}：${fmt(d.value)}${d.meta ? '（' + d.meta + '）' : ''}`">
        <span class="bar-label" :title="d.name">{{ d.name }}</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: pct(d.value) + '%', background: colorOf(i) }"></div>
        </div>
        <span class="bar-val">{{ fmt(d.value) }}</span>
        <span v-if="showPct && total > 0" class="bar-pct">{{ Math.round(((d.value || 0) / total) * 100) }}%</span>
      </div>
    </template>
    <div v-else class="chart-empty">{{ tt('暂无数据') }}</div>
  </div>
</template>

<script setup>
// SBars —— 横向条形(桌面图表族)。
// 2026-09-28 对照公开看板设计参考(UXPin 指南/Tulip 制造业实践)升级:
//  · 数值语境化:千分位/万位紧凑格式 + 可选占比百分比(showPct)
//  · 渐进披露:整行 title 提示(名称/值/口径 meta)
//  · 视觉层级:降序数据的首行(top)值加粗强调
//  · 可访问性:数字 tabular-nums(不随字宽跳动);空态文案走 tt()
import { computed } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  data: { type: Array, default: () => [] },
  colors: { type: Array, default: () => ['#116a5b', '#d79a2b', '#537786', '#8a9a92', '#3b8978', '#b94d3f', '#9c7650', '#708575'] },
  /** 图例显示占比百分比(分类型数据开;排名型默认关) */
  showPct: { type: Boolean, default: false },
  /** 数据已按降序传入(仅影响首行强调样式) */
  sorted: { type: Boolean, default: true },
})

const max = computed(() => {
  const m = Math.max(...props.data.map((d) => d.value || 0), 1)
  return m || 1
})
const total = computed(() => props.data.reduce((s, d) => s + (d.value || 0), 0))

function pct(v) {
  return Math.round(((v || 0) / max.value) * 100)
}
function colorOf(i) {
  return props.colors[i % props.colors.length]
}
/** 千分位;≥1 万缩「x.x万」(KPI 同款 formatCompact 口径) */
function fmt(v) {
  const n = Number(v || 0)
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString('zh-CN')
}
</script>

<style scoped>
.sbars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 2px;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 4px;
  padding: 1px 2px;
  transition: background-color 0.15s ease;
}
.bar-row:hover {
  background: var(--t-fill-hover, rgba(0, 0, 0, 0.04));
}
.bar-label {
  width: 88px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--t-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
.bar-track {
  flex: 1;
  height: 16px;
  background: var(--t-border-light);
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  min-width: 2px;
  animation: bar-grow 0.5s ease both;
  transform-origin: left;
}
@keyframes bar-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.bar-row:hover .bar-fill {
  filter: brightness(1.08);
}
.bar-val {
  width: 48px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--t-text-1);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* 首行(最大值)强调:视觉层级 top-first(UXPin 指南) */
.bar-row.top .bar-val {
  font-size: 14px;
  font-weight: 750;
}
.bar-pct {
  width: 38px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--t-text-3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .bar-fill { animation: none; }
}
.chart-empty {
  color: var(--t-text-3);
  font-size: 12px;
  text-align: center;
  padding: 30px 0;
}
</style>
