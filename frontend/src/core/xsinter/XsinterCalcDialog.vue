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

  【设计添加量的单位】2026-10-30 用户口径「没有默认百分比%，填数字会超过1，计算异常」
    · 粉料1~5 / 胶粉1~2 = **比例**：填 45 或 45% 都按 45% 解释（→ 0.45），填 0.45 也是 45%；
    · 颗粒料1~3      = **克数**：填 2 就是 2 克（Excel E16:E18 直接进单支总重，不是比例）。
    换算全在 core/xsinter/designUnits.js（复用烧结工艺清单的 parseRatio 口径）——
    同一袋料在两张单上必须得出同一个比例，所以不另写第二套解释。
    落库的「设计添加量 / 添加比例」是**百分数**（45），与纸面「添加比例%」同单位。
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
    <!-- ⚠ 表头必须显示（2026-10-30 用户口径「不太清楚每个代表什么，麻烦按我那个标识清楚」）：
         原先写了 :show-header="false"，5 个格子的标签（炭棒外径/内径/出货长度/模具出料口/中心杆）
         全被藏起来，界面上只剩 5 个空输入框，没人知道该填哪个。单位一并写进表头。 -->
    <el-table :data="[1]" border size="small" class="xc-grid">
      <el-table-column :label="tt('参数')" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('炭棒规格') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒外径 mm')">
        <template #default><el-input v-model="form.rodOuter" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒内径 mm')">
        <template #default><el-input v-model="form.rodInner" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒出货长度 mm')">
        <template #default><el-input v-model="form.shipLength" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('模具出料口内径 mm')">
        <template #default><el-input v-model="form.dieOutlet" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('中心杆外径 mm')">
        <template #default><el-input v-model="form.rodDiameter" size="small" /></template>
      </el-table-column>
    </el-table>
    <el-table :data="[1]" border size="small" class="xc-grid xc-grid-gap">
      <el-table-column :label="tt('参数')" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('计算参数') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('颗粒物料折算系数')">
        <template #default><el-input v-model="form.granuleFactor" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('成型修正长度参数 mm')">
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
          <!-- 按**本行料位**预筛档案类别（粉料=炭粉+功能料-粉末 / 胶粉=胶粉 / 颗粒料=功能料-颗粒），
               见 core/xsinter/materialKindMap.js。认不出料位时退回可手填。
               ⚠ allow-create：实测档案里存在「所属类别」为空或写成「原材料」的物料
                 （BK1-D/10、YJ-YKRS-014 都这样），它们进不了任何按类别收窄的候选。
                 没有这条，用户会觉得"档案里明明有却选不到"。手打编号照常参与计算。 -->
          <el-select
            v-if="rowHasKindFilter(row.kind)"
            v-model="row.code"
            size="small"
            filterable
            clearable
            allow-create
            default-first-option
            :loading="row.loading"
            :title="optionHint(row)"
            :placeholder="row.loading ? tt('加载中…') : tt('选择或直接输入编号')"
            @focus="loadRowOptions(row)"
            @change="() => onPickMaterial(row)"
          >
            <!-- 选中后**只回显编号**（2026-10-30 用户口径「下拉的时候能够看到名字，但是选择填写进去的时候
                 就显示编号就行了，因为后面已经有名称了，重复了」）：
                 右边紧邻的就是「物料名称」列，两格都带名字等于同一行写两遍，还把编号挤成省略号。
                 下拉里仍然是「编号 + 名称」两段（见下面 el-option）：搜编号、搜名字都能命中。 -->
            <template #label="{ value }">{{ value }}</template>
            <el-option v-for="o in row.options" :key="o.value" :label="o.label" :value="o.value">
              <span class="xc-opt">
                <span class="xc-opt-code">{{ o.value }}</span>
                <span v-if="o.name" class="xc-opt-name">{{ o.name }}</span>
              </span>
            </el-option>
          </el-select>
          <el-input v-else v-model="row.code" size="small" :placeholder="tt('手填物料编号')" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('物料名称')" min-width="200">
        <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
      </el-table-column>
      <el-table-column :label="tt('设计添加量')" width="130">
        <template #default="{ row, $index }">
          <!-- 粉料1 是倒推值（Excel E9 = 1 − Σ其他），不可手填。
               单位必须**写在格子里**（2026-10-30 用户口径「没有默认百分比%，填数字会超过1」）：
               粉料/胶粉 = %，颗粒料 = 克 —— 同一列两种单位，只在表头写会误导其中一种。
               单位换算见 core/xsinter/designUnits.js（'45' 与 '45%' 都是 45%）。 -->
          <el-input
            v-model="row.design"
            size="small"
            :disabled="$index === 0"
            :placeholder="$index === 0 ? tt('自动倒推') : ''"
          >
            <template #suffix>
              <span class="xc-unit">{{ isGramRow(row.kind) ? 'g' : '%' }}</span>
            </template>
          </el-input>
        </template>
      </el-table-column>
      <el-table-column :label="tt('添加比例%')" width="120" align="right">
        <template #default="{ row, $index }">
          <!-- 粉料/胶粉给百分数（0.45 → 45）；颗粒料没有比例，按克数显示并带 g -->
          <span class="xc-out">{{ ratioText(row.kind, $index === 0 ? calc.rows[0]?.actual : calc.rows[$index]?.actual) }}</span>
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
    <el-table :data="[1]" border size="small" class="xc-grid">
      <el-table-column :label="tt('项目')" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('切割长度') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒体积 cm³')">
        <template #default><span class="xc-out">{{ fmt(calc.volume) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('切割长度中间值 mm')">
        <template #default><span class="xc-out">{{ fmt(calc.cut.mid) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('折算物料重量 g')">
        <template #default><span class="xc-out">{{ fmt(calc.convWeight) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('单支总重 g')">
        <template #default><span class="xc-out xc-strong">{{ fmt(calc.totalWeight) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('比例合计')">
        <template #default><span class="xc-out">{{ fmt(calc.totalRatio) }}</span></template>
      </el-table-column>
    </el-table>
    <el-table :data="[1]" border size="small" class="xc-grid xc-grid-gap">
      <el-table-column :label="tt('项目')" width="96" align="center">
        <template #default><span class="xc-lab">{{ tt('成型管控要求') }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('成型切炭长度 mm（下限/中间值/上限）')">
        <template #default><span class="xc-out">{{ fmt(calc.cut.low) }} / {{ fmt(calc.cut.mid) }} / {{ fmt(calc.cut.high) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('成型冷却长度 mm（下限/中间值/上限）')">
        <template #default><span class="xc-out">{{ fmt(calc.cool.low) }} / {{ fmt(calc.cool.mid) }} / {{ fmt(calc.cool.high) }}</span></template>
      </el-table-column>
      <el-table-column :label="tt('炭棒重量 g（下限/中间值/上限）')">
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
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { tt } from '@/i18n'
import request from '@/core/request'
import { invRowsOf } from '@/core/panel/invCarry'
import { computeXsinter, problemsOf, ROW_KINDS } from './calcEngine.js'
import { engineDesignsOf, isGramRow, percentOf } from './designUnits.js'
import { kindsOfXsinterRow, rowHasKindFilter } from './materialKindMap.js'
import { xsinterMaterialOptions } from './materialOptions.js'

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
  // ⚠ 喂给引擎的必须是**比例**：粉料/胶粉那 7 行把"人手填的 45"解释成 0.45，
  //   颗粒料那 3 行保留克数（见 core/xsinter/designUnits.js）
  designs: engineDesignsOf(lines.value),
}))
const calc = computed(() => computeXsinter(input.value))
const probs = computed(() => problemsOf(input.value))

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return String(Math.round(n * 1e6) / 1e6)
}

