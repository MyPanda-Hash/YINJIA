<template>
  <div class="dc-page dc-stats">
    <header class="dc-head">
      <div class="dc-head-main">
        <h1 class="dc-title">{{ tt('状态统计') }}</h1>
        <p class="dc-sub">{{ tt('按时间范围统计设备在线率、在线 / 离线数量与报警分布；在线时长由网关心跳与实际上报推算') }}</p>
      </div>
      <p class="dc-source">{{ tt('数据来源：数采网关上报（DC-Ingest 接口），未接入设备显示为离线') }}</p>
    </header>

    <div class="dc-bar">
      <span class="dc-bar-label">
        <el-icon><Calendar /></el-icon><span class="dc-btn-txt">{{ rangeText }}</span>
      </span>
      <button
        v-for="p in RANGE_PRESETS"
        :key="p.key"
        type="button"
        class="dc-chip"
        :class="{ on: presetKey === p.key }"
        :aria-pressed="presetKey === p.key"
        @click="applyPreset(p.key)"
      >
        {{ tt(p.label) }}
      </button>
      <el-date-picker
        v-model="rangePick"
        type="daterange"
        unlink-panels
        value-format="YYYY-MM-DD"
        size="default"
        :start-placeholder="tt('开始日期')"
        :end-placeholder="tt('结束日期')"
        :clearable="false"
        class="dc-date"
        @change="onRangePick"
      />
      <el-button :loading="loading" @click="load(true)">{{ tt('刷新') }}</el-button>
    </div>

    <section class="dc-kpis">
      <article v-for="k in kpiCards" :key="k.key" class="dc-kpi">
        <span class="dc-kpi-label">{{ tt(k.label) }}</span>
        <strong class="dc-kpi-num" :class="'tone-' + k.tone">{{ k.value }}<em v-if="k.unit" class="dc-kpi-unit">{{ k.unit }}</em></strong>
        <span class="dc-kpi-hint">{{ tt(k.hint) }}</span>
      </article>
    </section>

    <section class="dc-card">
      <div class="dc-card-head">
        <h2 class="dc-card-title">{{ tt('在线 / 离线趋势') }}</h2>
        <span class="dc-card-legend">
          <i class="lg on"></i>{{ tt('在线') }}
          <i class="lg off"></i>{{ tt('离线') }}
        </span>
      </div>
      <div v-if="trend.length" v-loading="loading" class="dc-trend-wrap">
        <div class="dc-trend">
          <div v-for="(t, i) in trend" :key="i" class="dc-trend-col" :title="trendTip(t)">
            <div class="dc-trend-stack">
              <i class="bar off" :style="{ height: barHeight(t.offline) }"></i>
              <i class="bar on" :style="{ height: barHeight(t.online) }"></i>
            </div>
            <span class="dc-trend-label">{{ t.label }}</span>
          </div>
        </div>
      </div>
      <div v-else-if="loading" class="dc-empty"><span>{{ tt('加载中…') }}</span></div>
      <div v-else class="dc-empty">
        <span>{{ tt('区间内没有设备在线记录') }}</span>
        <em>{{ tt('网关上报后这里才会出现柱状趋势') }}</em>
      </div>
    </section>

    <div class="dc-stats-grid">
      <section class="dc-card">
        <div class="dc-card-head">
          <h2 class="dc-card-title">{{ tt('按设备在线率') }}</h2>
          <span class="dc-card-tip">{{ tt('共') }} {{ byDevice.length }} {{ tt('台设备') }}</span>
        </div>
        <el-table
          v-if="byDevice.length"
          v-loading="loading"
          :data="byDevice"
          border
          size="small"
          class="dc-table"
          :empty-text="tt('区间内没有设备记录')"
        >
          <el-table-column :label="tt('设备')" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="dc-code">{{ row.deviceCode || '-' }}</span>
              <span v-if="row.deviceName" class="dc-muted"> · {{ row.deviceName }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="tt('在线率')" width="140">
            <template #default="{ row }">
              <!-- 从未接入的设备(无状态日志)时长与在线率都是未知,显示「-」而不是 0%(2026-10-18 用户口径) -->
              <span v-if="row.onlineRate === null || row.onlineRate === undefined" class="dc-muted">-</span>
              <el-progress v-else :percentage="pct(row.onlineRate)" :stroke-width="10" />
            </template>
          </el-table-column>
          <el-table-column :label="tt('在线时长')" width="130">
            <template #default="{ row }"><span class="dc-muted">{{ fmtDur(row.onlineSeconds, row.connected !== false) }}</span></template>
          </el-table-column>
          <el-table-column :label="tt('离线时长')" width="130">
            <template #default="{ row }"><span class="dc-muted">{{ fmtDur(row.offlineSeconds, row.connected !== false) }}</span></template>
          </el-table-column>
          <el-table-column :label="tt('报警次数')" width="92" align="right">
            <template #default="{ row }"><span class="dc-muted">{{ row.alarmCount ?? 0 }}</span></template>
          </el-table-column>
          <el-table-column :label="tt('当前状态')" width="96">
            <template #default="{ row }">
              <el-tag :type="isOnline(row.currentStatus) ? 'success' : 'info'" size="small" effect="plain">
                {{ isOnline(row.currentStatus) ? tt('在线') : tt('离线') }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div v-else-if="loading" class="dc-empty"><span>{{ tt('加载中…') }}</span></div>
        <div v-else class="dc-empty">
          <span>{{ tt('区间内没有设备记录') }}</span>
          <em>{{ tt('先到「IOT设备配置」登记设备，网关上报后开始统计') }}</em>
        </div>
      </section>

      <section class="dc-card">
        <div class="dc-card-head">
          <h2 class="dc-card-title">{{ tt('报警按级别分布') }}</h2>
          <span class="dc-card-tip">{{ tt('共') }} {{ alarmTotal }} {{ tt('条') }}</span>
        </div>
        <div v-if="byLevel.length" v-loading="loading" class="dc-levels">
          <div v-for="lv in byLevel" :key="lv.level" class="dc-level">
            <span class="dc-level-name">
              <el-tag :type="levelType(lv.level)" size="small" effect="plain">{{ lv.level ? tt(lv.level) : tt('未分级') }}</el-tag>
            </span>
            <span class="dc-level-track"><i :style="{ width: levelWidth(lv.count) }"></i></span>
            <span class="dc-level-num">{{ lv.count }}</span>
          </div>
        </div>
        <div v-else-if="loading" class="dc-empty"><span>{{ tt('加载中…') }}</span></div>
        <div v-else class="dc-empty">
          <span>{{ tt('区间内没有报警记录') }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { apiGetDcStats } from '@/business/dcApi'
import {
  PRESETS as RANGE_PRESETS,
  defaultRange,
  matchPreset,
  normalizeRange,
  presetRange,
  rangeLabel,
} from '@core/dashboard/dateRange'

const LEVEL_TYPES = {
  高: 'danger',
  中: 'warning',
  低: 'info',
  critical: 'danger',
  major: 'warning',
  minor: 'info',
  warning: 'warning',
  info: 'info',
}

const loading = ref(false)
const summary = ref({})
const byDevice = ref([])
const trend = ref([])
const byLevel = ref([])
const alarmTotal = ref(0)
const unhandled = ref(0)

const range = ref(defaultRange())
const rangePick = ref([range.value.from, range.value.to])
const presetKey = ref(matchPreset(range.value))

const rangeText = computed(() => rangeLabel(range.value))

const kpiCards = computed(() => {
  const s = summary.value || {}
  const total = num(s.deviceTotal, byDevice.value.length)
  const online = num(s.onlineNow, 0)
  const offline = num(s.offlineNow, Math.max(0, total - online))
  const rate = num(s.onlineRate, 0)
  return [
    { key: 'rate', label: '在线率', value: rateText(rate), unit: '%', tone: rate >= 90 ? 'ok' : rate >= 60 ? 'warn' : 'bad', hint: '已接入设备在线占比' },
    { key: 'online', label: '在线设备', value: online, unit: '', tone: 'ok', hint: '当前在线' },
    { key: 'offline', label: '离线设备', value: offline, unit: '', tone: offline > 0 ? 'warn' : 'neutral', hint: '当前离线（含未接入）' },
    { key: 'alarm', label: '报警数', value: alarmTotal.value, unit: '', tone: alarmTotal.value > 0 ? 'bad' : 'neutral', hint: '区间内报警总数' },
    { key: 'unhandled', label: '未处理报警', value: unhandled.value, unit: '', tone: unhandled.value > 0 ? 'warn' : 'neutral', hint: '待处理' },
  ]
})

const maxLevel = computed(() => byLevel.value.reduce((m, lv) => Math.max(m, num(lv.count, 0)), 0))

function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function pct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}
function rateText(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0.0'
  return n.toFixed(1)
}
function isOnline(status) {
  return status === '在线' || status === 'online' || status === true
}
function levelType(level) {
  return LEVEL_TYPES[level] || 'info'
}
function levelWidth(count) {
  const max = maxLevel.value
  const w = max > 0 ? Math.round((num(count, 0) / max) * 100) : 0
  return Math.max(2, w) + '%'
}
/** showZero=true:已知时长为 0 时显示 0(已接入设备);false(未接入)显示 '-' */
function fmtDur(v, showZero = false) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  if (n <= 0) return showZero ? '0' : '-'
  const d = Math.floor(n / 86400)
  const h = Math.floor((n % 86400) / 3600)
  const m = Math.floor((n % 3600) / 60)
  const parts = []
  if (d) parts.push(d + tt('天'))
  if (h) parts.push(h + tt('小时'))
  if (!d && m) parts.push(m + tt('分钟'))
  return parts.length ? parts.join(' ') : '0'
}
function barHeight(v) {
  const total = trendMax.value
  if (!total) return '0%'
  return Math.max(1, Math.round((num(v, 0) / total) * 100)) + '%'
}
const trendMax = computed(() =>
  trend.value.reduce((m, t) => Math.max(m, num(t.online, 0) + num(t.offline, 0)), 0),
)
function trendTip(t) {
  return t.label + ' · ' + tt('在线') + ' ' + num(t.online, 0) + ' / ' + tt('离线') + ' ' + num(t.offline, 0)
}

function applyPreset(key) {
  presetKey.value = key
  applyRange(presetRange(key))
}
function applyRange(r) {
  range.value = r
  rangePick.value = [r.from, r.to]
  load()
}
function onRangePick(v) {
  if (!Array.isArray(v) || v.length !== 2) return
  presetKey.value = matchPreset({ from: v[0], to: v[1] })
  applyRange(normalizeRange({ from: v[0], to: v[1] }))
}

async function load(showToast) {
  loading.value = true
  try {
    const data = await apiGetDcStats(range.value.from, range.value.to)
    summary.value = data?.summary || {}
    byDevice.value = Array.isArray(data?.byDevice) ? data.byDevice : []
    trend.value = Array.isArray(data?.trend) ? data.trend : []
    const a = data?.alarms || {}
    byLevel.value = Array.isArray(a.byLevel) ? a.byLevel : []
    alarmTotal.value = num(a.total, 0)
    unhandled.value = num(a.unhandled, 0)
    if (showToast) ElMessage.success(tt('已刷新'))
  } catch (e) {
    byDevice.value = []
    trend.value = []
    byLevel.value = []
    alarmTotal.value = 0
    unhandled.value = 0
    ElMessage.error(e?.response?.data?.message || e?.message || tt('加载状态统计失败'))
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
</script>

<style scoped>
.dc-page {
  --dc-ok: #1f8a5b;
  --dc-warn: #b87816;
  --dc-bad: #b94d3f;
  --dc-ic: #537786;
  padding: 14px 16px 24px;
  min-width: 0;
  color: var(--t-text-1);
}
.dc-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}
.dc-head-main { min-width: 0; }
.dc-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--t-text-1); }
.dc-sub { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--t-text-3); }
.dc-source {
  margin: 0;
  flex: 1 1 320px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--t-text-3);
  text-align: right;
}
.dc-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.dc-bar :deep(.el-button) { min-height: 40px; }
.dc-bar-label {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  color: var(--t-text-3);
  font-variant-numeric: tabular-nums;
}
.dc-btn-txt { margin-left: 4px; }
.dc-chip {
  min-height: 34px;
  padding: 4px 12px;
  font: inherit;
  font-size: 12px;
  color: var(--t-text-2);
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 16px;
  cursor: pointer;
}
.dc-chip:hover { background: var(--t-hover-bg); }
.dc-chip.on {
  color: #fff;
  background: var(--t-primary);
  border-color: var(--t-primary);
}
.dc-date { width: 240px; max-width: 100%; }
.dc-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.dc-kpi {
  min-width: 0;
  padding: 10px 12px;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
}
.dc-kpi-label { display: block; font-size: 12px; color: var(--t-text-3); }
.dc-kpi-num {
  display: block;
  margin-top: 2px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--t-text-1);
}
.dc-kpi-unit { margin-left: 2px; font-size: 12px; font-style: normal; font-weight: 500; color: var(--t-text-3); }
.dc-kpi-num.tone-ok { color: var(--dc-ok); }
.dc-kpi-num.tone-warn { color: var(--dc-warn); }
.dc-kpi-num.tone-bad { color: var(--dc-bad); }
.dc-kpi-num.tone-neutral { color: var(--t-text-2); }
.dc-kpi-hint { display: block; margin-top: 2px; font-size: 11px; color: var(--t-text-3); }
.dc-card {
  min-width: 0;
  margin-bottom: 12px;
  padding: 10px 12px 12px;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
}
.dc-card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dc-card-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--t-primary); }
.dc-card-tip { font-size: 12px; color: var(--t-text-3); }
.dc-card-legend {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 11px;
  color: var(--t-text-3);
}
.dc-card-legend .lg {
  width: 8px;
  height: 8px;
  margin-left: 8px;
  border-radius: 2px;
  background: var(--t-text-3);
}
.dc-card-legend .lg.on { background: var(--dc-ok); }
.dc-trend-wrap { overflow-x: auto; }
.dc-trend {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  min-width: 100%;
  padding-top: 6px;
}
.dc-trend-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  flex: 1 0 auto;
  min-width: 16px;
}
.dc-trend-stack {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-start;
  width: 100%;
  max-width: 26px;
  height: 120px;
}
.dc-trend-stack .bar { display: block; width: 100%; }
.dc-trend-stack .bar.on { background: var(--dc-ok); border-radius: 0 0 2px 2px; }
.dc-trend-stack .bar.off { background: var(--t-border); border-radius: 2px 2px 0 0; }
.dc-trend-label {
  max-width: 42px;
  overflow: hidden;
  font-size: 10px;
  color: var(--t-text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.dc-stats-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.dc-table { width: 100%; }
.dc-table :deep(.el-table__cell) { padding: 5px 0; }
.dc-code { font-variant-numeric: tabular-nums; }
.dc-muted { color: var(--t-text-3); }
.dc-levels { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.dc-level { display: flex; gap: 8px; align-items: center; min-height: 28px; }
.dc-level-name { flex: 0 0 74px; min-width: 0; }
.dc-level-track {
  flex: 1;
  height: 10px;
  overflow: hidden;
  background: var(--t-sidebar-bg);
  border-radius: 5px;
}
.dc-level-track i { display: block; height: 100%; background: var(--dc-ic); border-radius: 5px; }
.dc-level-num {
  flex: 0 0 34px;
  text-align: right;
  font-size: 12px;
  color: var(--t-text-2);
  font-variant-numeric: tabular-nums;
}
.dc-empty {
  display: grid;
  place-content: center;
  gap: 4px;
  min-height: 96px;
  padding: 12px;
  text-align: center;
  color: var(--t-text-3);
  background: var(--t-sidebar-bg);
  border: 1px dashed var(--t-border);
  border-radius: 5px;
}
.dc-empty em { font-style: normal; font-size: 11px; opacity: 0.85; }
@media (max-width: 1100px) {
  .dc-stats-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .dc-source { text-align: left; }
  .dc-date { width: 100%; }
  .dc-chip { min-height: 40px; }
}
</style>

<style>
html.dark .dc-stats {
  --dc-ok: #58b09e;
  --dc-warn: #e0a83a;
  --dc-bad: #d97364;
  --dc-ic: #8fadb9;
}
</style>
