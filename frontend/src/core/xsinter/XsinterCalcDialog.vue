<!--
  XsinterCalcDialog.vue —— X烧结工艺清单 · 配方计算器  2026-10-30

  【用户口径】
    「计算器按文档中第一张表的内容，有公式的位置我都框起来了。白色填充是必要输入参数」
    「计算器输出填入的打印模板在第二个表。另外两个表是模具信息 和物料信息」
    ⇒ 输入 = 炭棒规格 + 模具 + 折算系数 + 密度上下限 + 10 行物料的设计添加量；
      输出 = 纸面「成型管控要求」五段 + 配方表 10 行。

  【算在哪】全部在 core/xsinter/calcEngine.js（纯函数 + 14 条单测，基准是真实单据
    T205-X冰箱炭棒-26102901.xlsx 的缓存值）。本组件只做「输入收集 → 显示 → 填入」，
    **不写任何公式** —— 公式散在模板里就没人测得住。

  【为什么不落库输入参数】
    与既有配方计算器同口径：设计添加量/比例/含量这类**结果**落明细表（历史单据要能追），
    折算系数/修正长度/密度上下限这类**参数**落单头（重算/复核要用）；
    一次性试算的中间量（体积、折算重量）只在弹窗里显示，不落库。

  【物料编号】
    与烧结工艺清单同一套：可手填，也可用「商品档案」下拉远程搜（invSearchOptions，按编号/名称）。
    名称随编号自动带出（带不出就保留用户手填值，不覆盖）。