/** 「添加比例%」格：比例行给百分数，颗粒料行给克数（它没有比例） */
function ratioText(kind, actual) {
  if (isGramRow(kind)) return `${fmt(actual)} g`
  return fmt(percentOf(actual))
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
      // 候选列表：optionsLoaded 与 options 分开记 —— 空类别也是"加载过"，否则每次聚焦都重拉一遍
      options: [], optionsLoaded: false, matched: 0, loading: false,
    }
  })
  // 预热物料候选。必须放到下一个 tick：本 watch 是 immediate，此刻下面那些
  // `const invKindRows / kindPending` 还没初始化（TDZ），同步调 ensureKindRows 会直接 ReferenceError。
  nextTick(prefetchRowOptions)
}, { immediate: true })

// ── 按料位预筛商品档案（物料编号下拉）────────────────────────────────────
// 与成型工艺清单的配方计算器同一套后端接口与判据（RecipeCalcDialog.ensureKindRows）：
//   POST /px/queryFormDataList { panelCode:'INV', condition:{ 所属类别: k } }
// ⚠ 服务端 LIKE %值% 只当收窄，**判据是本地 trim 全等**（实测 condition 传 M-001 会带回 YJ-HSM-001）。
const invKindRows = ref({})        // { 类别: 档案行[] } —— 同类别只拉一次
const kindPending = new Map()      // 并发去重：同一类别正在拉时不重复发请求

async function ensureKindRows(kind) {
  const k = String(kind ?? '').trim()
  if (!k) return []
  if (invKindRows.value[k]) return invKindRows.value[k]
  if (kindPending.has(k)) return kindPending.get(k)
  const p = (async () => {
    try {
      // ⚠ 走 `/px/invOptions` 而不是 `/px/queryFormDataList(panelCode='INV')`：
      //   后者按 **INV（商品档案）面板自己的权限**校验，而「文件负责人」「研发审核」这类研发角色
      //   对 INV 没有任何授权 ⇒ 403 ⇒ 下拉全空（2026-10-30 用户报障：刘磊这两个计算器都不能引用物料，
      //   管理员正常）。专用端点按**本面板**（RD_X_SINTER）的查看权校验，语义 = 能看这张单就能选物料。
      const res = await request.get('/px/invOptions', {
        params: { panelCode: 'RD_X_SINTER', kind: k },
      })
      const rows = invRowsOf(res?.data).filter((r) => String(r?.['所属类别'] ?? '').trim() === k)
      invKindRows.value = { ...invKindRows.value, [k]: rows }
      return rows
    } catch {
      // 无权限/接口异常 ⇒ 该行下拉为空但**不影响计算**（物料编号是录入便利，不是计算输入）
      return []
    } finally { kindPending.delete(k) }
  })()
  kindPending.set(k, p)
  return p
}

