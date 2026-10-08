<template>
  <div class="scapbars">
    <div class="cap-head">
      <div class="cap-tabs" role="tablist" :aria-label="tt('产能统计周期')">
        <button
          v-for="p in periods"
          :key="p.key"
          type="button"
          role="tab"
          class="cap-tab"
          :class="{ on: period === p.key }"
          :aria-selected="period === p.key"
          @click="select(p.key)"
        >
          {{ tt(p.label) }}
        </button>
      </div>
      <span class="cap-sub" :title="subText">{{ subText }}</span>
    </div>

    <div v-if="loading" class="chart-empty">{{ tt('加载中') }}…</div>
    <div v-else-if="!scaled.rows.length" class="chart-empty">{{ tt('暂无数据') }}</div>
    <template v-else>
      <!-- 竖向双柱:每产线一组(实际 + 上限),共用同一条刻度轴 -->
      <div class="cap-plot">
        <div class="cap-grid" aria-hidden="true">
          <span v-for="t in ticks" :key="t.pct" class="grid-line" :style="{ bottom: t.pct + '%' }">
            <em class="grid-num">{{ fmtCompact(t.value) }}</em>
          </span>
        </div>
        <div class="cap-groups">
          <div
            v-for="r in scaled.rows"
            :key="r.name"
            class="cap-group"
            :title="rowTitle(r)"
            :aria-label="rowTitle(r)"
          >
            <div class="cap-pair">
              <div class="cap-bar actual" :class="'tone-' + r.tone" :style="{ height: r.actualPct + '%' }">
                <span class="bar-num">{{ fmtCompact(r.actual) }}</span>
              </div>
              <div
                class="cap-bar limit"
                :class="{ none: r.limit == null }"
                :style="{ height: r.limitPct + '%' }"
              ></div>
            </div>
            <span class="cap-name" :title="r.name">{{ r.name }}</span>
          </div>
        </div>
      </div>
      <div class="cap-legend">
        <span class="lg-k"><i class="lg-swatch actual"></i>{{ tt('实际产出') }}</span>
        <span class="lg-k"><i class="lg-swatch limit"></i>{{ tt('产能上限') }}</span>
        <span class="lg-k"><i class="lg-dot ok"></i>&lt;80%</span>
        <span class="lg-k"><i class="lg-dot warn"></i>80–100%</span>
        <span class="lg-k"><i class="lg-dot over"></i>&gt;100%</span>
      </div>
    </template>
  </div>
</template>

<script setup>
/**
 * SCapacityBars —— 产能对比(竖向双柱 + 周期 tab)。
 *
 * 2026-10-08 用户需求:「把生产方面的日产能对比加上可以 tap 切换周产能、月产能、年产能对比,
 * 然后柱状图应该是竖向排列」。
 *   · 取代原 SCapacity.vue 的水平子弹条(同一块卡片),改成**竖向柱**:
 *     每条产线一组两根柱 —— 实际(语义色)与上限(浅色),共用一条刻度轴才能读出「实际比上限高」;
 *   · 四档周期各自向后端取数(`/dashboard/capacity?period=`) —— 切 tab 只重算这一块,
 *     不重跑整桌面的聚合;周期口径(最近有报工的那个周期)与上限折算由后端定,前端不自行推算;
 *   · 柱高/刻度/配色口径全在纯函数 `@core/dashboard/capacityBars`(有单测),本组件只负责画。
 * 为什么是竖向:横向条在同一屏里最多堆 8~10 条就占满高度,而「周期对比」的直觉是时间轴上的柱,
 * 且竖向柱能并排表达「实际 vs 上限」这组对照(横向条只能叠两层)。
 */
import { computed, onMounted, ref } from 'vue'
import request from '@core/request'
import { tt } from '@/i18n'
import { CAPACITY_PERIODS, fmtCompact, scaleCapacity } from '@core/dashboard/capacityBars'

const periods = CAPACITY_PERIODS
const period = ref(periods[0].key)
const payload = ref({ rows: [] })
const loading = ref(false)
/** 连点 tab 时丢弃过期响应(慢的那个后到会把新周期的数据画上去) */
let seq = 0

const scaled = computed(() => scaleCapacity(payload.value.rows || []))

/** 纵轴刻度:0/25/50/75/100% 五档(轴上限即最大柱值,数值用紧凑格式) */
const ticks = computed(() =>
  [0, 25, 50, 75, 100].map((pct) => ({ pct, value: Math.round((scaled.value.max * pct) / 100) })),
)