-->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('X烧结配方计算')"
    width="1120px"
    top="4vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <!-- ── 输入参数 ── -->
    <div class="xc-sec">{{ tt('一、输入参数') }}</div>
    <el-table :data="[1]" :show-header="false" border size="small" class="xc-grid">
      <el-table-column label="" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('炭棒规格') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒外径')">
        <template #default><el-input v-model="form.rodOuter" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒内径')">
        <template #default><el-input v-model="form.rodInner" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒出货长度')">
        <template #default><el-input v-model="form.shipLength" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('模具出料口内径')">
        <template #default><el-input v-model="form.dieOutlet" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('中心杆外径')">
        <template #default><el-input v-model="form.rodDiameter" size="small" /></template>
      </el-table-column>
    </el-table>
    <el-table :data="[1]" :show-header="false" border size="small" class="xc-grid xc-grid-gap">
      <el-table-column label="" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('计算参数') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('颗粒物料折算系数')">
        <template #default><el-input v-model="form.granuleFactor" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('成型修正长度参数mm')">
        <template #default><el-input v-model="form.lengthFix" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('密度参数下限')">
        <template #default><el-input v-model="form.densLow" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('密度参数上限')">
        <template #default><el-input v-model="form.densHigh" size="small" /></template>
      </el-table-column>
    </el-table>

    <!-- ── 物料录入 ── -->
    <div class="xc-sec">{{ tt('二、物料信息录入') }}</div>
    <el-table :data="lines" border size="small" class="xc-lines">
      <el-table-column :label="tt('No.')" width="56" align="center">
        <template #default="{ $index }">{{ $index + 1 }}</template>
      </el-table-column>
      <el-table-column :label="tt('物料种类')" width="110">
        <template #default="{ row }"><span class="xc-kind">{{ tt(row.kind) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('物料编号')" min-width="170">
        <template #default="{ row }">
          <el-input v-model="row.code" size="small" :placeholder="tt('手填物料编号')" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('物料名称')" min-width="200">
        <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('设计添加量')" width="130">
        <template #default="{ row, $index }">
          <!-- 粉料1 是倒推值（Excel E9 = 1 − Σ其他），不可手填 -->
          <el-input
            v-model="row.design"
            size="small"
            :disabled="$index === 0"
            :placeholder="$index === 0 ? tt('自动倒推') : ''"
          />
        </template>
      </el-table-column>
      <el-table-column :label="tt('添加比例%')" width="120" align="right">
        <template #default="{ row, $index }">
          <span class="xc-out">{{ fmt($index === 0 ? calc.rows[0]?.actual : calc.rows[$index]?.actual) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('单支含量g')" width="130" align="right">
        <template #default="{ row, $index }">
          <span class="xc-out">{{ fmt(calc.rows[$index]?.perPiece) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- ── 计算结果 ── -->
    <div class="xc-sec">{{ tt('三、计算结果') }}</div>
    <el-table :data="[1]" :show-header="false" border size="small" class="xc-grid">
      <el-table-column label="" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('切割长度') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒体积cm3')">
        <template #default><span class="xc-out">{{ fmt(calc.volume) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('切割长度中间值mm')">
        <template #default><span class="xc-out">{{ fmt(calc.cut.mid) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('折算物料重量g')">
        <template #default><span class="xc-out">{{ fmt(calc.convWeight) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('单支总重g')">
        <template #default><span class="xc-out xc-strong">{{ fmt(calc.totalWeight) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('比例合计')">
        <template #default><span class="xc-out">{{ fmt(calc.totalRatio) }}</span></template>
      </el-table-column>
    </el-table>
    <el-table :data="[1]" :show-header="false" border size="small" class="xc-grid xc-grid-gap">
      <el-table-column label="" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('成型管控要求') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('成型切炭长度')">
        <template #default><span class="xc-out">{{ fmt(calc.cut.low) }} / {{ fmt(calc.cut.mid) }} / {{ fmt(calc.cut.high) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('成型冷却长度')">
        <template #default><span class="xc-out">{{ fmt(calc.cool.low) }} / {{ fmt(calc.cool.mid) }} / {{ fmt(calc.cool.high) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒重量g')">
        <template #default><span class="xc-out">{{ fmt(calc.weight.low) }} / {{ fmt(calc.weight.mid) }} / {{ fmt(calc.weight.high) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('密度要求')">
        <template #default><span class="xc-out">{{ fmt(calc.density.low) }} / {{ fmt(calc.density.mid) }} / {{ fmt(calc.density.high) }}</span></template>
      </el-table-column>
    </el-table>

    <el-alert v-if="probs.length" type="warning" :closable="false" show-icon class="xc-warn">
      <template #title>{{ tt('还不能计算，请先补全：') }}{{ probs.join('；') }}</template>
    </el-alert>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="probs.length > 0" @click="apply">{{ tt('填入单据') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { tt } from '@/i18n'
import { computeXsinter, problemsOf, ROW_KINDS } from './calcEngine.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 当前单据头（打开时把已有的参数/规格带进来，用户可改） */
  head: { type: Object, default: () => ({}) },
  /** 当前配方表已有行（打开时带进来接着编） */
  rows: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'applied'])

const INPUT_KEYS = [
  'rodOuter', 'rodInner', 'shipLength', 'dieOutlet', 'rodDiameter',
  'granuleFactor', 'lengthFix', 'densLow', 'densHigh',
]
/** 表单键 → 单据头的字段 label（顺序即回填顺序） */
const HEAD_MAP = {
  rodOuter: '炭棒外径', rodInner: '炭棒内径', shipLength: '炭棒出货长度',
  dieOutlet: '模具出料口内径', rodDiameter: '中心杆外径',
  granuleFactor: '颗粒物料折算系数', lengthFix: '成型修正长度参数mm',
  densLow: '密度参数下限', densHigh: '密度参数上限',
}
const DEFAULTS = { granuleFactor: '0.65', lengthFix: '0.5', densLow: '0.55', densHigh: '0.64' }

const form = reactive({
  rodOuter: '', rodInner: '', shipLength: '', dieOutlet: '', rodDiameter: '',
  granuleFactor: DEFAULTS.granuleFactor, lengthFix: DEFAULTS.lengthFix,
  densLow: DEFAULTS.densLow, densHigh: DEFAULTS.densHigh,
})

const lines = ref(ROW_KINDS.map((kind) => ({ kind, code: '', name: '', design: '', options: [], loading: false })))

const input = computed(() => ({
  rodOuter: form.rodOuter, rodInner: form.rodInner, shipLength: form.shipLength,
  dieOutlet: form.dieOutlet, rodDiameter: form.rodDiameter,
  granuleFactor: form.granuleFactor, lengthFix: form.lengthFix,
  densLow: form.densLow, densHigh: form.densHigh,
  designs: lines.value.map((r) => r.design),
}))
const calc = computed(() => computeXsinter(input.value))
const probs = computed(() => problemsOf(input.value))

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return String(Math.round(n * 1e6) / 1e6)
}

/** 打开时把单据头/已有行带进来（每次打开都重算，避免残留上一次的试算） */
watch(() => props.modelValue, (open) => {
  if (!open) return
  const h = props.head || {}
  for (const k of INPUT_KEYS) {
    const fromHead = h[HEAD_MAP[k]]
    if (fromHead !== undefined && fromHead !== null && String(fromHead).trim() !== '') form[k] = String(fromHead)
    else if (!form[k]) form[k] = DEFAULTS[k] || ''
  }
  // 已有配方表行按「序号」对位回填；不足 10 行时保留空行
  const exist = [...(props.rows || [])].sort((a, b) => Number(a['序号'] || 0) - Number(b['序号'] || 0))
  lines.value = ROW_KINDS.map((kind, i) => {
    const r = exist[i] || {}
    return {
      kind: String(r['物料种类'] || kind),
      code: String(r['物料编号'] || ''),
      name: String(r['物料名称'] || ''),
      design: String(r['设计添加量'] ?? ''),
    }
  })
}, { immediate: true })

/** 填入单据：头 12 格 + 配方表 10 行 */
function apply() {
  if (probs.value.length) return
  const c = calc.value
  const head = {
    [HEAD_MAP.dieOutlet]: form.dieOutlet,
    [HEAD_MAP.rodDiameter]: form.rodDiameter,
    [HEAD_MAP.granuleFactor]: form.granuleFactor,
    [HEAD_MAP.lengthFix]: form.lengthFix,
    [HEAD_MAP.densLow]: form.densLow,
    [HEAD_MAP.densHigh]: form.densHigh,
    '切炭长度下限mm': fmt(c.cut.low),
    '切炭长度中间值mm': fmt(c.cut.mid),
    '切炭长度上限mm': fmt(c.cut.high),
    '冷却长度下限mm': fmt(c.cool.low),
    '冷却长度中间值mm': fmt(c.cool.mid),
    '冷却长度上限mm': fmt(c.cool.high),
    '炭棒重量下限g': fmt(c.weight.low),
    '炭棒重量中间值g': fmt(c.weight.mid),
    '炭棒重量上限g': fmt(c.weight.high),
    '密度要求下限': fmt(c.density.low),
    '密度要求中间值': fmt(c.density.mid),
    '密度要求上限': fmt(c.density.high),
  }
  const detail = lines.value.map((r, i) => ({
    序号: String(i + 1),
    物料种类: r.kind,
    物料编号: r.code || '',
    物料名称: r.name || '',
    设计添加量: fmt(c.rows[i]?.design),
    添加比例: fmt(c.rows[i]?.actual),
    '单支含量g': fmt(c.rows[i]?.perPiece),
  }))
  emit('applied', { head, detail })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.xc-sec {
  font-size: 13px; font-weight: 600; color: #303133;
  margin: 14px 0 6px;
}
.xc-sec:first-child { margin-top: 0; }
.xc-grid :deep(.el-table__cell) { padding: 3px 0; }
.xc-grid-gap { margin-top: 6px; }
.xc-lab { font-weight: 600; color: #606266; font-size: 12px; }
.xc-kind { color: #303133; font-size: 12px; }
.xc-out { font-variant-numeric: tabular-nums; color: #303133; font-size: 12px; }
.xc-strong { font-weight: 700; color: #0d5bd3; }
.xc-lines :deep(.el-table__cell) { padding: 2px 0; }
.xc-warn { margin-top: 10px; }
</style>