/** 该行的下拉候选：按料位合并多个类别（粉料 = 炭粉 + 功能料-粉末）。
 *  去重/排序/封顶/命中数在 core/xsinter/materialOptions.js（纯函数，有单测）：
 *  生产档案几千行，一次全渲成 el-option 会让下拉打开时卡住。 */
async function loadRowOptions(row) {
  if (!rowHasKindFilter(row.kind)) return
  if (row.optionsLoaded) return          // 加载过（哪怕是空类别）就不重复拉
  row.loading = true
  try {
    const all = []
    for (const k of kindsOfXsinterRow(row.kind)) all.push(...(await ensureKindRows(k)))
    const { options, matched } = xsinterMaterialOptions(all)
    row.options = options
    row.matched = matched
    row.optionsLoaded = true
  } finally {
    row.loading = false
  }
}

/** 候选被上限截断时挂在下拉上的提示（200 条以内基本不触发；档案变大时才用得上） */
function optionHint(row) {
  const matched = Number(row.matched || 0)
  const shown = (row.options || []).length
  if (!matched || matched <= shown) return ''
  return tt('共 {n} 条命中，继续输入可缩小范围').replace('{n}', String(matched))
}

/**
 * 打开弹窗就**预先把这几个类别拉一次**（料位前缀只有 粉料 / 胶粉 / 颗粒料 三组）。
 * 原来只在 `@focus` 时才拉 ⇒ 第一次点开物料编号下拉是空的、直接打字也没有候选，
 * 非要等一次往返才出现（2026-10-30 用户口径「这两个的物料的筛选效果要优化好」）。
 * 失败不拦：ensureKindRows 自己吞异常，下拉退回"可手填"。
 */
function prefetchRowOptions() {
  const kinds = new Set()
  for (const row of lines.value) for (const k of kindsOfXsinterRow(row.kind)) kinds.add(k)
  for (const k of kinds) ensureKindRows(k).catch(() => {})
}

/** 选中/手打编号 → 带出名称。
 *  ⚠ 2026-10-30 用户口径：「更换重新选编号之后需要清空后面文本内容重新填充」——
 *    原实现"名称已填就不覆盖"会让**上一袋料的名字**留在这一行（实测编号=黑卡戴银炭粉、
 *    名称却还是英克瑞斯碳洗200-500目），编号与名称对不上比空着更糟。
 *    现在编号一变就**整格重填**：先清空，再从候选/档案取新名称；取不到就留空（名称可手填）。 */
async function onPickMaterial(row) {
  const code = String(row.code ?? '').trim()
  if (!code) { row.name = ''; return }
  const hit = (row.options || []).find((o) => o.value === code)
  if (hit) { row.name = hit.name || ''; return }
  // allow-create 手打的编号不在候选里 ⇒ 先清空再回档案查一次
  row.name = ''
  try {
    const res = await request.get('/px/invOptions', {
      params: { panelCode: 'RD_X_SINTER', keyword: code },
    })
    const one = invRowsOf(res?.data).find((r) => String(r?.['存货编码'] ?? '').trim() === code)
    if (one) row.name = String(one['存货名称'] ?? '').trim()
  } catch { /* 档案查不到就留空，名称可手填，不阻断计算 */ }
}

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
  const detail = lines.value.map((r, i) => {
    const gram = isGramRow(r.kind)
    const design = c.rows[i]?.design
    const actual = c.rows[i]?.actual
    return {
      序号: String(i + 1),
      物料种类: r.kind,
      物料编号: r.code || '',
      物料名称: r.name || '',
      // 落**百分数**而不是比例：纸面「添加比例%」那列直接印数字（45 而不是 0.45），
      // 重新打开计算器读回来也还是同一个值（'45' → 0.45 的容错在 designUnits）。
      设计添加量: fmt(gram ? design : percentOf(design)),
      添加比例: fmt(gram ? actual : percentOf(actual)),
      '单支含量g': fmt(c.rows[i]?.perPiece),
    }
  })
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
/* 物料下拉的一行：编号左对齐等宽当"锚"，名称退成次要色 —— 一列扫下去是编号对齐，而不是一坨长句。
   scoped 样式对 el-option 的插槽内容照样生效（元素是这个组件渲染的，作用域属性跟着 vnode 走）。 */
.xc-opt { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.xc-opt-code { flex: none; font-variant-numeric: tabular-nums; }
.xc-opt-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #a3a9b3; }
.xc-out { font-variant-numeric: tabular-nums; color: #303133; font-size: 12px; }
.xc-unit { color: #909399; font-size: 12px; }
.xc-strong { font-weight: 700; color: #0d5bd3; }
.xc-lines :deep(.el-table__cell) { padding: 2px 0; }
.xc-warn { margin-top: 10px; }
</style>
