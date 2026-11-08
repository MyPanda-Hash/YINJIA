<!--
  WoProgressRing.vue — 「生产工序进度看板」看板视图的单个工序环形进度(2026-11-08)

  纯展示组件:不请求、不跳转,只吃接口契约里的一个「工序步骤」对象:
    { 序, 工序, 换算率, 完工量, 待审量, 计划量, 报工单数, 当前, 状态, 已完成 }

  🔴 2026-11-08 用户口径修正:「图片仅作为参考样式,实际设计风格按照当前的系统实现创建」
   ⇒ 环的配色用**系统色**(与现有 Element Plus 页面一致):
      已完成/超产 #67c23a · 进行中 #409eff · 未开始 #c0c4cc;
      当前工序 = 系统蓝细描边 + 浅蓝底(#ecf5ff)高亮,不要发光/呼吸大特效。
  版式仍按参考图的信息结构:环上=工序名、环内=百分比、环下=完工量/计划量。
  状态口径由后端四态给出(ProcessTaskService.stepsSummary),前端不猜业务。
-->
<template>
  <div class="wpr" :class="['st-' + tone, { 'is-current': isCurrent }]"
       :style="{ width: size + 8 + 'px' }" :title="tipText">
    <span class="wpr-name">{{ tt(step['工序'] || '') }}</span>
    <div class="wpr-ring" :style="{ width: size + 'px', height: size + 'px' }">
      <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
        <!-- 当前工序:浅蓝底 + 系统蓝细描边(不发光、不呼吸) -->
        <circle v-if="isCurrent" class="wpr-cur-bg" :cx="half" :cy="half" :r="radius" fill="#ecf5ff" />
        <circle class="wpr-track" :cx="half" :cy="half" :r="radius" :stroke-width="strokeW" fill="none" />
        <circle v-if="isCurrent" class="wpr-cur-ring" :cx="half" :cy="half"
                :r="radius + strokeW / 2 + 2" :stroke-width="1" fill="none" />
        <circle class="wpr-arc" :cx="half" :cy="half" :r="radius" :stroke-width="strokeW" fill="none"
                stroke-linecap="round" :stroke-dasharray="circumference" :stroke-dashoffset="dashOffset"
                :transform="`rotate(-90 ${half} ${half})`" />
      </svg>
      <span class="wpr-center">
        <b>{{ pctText }}</b><i>%</i>
      </span>
    </div>
    <span class="wpr-nums">
      <b>{{ fmt(step['完工量']) }}</b><i>/</i><em>{{ fmt(step['计划量']) }}</em>
    </span>
    <!-- 检验徽标(2026-11-08 第4轮):应检工序(成型/组装)才有;用户口径
         「进行到哪一步,那个环节会提示品质进行检验」——环下直接给状态色 + 悬停列出检验单 -->
    <span v-if="inspect" class="wpr-ins" :class="'ins-' + insTone" :title="insTip">{{ insText }}</span>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { tt } from '@/i18n'

defineOptions({ name: 'WoProgressRing' })

const props = defineProps({
  /** 工序步骤(接口契约「工序步骤」数组里的一项) */
  step: { type: Object, default: () => ({}) },
  /** 环直径(px);1920 用 72,1392 窄屏用 60(看板 6 列后完工信息列约 290px,4 道环要一排放下) */
  size: { type: Number, default: 72 },
  /** 环宽(px) */
  strokeW: { type: Number, default: 6 },
})

const half = computed(() => props.size / 2)
/** 留 2px 给描边/描边外圈,避免被 viewBox 裁掉 */
const radius = computed(() => Math.max(6, (props.size - props.strokeW) / 2 - 2))
const circumference = computed(() => 2 * Math.PI * radius.value)
const isCurrent = computed(() => !!props.step?.['当前'])

/** 百分比口径 = 完工量 / 计划量;无计划量时按「已完成」兜底 100 / 0 */
const pct = computed(() => {
  const plan = Number(props.step?.['计划量'] || 0)
  const done = Number(props.step?.['完工量'] || 0)
  if (plan > 0) return (done / plan) * 100
  return props.step?.['已完成'] ? 100 : 0
})
/** 弧长只画 0~100(超产按满环显示,百分比文字仍给真实值,如 102) */
const arcPct = computed(() => Math.max(0, Math.min(100, pct.value)))

const pctText = computed(() => {
  const v = Math.max(0, pct.value)
  if (v >= 99.95) return '100'
  if (v <= 0) return '0'
  if (v >= 10) return String(Math.round(v))
  return v.toFixed(1) // 0.2% 这种小进度:保留 1 位小数,免得显示成 0%
})

/**
 * 状态 → 配色档位(系统色):
 * ⚠ 与后端四态(已完工/超产/进行中/未开始)对齐;`已完成` 布尔优先(超产也算完成),
 *   其次看「当前」与完工量,最后才落灰 —— 后端没给状态字段也能正确着色。
 */
const tone = computed(() => {
  const s = props.step || {}
  if (s['已完成']) return 'done'
  const st = String(s['状态'] || '')
  if (st.includes('完工') || st.includes('超产')) return 'done'
  if (s['当前'] || st.includes('进行')) return 'doing'
  const done = Number(s['完工量'] || 0)
  const plan = Number(s['计划量'] || 0)
  if (done > 0) return plan > 0 && done >= plan ? 'done' : 'doing'
  return 'idle'
})

/** 首帧 0 → 目标值(轻微生长过渡,不做发光/大动画) */
const mounted = ref(false)
onMounted(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => { mounted.value = true }))
})
const dashOffset = computed(() => {
  const ratio = mounted.value ? arcPct.value / 100 : 0
  return circumference.value * (1 - ratio)
})

