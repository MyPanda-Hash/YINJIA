<template>
  <div class="scap">
    <template v-if="rows.length">
      <div v-for="r in rows" :key="r.name" class="cap-row" :title="rowTitle(r)">
        <span class="cap-label" :title="r.name">{{ r.name }}</span>
        <div class="cap-track">
          <!-- 100% 上限刻度线:产出相对上限的位置一眼可读 -->
          <i class="cap-mark" title=""></i>
          <div class="cap-fill" :class="toneOf(r)" :style="{ width: fillPct(r) + '%' }"></div>
        </div>
        <span class="cap-val" :class="'tone-' + toneOf(r)">{{ valText(r) }}</span>
      </div>
      <div class="cap-legend">
        <span class="lg-k"><i class="lg-dot ok"></i>&lt;80%</span>
        <span class="lg-k"><i class="lg-dot warn"></i>80–100%</span>
        <span class="lg-k"><i class="lg-dot over"></i>&gt;100%</span>
      </div>
    </template>
    <div v-else class="chart-empty">{{ tt('暂无数据') }}</div>
  </div>
</template>

<script setup>
// SCapacity —— 单天产能比子弹条(2026-09-28 用户需求:产线当日产能 ÷ 产能上限的直观对照)。
// 语义色对照 Tulip 制造业看板口径:绿=正常 / 黄=接近满载 / 红=超上限;超 100% 时条帽停在
// 100% 并加发亮描边(比例失真是误导,溢出用颜色+数字表达)。数字 tabular-nums;空态走 tt()。
import { tt } from '@/i18n'

const props = defineProps({
  /** [{name, actual, limit, pct}] limit=null 表示该产线未配日产能 */
  rows: { type: Array, default: () => [] },
})

function toneOf(r) {
  if (r.pct == null) return 'na'
  if (r.pct > 100) return 'over'
  if (r.pct >= 80) return 'warn'
  return 'ok'
}
/** 条宽:≤100% 按真实比例;>100% 帽在 100%(溢出靠颜色/数字,不拉伸误导) */
function fillPct(r) {
  if (r.pct == null || r.limit == null) return 0
  return Math.min(100, Math.max(0, Math.round((r.actual / r.limit) * 100)))
}
function valText(r) {
  if (r.limit == null) return `${r.actual} / —`
  return `${r.actual} / ${r.limit}（${r.pct}%）`
}
function rowTitle(r) {
  if (r.limit == null) return `${r.name}：${r.actual}（${tt('未配日产能上限，请在产线档案维护')}）`
  return `${r.name}：${r.actual} / ${r.limit}（${r.pct}%）`
}
</script>

<style scoped>
.scap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
}
.cap-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 4px;
  padding: 1px 2px;
  transition: background-color 0.15s ease;
}
.cap-row:hover {
  background: var(--t-fill-hover, rgba(0, 0, 0, 0.04));
}
.cap-label {
  width: 96px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--t-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
.cap-track {
  position: relative;
  flex: 1;
  height: 18px;
  background: var(--t-border-light);
  border-radius: 3px;
  overflow: hidden;
}
/* 上限刻度线:轨道 100% 处的竖线(轨道即 [0,上限] 量程) */
.cap-mark {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 0;
  border-right: 2px dashed rgba(0, 0, 0, 0.28);
  z-index: 1;
}
.cap-fill {
  height: 100%;
  border-radius: 3px 0 0 3px;
  animation: cap-grow 0.5s ease both;
  transform-origin: left;
}
.cap-fill.ok { background: #116a5b; }
.cap-fill.warn { background: #d79a2b; }
.cap-fill.over { background: #b94d3f; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.55); }
.cap-fill.na { background: #c3cad3; }
@keyframes cap-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.cap-val {
  width: 130px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--t-text-1);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.cap-val.tone-ok { color: #116a5b; }
.cap-val.tone-warn { color: #b07a12; }
.cap-val.tone-over { color: #b94d3f; }
.cap-val.tone-na { color: var(--t-text-3); font-weight: 400; }
.cap-legend {
  display: flex;
  gap: 14px;
  justify-content: center;
  font-size: 11px;
  color: var(--t-text-3);
  margin-top: 2px;
}
.lg-k { display: inline-flex; align-items: center; gap: 4px; }
.lg-dot { width: 8px; height: 8px; border-radius: 50%; }
.lg-dot.ok { background: #116a5b; }
.lg-dot.warn { background: #d79a2b; }
.lg-dot.over { background: #b94d3f; }
@media (prefers-reduced-motion: reduce) {
  .cap-fill { animation: none; }
}
.chart-empty {
  color: var(--t-text-3);
  font-size: 12px;
  text-align: center;
  padding: 30px 0;
}
</style>