const subText = computed(() => {
  const d = payload.value
  const p = periods.find((x) => x.key === period.value) || periods[0]
  const span = d.from ? `${d.from}${d.to && d.to !== d.from ? ' ~ ' + d.to : ''}` : ''
  const rule = p.days
    ? `${tt('上限 = 日产能 ×')} ${p.days} ${tt('天')}`
    : tt('上限 = 日产能 × 当月自然日')
  return [span ? `${tt('数据区间')} ${span}` : '', rule].filter(Boolean).join(' · ')
})

function select(key) {
  if (key === period.value) return
  period.value = key
  load()
}

function rowTitle(r) {
  const head = `${r.name}：${tt('实际产出')} ${fmtCompact(r.actual)}`
  if (r.limit == null) return `${head} · ${tt('未配日产能上限，请在产线档案维护')}`
  return `${head} / ${tt('产能上限')} ${fmtCompact(r.limit)}（${r.pct}%）`
}

async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const r = await request.get('/dashboard/capacity', { params: { period: period.value } })
    if (mine !== seq) return
    payload.value = r?.data || { rows: [] }
  } catch {
    if (mine === seq) payload.value = { rows: [] }
  } finally {
    if (mine === seq) loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.scapbars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px;
}
.cap-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
/* 周期切换:分段控件形态(工具界面要密、静,不抢图表的注意力) */
.cap-tabs {
  display: inline-flex;
  border: 1px solid var(--t-border-light);
  border-radius: 4px;
  overflow: hidden;
}
.cap-tab {
  border: 0;
  background: transparent;
  color: var(--t-text-2);
  font-size: 12px;
  line-height: 1;
  padding: 6px 10px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.cap-tab + .cap-tab {
  border-left: 1px solid var(--t-border-light);
}
.cap-tab:hover {
  background: var(--t-fill-hover, rgba(0, 0, 0, 0.04));
  color: var(--t-text-1);
}
.cap-tab:focus-visible {
  outline: 2px solid #116a5b;
  outline-offset: -2px;
}
.cap-tab.on {
  background: #116a5b;
  color: #fff;
  font-weight: 600;
}
.cap-sub {
  font-size: 11px;
  color: var(--t-text-3);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cap-plot {
  position: relative;
  height: 190px;
  margin-top: 2px;
  padding-left: 40px;
  padding-bottom: 18px;
}
.cap-grid {
  position: absolute;
  inset: 0 0 18px 40px;
  pointer-events: none;
}
.grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px solid var(--t-border-light);
}
.grid-line:first-child {
  border-top-color: var(--t-border, rgba(0, 0, 0, 0.18));
}
.grid-num {
  position: absolute;
  left: -40px;
  top: -7px;
  width: 34px;
  text-align: right;
  font-size: 10px;
  font-style: normal;
  color: var(--t-text-3);
  font-variant-numeric: tabular-nums;
}
.cap-groups {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 100%;
}
.cap-group {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
  border-radius: 4px;
  padding: 0 2px;
  transition: background-color 0.15s ease;
}
.cap-group:hover {
  background: var(--t-fill-hover, rgba(0, 0, 0, 0.04));
}
.cap-pair {
  flex: 1 1 auto;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  min-height: 0;
}
.cap-bar {
  position: relative;
  width: 50%;
  max-width: 22px;
  min-height: 1px;
  border-radius: 3px 3px 0 0;
  transform-origin: bottom;
  animation: cap-rise 0.45s ease both;
}
@keyframes cap-rise {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
.cap-bar.actual { background: #116a5b; }
.cap-bar.actual.tone-warn { background: #d79a2b; }
.cap-bar.actual.tone-over { background: #b94d3f; }
.cap-bar.actual.tone-na { background: #8a9a92; }
.cap-bar.limit { background: #c3cad3; }
.cap-bar.limit.none { background: transparent; border-top: 1px dashed #c3cad3; }
.bar-num {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: -14px;
  font-size: 10px;
  font-weight: 600;
  color: var(--t-text-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}
.cap-name {
  font-size: 11px;
  color: var(--t-text-2);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cap-legend {
  display: flex;
  gap: 14px;
  justify-content: center;
  font-size: 11px;
  color: var(--t-text-3);
}
.lg-k { display: inline-flex; align-items: center; gap: 4px; }
.lg-swatch { width: 9px; height: 9px; border-radius: 2px; }
.lg-swatch.actual { background: #116a5b; }
.lg-swatch.limit { background: #c3cad3; }
.lg-dot { width: 8px; height: 8px; border-radius: 50%; }
.lg-dot.ok { background: #116a5b; }
.lg-dot.warn { background: #d79a2b; }
.lg-dot.over { background: #b94d3f; }
@media (prefers-reduced-motion: reduce) {
  .cap-bar { animation: none; }
}
.chart-empty {
  color: var(--t-text-3);
  font-size: 12px;
  text-align: center;
  padding: 40px 0;
}
</style>