/** 千分位只用于显示;非整数保留 2 位(报工量可能带小数) */
function fmt(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100)
}

const tipText = computed(() => {
  const s = props.step || {}
  const parts = [tt(s['工序'] || '')]
  parts.push(`${tt('完工量')} ${fmt(s['完工量'])} / ${tt('计划量')} ${fmt(s['计划量'])}`)
  if (Number(s['待审量'] || 0) > 0) parts.push(`${tt('待审')} ${fmt(s['待审量'])}`)
  if (s['已完成']) parts.push(tt('已完成'))
  else if (s['当前']) parts.push(tt('当前工序'))
  return parts.join(' · ')
})

/* ===== 检验徽标(2026-11-08 第4轮新增;接口未给「检验」时全部静默不显示) ===== */
const inspect = computed(() => {
  const ins = props.step?.['检验']
  return ins && typeof ins === 'object' ? ins : null
})
const insState = computed(() => String(inspect.value?.['状态'] || '').trim())
/** 徽标档位:待检验/待审核=橙,合格=绿,不合格=红,未开始/缺省=灰「需检」 */
const insTone = computed(() => {
  if (!inspect.value) return 'need'
  if (insState.value === '合格') return 'ok'
  if (insState.value === '不合格') return 'bad'
  if (insState.value === '待检验' || insState.value === '待审核') return 'wait'
  return 'need'
})
const insText = computed(() => {
  switch (insState.value) {
    case '合格':
      return `✓ ${tt('合格')}`
    case '不合格':
      return `✗ ${tt('不合格')}`
    case '待检验':
      return tt('待检验')
    case '待审核':
      return tt('待审核')
    default:
      return tt('需检')
  }
})
const insDocs = computed(() => {
  const docs = inspect.value?.['单据']
  return Array.isArray(docs) ? docs : []
})
/** 悬停 tooltip:检验状态 + 每张单「单号 · 类型 · 单据状态 · 结论」 */
const insTip = computed(() => {
  if (!inspect.value) return ''
  const lines = [`${tt('检验状态')}: ${insState.value ? tt(insState.value) : tt('需检')}`]
  for (const d of insDocs.value) {
    const cells = [d?.['检验单号'], tt(d?.['检验类型'] || ''), tt(d?.['单据状态'] || ''), tt(d?.['结论'] || '')]
    lines.push(cells.filter(Boolean).join(' · '))
  }
  if (!insDocs.value.length) lines.push(tt('暂无检验单'))
  return lines.join('\n')
})
</script>

<style scoped>
/* 状态色只在 CSS 里定义一份(系统色):--wpr-color 供环形 SVG 弧线用 */
.wpr {
  --wpr-color: #c0c4cc;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  user-select: none;
}
.wpr.st-done {
  --wpr-color: #67c23a;
}
.wpr.st-doing {
  --wpr-color: #409eff;
}

.wpr-name {
  max-width: 100%;
  overflow: hidden;
  color: #606266;
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wpr.is-current .wpr-name {
  color: #409eff;
  font-weight: 600;
}

.wpr-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wpr-ring svg {
  display: block;
  overflow: visible;
}
.wpr-track {
  stroke: #ebeef5;
}
.wpr-cur-bg {
  fill: #ecf5ff;
}
.wpr-cur-ring {
  stroke: #409eff;
  stroke-opacity: 0.45;
}
/* 进度弧线用系统色;仅保留轻量过渡,不发光 */
.wpr-arc {
  stroke: var(--wpr-color);
  transition: stroke-dashoffset 0.6s ease;
}

.wpr-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #303133;
}
.wpr-center b {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.wpr-center i {
  margin-left: 1px;
  color: #909399;
  font-size: 10px;
  font-style: normal;
}
.wpr.st-idle .wpr-center b {
  color: #909399;
}
.wpr.st-done .wpr-center b {
  color: #529b2e;
}

.wpr-nums {
  color: #909399;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
}
.wpr-nums b {
  color: #606266;
  font-weight: 600;
}
.wpr-nums em {
  color: #909399;
  font-style: normal;
}
.wpr-nums i {
  margin: 0 1px;
  color: #c0c4cc;
  font-style: normal;
}
.wpr.st-done .wpr-nums b {
  color: #529b2e;
}
.wpr.st-idle .wpr-nums b {
  color: #909399;
}

/* 检验徽标(环下):系统色 —— 待检验/待审核橙 · 合格绿 · 不合格红 · 未开始灰「需检」 */
.wpr-ins {
  max-width: 100%;
  margin-top: 1px;
  overflow: hidden;
  padding: 0 5px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wpr-ins.ins-wait {
  background: #fdf6ec;
  color: #b88230;
}
.wpr-ins.ins-ok {
  background: #f0f9eb;
  color: #529b2e;
}
.wpr-ins.ins-bad {
  background: #fef0f0;
  color: #f56c6c;
}
.wpr-ins.ins-need {
  background: #f4f4f5;
  color: #909399;
}

@media (prefers-reduced-motion: reduce) {
  .wpr-arc {
    transition: none;
  }
}
</style>
