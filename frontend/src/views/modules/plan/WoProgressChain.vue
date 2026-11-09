<!--
  WoProgressChain.vue — 列表视图「生产进度」列的工序圆点链(2026-11-08)

  纯展示组件:吃一行数据的「工序步骤」数组(后端已按该行工艺路线给全 3~4 道),
  渲染成 小圆点 → 连接线 → 下一圆点 的紧凑链,圆点下小字=工序名。
  配色用系统色(与现有 Element Plus 页面一致):绿 #67c23a=已完成 / 蓝 #409eff=进行中 /
  灰 #c0c4cc=未开始;当前工序只有静态浅蓝光圈(无呼吸/发光动画,用户口径「轻微 hover 高亮即可」)。

  tooltip 显示「工序 · 完工量/计划量(· 待审)(· 状态)」——列宽有限时看数字不必展开明细。
  工序名是数据键(中文原文),显示层一律 tt()。状态判定与 WoProgressRing.vue 同口径。
-->
<template>
  <div class="wpc">
    <span v-if="!steps.length" class="wpc-empty">-</span>
    <template v-else>
      <div v-for="(s, i) in steps" :key="i" class="wpc-step"
           :class="['st-' + toneOf(s), { 'is-current': s['当前'] }]">
        <el-tooltip :content="tipOf(s)" placement="top" :show-after="120">
          <span class="wpc-dot">
            <el-icon v-if="toneOf(s) === 'done'" class="wpc-check"><Check /></el-icon>
            <i v-else-if="toneOf(s) === 'doing'" class="wpc-core"></i>
            <!-- 检验标记(2026-11-08 第4轮):应检工序点右上角小圆点,状态色与看板环下徽标同口径 -->
            <i v-if="insOf(s)" class="wpc-ins" :class="'ins-' + insToneOf(s)"></i>
          </span>
        </el-tooltip>
        <!-- 连接线画在「本圆点中心 → 下一圆点中心」之间(绝对定位,不占布局宽度) -->
        <i v-if="i < steps.length - 1" class="wpc-link" aria-hidden="true">
          <span class="wpc-line"></span><span class="wpc-arrow"></span>
        </i>
        <span class="wpc-name" :title="tt(s['工序'] || '')">{{ tt(s['工序'] || '') }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { Check } from '@element-plus/icons-vue'
import { tt } from '@/i18n'

defineOptions({ name: 'WoProgressChain' })

const props = defineProps({
  /** 工序步骤数组(接口契约「工序步骤」) */
  steps: { type: Array, default: () => [] },
})

/** 状态档位(与 WoProgressRing.tone 同口径:已完成 布尔优先,其次状态字面量/当前/完工量) */
function toneOf(s) {
  if (!s) return 'idle'
  if (s['已完成']) return 'done'
  const st = String(s['状态'] || '')
  if (st.includes('完工') || st.includes('超产')) return 'done'
  if (s['当前'] || st.includes('进行')) return 'doing'
  const done = Number(s['完工量'] || 0)
  const plan = Number(s['计划量'] || 0)
  if (done > 0) return plan > 0 && done >= plan ? 'done' : 'doing'
  return 'idle'
}

function fmt(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100)
}

/** 工序的检验信息(接口未给「检验」时返回 null,界面静默不加标记) */
function insOf(s) {
  const ins = s?.['检验']
  return ins && typeof ins === 'object' ? ins : null
}
function insToneOf(s) {
  const st = String(insOf(s)?.['状态'] || '').trim()
  if (st === '合格') return 'ok'
  if (st === '不合格') return 'bad'
  if (st === '待检验' || st === '待审核') return 'wait'
  return 'need'
}

/** tooltip:工序 · 完工量/计划量(· 待审)(· 状态)(· 检验状态) */
function tipOf(s) {
  const parts = [tt(s?.['工序'] || '')]
  parts.push(`${tt('完工量')} ${fmt(s?.['完工量'])} / ${tt('计划量')} ${fmt(s?.['计划量'])}`)
  if (Number(s?.['待审量'] || 0) > 0) parts.push(`${tt('待审')} ${fmt(s['待审量'])}`)
  const tone = toneOf(s)
  parts.push(tone === 'done' ? tt('已完成') : tone === 'doing' ? tt('进行中') : tt('未开始'))
  const ins = insOf(s)
  if (ins) {
    const state = String(ins['状态'] || '').trim()
    const docs = Array.isArray(ins['单据']) ? ins['单据'] : []
    const firstNo = docs[0]?.['检验单号']
    parts.push(`${tt('检验状态')}: ${tt(state || '需检')}${firstNo ? ' · ' + firstNo : ''}`)
  }
  return parts.join(' · ')
}
</script>

<style scoped>
.wpc {
  display: flex;
  align-items: flex-start;
  padding: 1px 18px 2px 2px;
  overflow: hidden;
}
.wpc-empty {
  color: #c0c4cc;
  font-size: 12px;
  line-height: 22px;
}

/* 每个工序固定 72px:圆点在格中心,连接线从中心贯通到下一格中心 */
.wpc-step {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  width: 72px;
  min-width: 0;
}
.wpc-dot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  border-radius: 50%;
  background: #c0c4cc;
  box-shadow: 0 0 0 2px #fff;
  color: #fff;
}
.wpc-check {
  font-size: 9px;
}
.wpc-core {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff;
}
/* 检验标记:应检工序圆点右上角小圆点(待检验/待审核橙、合格绿、不合格红、需检灰) */
.wpc-ins {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1px solid #fff;
  background: #c0c4cc;
}
.wpc-ins.ins-wait {
  background: #e6a23c;
}
.wpc-ins.ins-ok {
  background: #67c23a;
}
.wpc-ins.ins-bad {
  background: #f56c6c;
}
.wpc-ins.ins-need {
  background: #c0c4cc;
}

.wpc-link {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 72px;
  height: 2px;
  color: #e4e7ed;
}
.wpc-line {
  position: absolute;
  inset: 0;
  border-radius: 1px;
  background: currentColor;
}
.wpc-arrow {
  position: absolute;
  top: -3px;
  right: -2px;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid currentColor;
}

.st-done .wpc-dot {
  background: #67c23a;
}
.st-done .wpc-link {
  color: #b3e19d;
}
.st-doing .wpc-dot {
  background: #409eff;
}
.st-doing .wpc-link {
  color: #a0cfff;
}
.st-idle .wpc-dot {
  background: #c0c4cc;
}
.st-idle .wpc-link {
  color: #e4e7ed;
}

/* 当前工序:静态浅蓝光圈(不要呼吸动画) */
.is-current .wpc-dot {
  box-shadow: 0 0 0 2px #fff, 0 0 0 5px rgba(64, 158, 255, 0.16);
}

.wpc-name {
  max-width: 68px;
  margin-top: 5px;
  overflow: hidden;
  color: #909399;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-done .wpc-name {
  color: #529b2e;
}
.st-doing .wpc-name {
  color: #337ecc;
}
.is-current .wpc-name {
  font-weight: 700;
}
</style>
