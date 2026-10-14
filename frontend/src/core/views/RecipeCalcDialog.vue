<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('配方计算')"
    width="1120px"
    append-to-body
    destroy-on-close
    class="rcd-dlg"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <div class="rcd">
      <div class="rcd-note">
        {{ tt('计算口径与《炭棒工艺配方设计器》逐位一致；本弹窗的输入不保存、不打印，只有点「填入单据」写进单据的值（含上面这份物料行）才随单据保存。') }}
      </div>

      <!-- ① 工艺参数:公式固定,只有这几个系数可调;按产品编号持久化 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">① {{ tt('工艺参数') }}</span>
        <span class="rcd-muted">{{ paramScopeTip }}</span>
        <span class="rcd-act" @click="saveParams">{{ tt('存为该产品参数') }}</span>
        <span class="rcd-act" @click="loadSystemDefaults">{{ tt('恢复系统默认') }}</span>
        <span class="rcd-act" @click="openParamLib">{{ tt('参数库维护') }}</span>
      </div>
      <div class="rcd-params">
        <label v-for="f in PARAM_FIELDS" :key="f.key" class="rcd-pf">
          <span class="rcd-pf-lb">{{ tt(f.label) }}</span>
          <el-input v-model="form[f.key]" size="small" class="rcd-pf-in" @input="onDirtyInput" />
        </label>
      </div>

      <!-- ①b 烧结尺寸(模具):选了型号就用它的炭棒内外径与公差,不再手敲 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">①b {{ tt('烧结尺寸(模具)') }}</span>
        <span class="rcd-muted">{{ sinterTip }}</span>
        <span class="rcd-act" @click="openSinterTable">{{ tt('维护尺寸表') }}</span>
      </div>
      <div class="rcd-params">
        <label class="rcd-pf">
          <span class="rcd-pf-lb">{{ tt('车间') }}</span>
          <el-select v-model="sinterWorkshop" size="small" class="rcd-pf-in" clearable @change="onSinterWorkshopChange">
            <el-option v-for="w in sinterWorkshops" :key="w" :label="w" :value="w" />
          </el-select>
        </label>
        <label class="rcd-pf">
          <span class="rcd-pf-lb">{{ tt('型号') }}</span>
          <el-select v-model="sinterModel" size="small" class="rcd-pf-in" clearable filterable @change="onDirtyInput">
            <el-option v-for="r in sinterRowsInWorkshop" :key="r['型号']" :value="r['型号']"
                       :label="`${r['型号']}（${tt('炭棒')}${r['炭棒外径']}*${r['炭棒内径']}）`" />
          </el-select>
        </label>
        <div class="rcd-pf">
          <span class="rcd-pf-lb">{{ tt('带出尺寸') }}</span>
          <span class="rcd-r-v">{{ sinterSummary }}</span>
        </div>
      </div>

      <!-- ② 物料行 = 配方表的真源(2026-10-15 用户口径:配方表在弹窗里录,不由规格书带入) -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">② {{ tt('物料行') }}</span>
        <span class="rcd-muted">{{ tt('配方表的物料行在这里录。刚打开时带进来的是页 2 配方表已有的行(页 2 空就从零加);算完点「填入单据」会连这些行一起写回页 2 配方表。') }}</span>
        <span class="rcd-act" @click="addMaterialRow">{{ tt('加一行') }}</span>
        <span v-if="invTip" class="rcd-muted">{{ invTip }}</span>
      </div>
      <table class="rcd-tb">
        <thead>
          <tr>
            <th style="width:44px">No.</th>
            <th style="width:132px">{{ tt('物料种类') }}</th>
            <th style="width:150px">{{ tt('物料编号') }}</th>
            <th>{{ tt('物料名称') }}</th>
            <th style="width:110px">{{ tt('设计添加量') }}</th>
            <th style="width:104px">{{ tt('实际添加比例') }}</th>
            <th style="width:96px">{{ tt('单支物料含量') }}</th>
            <th style="width:44px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in editRows" :key="i">
            <td class="rcd-c">{{ i + 1 }}</td>
            <td>
              <el-select v-model="r['物料种类']" size="small" clearable>
                <el-option v-for="k in MATERIAL_KINDS" :key="k" :label="tt(k)" :value="k" />
              </el-select>
            </td>
            <td><el-input v-model="r['物料编号']" size="small" @change="onMaterialCodeChange(i)" /></td>
            <td><el-input v-model="r['物料名称']" size="small" /></td>
            <td><el-input v-model="r['设计添加量']" size="small" class="rcd-mini" /></td>
            <!-- 两列是算出来的(引擎输出),这里只读展示输入旁边 —— 回填预览那张表还要拿它跟旧值比 -->
            <td class="rcd-c">{{ rowCalc(i, '实际添加比例') }}</td>
            <td class="rcd-c">{{ rowCalc(i, '单支物料含量') }}</td>
            <td class="rcd-c"><span class="rcd-del" :title="tt('删除这一行')" @click="removeMaterialRow(i)">✕</span></td>
          </tr>
          <tr v-if="!editRows.length"><td colspan="8" class="rcd-muted">{{ tt('还没有物料行 —— 点上面「加一行」开始录') }}</td></tr>
        </tbody>
      </table>

      <!-- ③ 料位(按上面这份物料行分组)+ 含水率 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">③ {{ tt('料位与含水率') }}</span>
        <span class="rcd-muted">{{ tt('料位按上面物料行的物料种类分组(粉料 1~5 / 胶粉 6~7 / 折算料 8~10);料位 1 是补差位。含水率默认从物料档案(商品·水分含量)按物料编号带出,档案没有的请手填 —— 只有粉料位的含水率参与计算。') }}</span>
        <span v-if="archiveTip" class="rcd-muted">{{ archiveTip }}</span>
      </div>
      <table class="rcd-tb">
        <thead>
          <tr>
            <th style="width:52px">{{ tt('料位') }}</th>
            <th style="width:74px">{{ tt('分组') }}</th>
            <th style="width:130px">{{ tt('物料编号') }}</th>
            <th>{{ tt('物料名称') }}</th>
            <th style="width:150px">{{ tt('设计值(来自物料行)') }}</th>
            <th style="width:110px">{{ tt('含水率%') }}</th>
            <th style="width:110px">{{ tt('最终比例') }}</th>
            <th style="width:110px">{{ tt('单支克重g') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in slots" :key="i" :class="{ 'rcd-empty': s.rowIndex < 0 }">
            <td class="rcd-c">{{ s.slot }}</td>
            <td class="rcd-c">{{ tt(s.group) }}</td>
            <td>{{ s.code }}</td>
            <td>{{ s.name }}</td>
            <td class="rcd-c">{{ designText(s) }}</td>
            <td class="rcd-c">
              <el-input v-if="isPowder(s)" v-model="moisture[i]" size="small" class="rcd-mini" @input="onMoistureInput(i)" />
              <span v-else class="rcd-muted">—</span>
              <span v-if="archiveFilled.includes(s.slot)" class="rcd-src" :title="tt('来自物料档案')">{{ tt('档案') }}</span>
            </td>
            <td class="rcd-c">{{ cell(i, 'ratio') }}</td>
            <td class="rcd-c">{{ cell(i, 'amount') }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ④ 结果 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">④ {{ tt('计算结果') }}</span>
        <!-- 算不出来时最需要它:规格/型号/密度一键从产品信息与历史单带出(只填空格,不覆盖已填值) -->
        <span class="rcd-act" :class="{ 'rcd-act-off': carrying }" @click="carrySpec">{{ tt('按产品规格带出') }}</span>
        <span v-if="blockReason" class="rcd-warn">{{ blockReason }}</span>
      </div>
      <div v-if="result" class="rcd-grid">
        <div v-for="r in resultRows" :key="r.label" class="rcd-r">
          <span class="rcd-r-lb">{{ tt(r.label) }}</span>
          <span class="rcd-r-v">{{ r.value }}</span>
        </div>
      </div>
      <div v-if="visibleWarnings.length" class="rcd-warns">
        <div v-for="(w, i) in visibleWarnings" :key="i" class="rcd-warn">⚠ {{ w }}</div>
      </div>

      <!-- ⑤ 回填预览 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">⑤ {{ tt('回填预览') }}</span>
        <span class="rcd-muted">{{ tt('点「填入单据」后按下面这张表覆盖对应格(明细整表替换为上面那份物料行);未变化的格不列出。') }}</span>
      </div>
      <div v-if="patch" class="rcd-two">
        <table class="rcd-tb">
          <thead><tr><th>{{ tt('页 1 字段') }}</th><th style="width:110px">{{ tt('旧值') }}</th><th style="width:110px">{{ tt('新值') }}</th></tr></thead>
          <tbody>
            <tr v-for="d in headDiff" :key="d.key"><td>{{ d.key }}</td><td class="rcd-c rcd-old">{{ d.old || '—' }}</td><td class="rcd-c">{{ d.val }}</td></tr>
            <tr v-if="!headDiff.length"><td colspan="3" class="rcd-muted">{{ tt('页 1 无可回填的格子') }}</td></tr>
          </tbody>
        </table>
        <table class="rcd-tb">
          <thead><tr><th style="width:52px">No.</th><th>{{ tt('物料') }}</th><th style="width:110px">{{ tt('实际添加比例') }}</th><th style="width:110px">{{ tt('单支物料含量') }}</th></tr></thead>
          <tbody>
            <tr v-for="d in rowDiff" :key="d.rowIndex">
              <td class="rcd-c">{{ d.rowIndex + 1 }}</td>
              <td>{{ d.code }}</td>
              <td class="rcd-c"><span class="rcd-old">{{ d.oldRatio || '—' }}</span> → {{ d.实际添加比例 }}</td>
              <td class="rcd-c"><span class="rcd-old">{{ d.oldAmount || '—' }}</span> → {{ d.单支物料含量 }}</td>
            </tr>
            <tr v-if="!rowDiff.length"><td colspan="4" class="rcd-muted">{{ tt('没有可回填的物料行') }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 参数库维护(共用组件):条目名=产品编号,「默认」=系统默认;新增走本弹窗的「存为该产品参数」 -->
    <el-dialog v-model="paramLibVisible" :title="tt('参数库维护') + ' · ' + tt('配方计算参数')" width="820px" append-to-body>
      <div class="rcd-note">
        {{ tt('条目名 = 产品编号(「默认」那条是系统默认);按产品的条目由本弹窗的「存为该产品参数」生成,所以这里不提供新增输入行。停用只影响以后的计算带出,已录入单据的值不变。') }}
      </div>
      <StdLibManager lib="mold.calcparam" show-item :show-add="false" @changed="onParamLibChanged" />
      <template #footer>
        <el-button @click="paramLibVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <template #footer>
      <span class="rcd-foot">{{ footTip }}</span>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!patch" @click="apply">{{ tt('填入单据') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/core/request'
import { tt } from '@/i18n'
import StdLibManager from './StdLibManager.vue'
import { compute } from '@/core/mold/recipeEngine.js'
import { applyArchiveMoisture, buildPatch, densityOf, matchSinterModel, moisturePercent, NO_RECIPE_ROWS, paramsFromHead,
  slotsFromRows, specCarryFrom, sinterLengthWarning, sinterParams, sinterPatch, sinterRowsForWorkshop, sinterRowsFromQuery,
  unfilledDesignRows } from '@/core/mold/recipeSheet.js'
import { blankRecipeRow, buildRecipeRows, editRowsFrom, invFillFor } from '@/core/mold/recipeRows.js'
import { MATERIAL_KINDS } from '@/core/mold/materialKinds.js'
import { invRowsOf } from '@/core/panel/invCarry.js'
import { DEFAULT_LENGTH_TOL } from '@/core/mold/recipeConstants.js'

/**
 * 配方计算弹窗(2026-09-20)。
 *
 * 口径见 CONTEXT.md「配方计算器(Recipe Calculator)」与 docs/adr/0004:
 *   - 公式 = 与《炭棒工艺配方设计器》exe 逐位一致(core/mold/recipeEngine.js),本弹窗不做任何计算;
 *   - 输入(工艺参数/含水率)**不落库、不打印**;只有回填进单据字段的值随单据保存;
 *   - **配方表的物料行在本弹窗里录**(2026-10-15 用户口径变更:原来是"页 2 手填 + 规格书带出",
 *     现改为"配方计算器里填写数据然后填入单据");所以两道输入闸的判据是本弹窗这份行
 *     (core/mold/recipeRows.js),不再是页 2 有没有行;
 *   - 可调参数(一切几/折算比/公差/漂移)= 系统默认 + 按产品编号覆盖,落标准库 yj_std_lib
 *     (lib=mold.calcparam,条目名=产品编号,条目名"默认"为系统默认),维护界面用现成的 StdLibManager。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  head: { type: Object, required: true },
  /** 页 2 配方表**已有的行**:弹窗打开时带进来接着编(页面为空就传 [],从零加)。只读来源。 */
  rows: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'applied'])

const LIB = 'mold.calcparam'
const DEFAULT_ITEM = '默认'
const PARAM_FIELDS = [
  { key: 'cavities', label: '一切几', def: 1 },
  { key: 'conversion_ratio', label: '折算比', def: 0.5 },
  { key: 'length_tol_low', label: '成型长度公差下限mm', def: DEFAULT_LENGTH_TOL },
  { key: 'length_tol_high', label: '成型长度公差上限mm', def: DEFAULT_LENGTH_TOL },
  { key: 'demold_low_factor', label: '脱模下限漂移系数', def: 1 },
  { key: 'demold_high_factor', label: '脱模上限漂移系数', def: 1 },
]
const builtinDefaults = () => Object.fromEntries(PARAM_FIELDS.map((f) => [f.key, String(f.def)]))

const form = reactive(builtinDefaults())
const moisture = ref(Array(10).fill(''))
const moistureTouched = ref([])          // 用户手改过的料位下标(档案不许覆盖)
const archiveFilled = ref([])            // 本次由档案带出的料位号(界面上标「档案」)
const archiveTip = ref('')
const invTip = ref('')                   // 物料行里「按编号查商品档案」的结果提示
/**
 * 配方表的物料行 —— **本弹窗是配方表的真源**(2026-10-15 用户口径变更)。
 * 打开时从页 2 已有的行拷贝进来接着编(props.rows 是只读来源),页 2 空则从零加;
 * 引擎/告警/回填全部吃这份行,点「填入单据」时整表写回页 2。纯函数在 core/mold/recipeRows.js。
 */
const editRows = ref([])
const paramEntryId = ref(null)
const paramScopeTip = ref('')
const paramLibVisible = ref(false)

/* ── 烧结尺寸表(60 行模具↔炭棒内外径公差对照):选了型号 ⇒ 尺寸以表为准 + 回填页 1 检验要求四格 ── */
const sinterRows = ref([])
const sinterWorkshop = ref('')
const sinterModel = ref('')
const sinterTip = ref('')
const sinterWorkshops = computed(() => [...new Set(sinterRows.value.map((r) => String(r['车间'] ?? '').trim()).filter(Boolean))])
const sinterRowsInWorkshop = computed(() => sinterRowsForWorkshop(sinterRows.value, sinterWorkshop.value || String(props.head?.['生产车间'] ?? '')))
const sinterRow = computed(() => sinterRowsInWorkshop.value.find((r) => String(r['型号'] ?? '').trim() === sinterModel.value) || null)
const sinterSummary = computed(() => {
  const r = sinterRow.value
  if (!r) return tt('未选型号 —— 尺寸按单据上的炭棒规格')
  return `${tt('外径')} ${r['炭棒外径']} ${r['炭棒外径公差']} / ${tt('内径')} ${r['炭棒内径']} ${r['炭棒内径公差']}`
})
const sinterHint = computed(() => (sinterRow.value ? (sinterLengthWarning(sinterRow.value, props.head?.['炭棒规格3']) || '') : ''))

/** 车间默认取单据上的生产车间;表里 `1/3` 这类写法由 sinterRowsForWorkshop 按 '/' 拆开匹配 */
function onSinterWorkshopChange() { sinterModel.value = '' }

async function loadSinterRows() {
  sinterTip.value = tt('正在读取烧结尺寸表…')
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: 'RD_SINTER_TOL', condition: {}, pageNo: 1, pageSize: 500,
    })
    sinterRows.value = sinterRowsFromQuery(res)
    sinterTip.value = sinterRows.value.length
      ? `· ${tt('来自烧结尺寸表')} ${sinterRows.value.length} ${tt('个型号')}`
      : `· ${tt('尺寸表没有可用行')}`
  } catch {
    // 权限/接口异常都按"读不到"处理:退回单据上手填,不阻断计算(探测过的 403 场景)
    sinterRows.value = []
    sinterTip.value = `· ${tt('读不到烧结尺寸表（可能没有该面板权限），尺寸按单据上手填')}`
  }
}

/** 维护入口:直接开那个档案面板(它没有侧栏菜单,入口就放在用它的人手边) */
function openSinterTable() {
  const url = `${location.origin}${location.pathname}#/panelx/list/RD_SINTER_TOL`
  window.open(url, '_blank')
}

/** 参数库维护:改完(编辑/停用/恢复启用)立刻把当前产品的参数重新载入,免得界面还显示旧值 */
function openParamLib() { paramLibVisible.value = true }
async function onParamLibChanged() {
  paramEntryId.value = null
  const key = productCode.value || DEFAULT_ITEM
  try {
    const hit = await fetchParam(key)
    if (hit) applyEntry(hit)
    else if (key !== DEFAULT_ITEM) {
      const sys = await fetchParam(DEFAULT_ITEM)
      if (sys) applyEntry(sys)
      else { paramScopeTip.value = `${scopeTip()}；${tt('标准库里还没有系统默认条目，当前用内置默认值')}` }
    }
  } catch { /* 读不到就保持当前值,不打断 */ }
}

const productCode = computed(() => String(props.head?.['产品编号'] || '').trim())
const scopeTip = () => (productCode.value ? `${tt('当前产品')}：${productCode.value}` : tt('当前单据没有产品编号，参数只能按系统默认用'))
const onDirtyInput = () => { /* 输入即触发 computed 重算,这里只作为 el-input 的挂钩点 */ }
/** 含水率手感:用户改过的料位记下来,后续档案加载不再覆盖它 */
function onMoistureInput(i) {
  if (!moistureTouched.value.includes(i)) moistureTouched.value = [...moistureTouched.value, i]
}

const overrides = computed(() => {
  const base = Object.fromEntries(
    Object.entries(form).map(([k, v]) => [k, Number(String(v).trim())]).filter(([, v]) => Number.isFinite(v)))
  // 选了烧结尺寸 ⇒ 外径/内径以表为准(engine 入参用 od/id 覆盖,单据上的炭棒规格退居兜底)
  if (sinterRow.value) {
    const sp = sinterParams(sinterRow.value)
    if (sp.od !== null) base.od = sp.od
    if (sp.id !== null) base.id = sp.id
  }
  return base
})

const slots = computed(() => slotsFromRows(editRows.value).slots
  // 弹窗输入是百分数(exe 前端同款),引擎吃小数 —— 换算在 recipeSheet.moisturePercent 里,有单测
  .map((s, i) => ({ ...s, moisture: moisturePercent(moisture.value[i]) })))

const parsed = computed(() => {
  // 第三参 = **弹窗里这份物料行**:一行物料都没有时 paramsFromHead 给出阻断项(见 NO_RECIPE_ROWS)。
  // ⚠ 口径变更(2026-10-15):判据不再是页 2 有没有行 —— 行就是在弹窗里录的。
  const { params, missing } = paramsFromHead(props.head, overrides.value, editRows.value)
  if (missing.length) return { missing }
  try {
    return { params, result: compute(params, slots.value.map((s) => ({ design_ratio: s.designRatio, amount_g: s.amountG, moisture: s.moisture }))) }
  } catch (e) {
    return { error: e.message }
  }
})
const result = computed(() => parsed.value.result || null)
const blockReason = computed(() => {
  // 弹窗里一行物料都没有(文案得对症:「请先在页 1 填好…」对物料行说不通)
  if (parsed.value.missing?.includes(NO_RECIPE_ROWS)) {
    return tt('还没有物料行 —— 请在下面「② 物料行」里加上至少 1 行（填物料种类 + 物料编号），再回来算')
  }
  if (parsed.value.missing?.length) return `${tt('单据上还缺')}：${parsed.value.missing.join('、')}${tt('（请先在页 1 填好，或补齐密度管控范围）')}`
  if (parsed.value.error) return parsed.value.error
  return ''
})
const patch = computed(() => (result.value
  ? buildPatch(result.value, slots.value, sinterRow.value ? sinterPatch(sinterRow.value) : null)
  : null))
/** 配方表自己的问题:分组/容量告警 + 「设计添加量」没填(会被静默按 0 算,最需要点名的一条) */
const rowWarnings = computed(() => {
  const list = [...slotsFromRows(editRows.value).warnings]
  const unfilled = unfilledDesignRows(editRows.value, slots.value)
  if (unfilled.length) {
    // 空着 = 引擎按 0 算;料位 1 是补差位会把差额吃下来 ⇒ 两行全空也照样"出结果",这条告警就是拦这个。
    list.push(tt('有 {n} 行的「设计添加量」为空或不是数字（第 {rows} 行），这些行会被按 0 参与计算；不用的料请填 0，不要留空')
      .replace('{n}', unfilled.length).replace('{rows}', unfilled.join('、')))
  }
  return list
})
/** 空料位不必报"水分未采集"(那不是问题,是没这个料位) */
const visibleWarnings = computed(() => {
  const emptySlots = slots.value.filter((s) => s.rowIndex < 0).map((s) => s.slot)
  const engineWarnings = (result.value?.warnings || []).filter((w) => !emptySlots.some((n) => w.startsWith(`料位 ${n} `)))
  return [...rowWarnings.value, ...engineWarnings]
})

const fixed = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : '—')
const isPowder = (s) => s.group === '粉料'
const designText = (s) => {
  if (s.rowIndex < 0) return '—'
  if (s.group === '折算料') return `${fixed(s.amountG, 2)} g/支`
  const base = `${fixed((s.designRatio || 0) * 100, 2)}%`
  return s.derived ? `${tt('补差')} ${base}` : base
}
const cell = (i, kind) => {
  if (!result.value) return '—'
  const v = kind === 'ratio' ? result.value.final_ratios[i] * 100 : result.value.final_amounts[i]
  return kind === 'ratio' ? `${fixed(v, 2)}%` : fixed(v, 2)
}
const resultRows = computed(() => {
  if (!result.value) return []
  const r = result.value
  return [
    { label: '理论最低灌料重量g', value: fixed(r.pour_weights.low, 1) },
    { label: '理论灌料中间值g', value: fixed(r.pour_weights.std, 1) },
    { label: '理论最高灌料重量g', value: fixed(r.pour_weights.high, 1) },
    { label: '理论水分', value: `${fixed(r.moisture.powder_avg * 100, 2)}%` },
    { label: '最短长度mm', value: fixed(r.lengths.low, 1) },
    { label: '中间值mm', value: fixed(r.lengths.std, 1) },
    { label: '最长长度mm', value: fixed(r.lengths.high, 1) },
    { label: '最低重量g', value: fixed(r.demold.low, 1) },
    { label: '中间值g', value: fixed(r.demold.mid, 1) },
    { label: '最高重量g', value: fixed(r.demold.high, 1) },
    { label: '实际水分', value: `${fixed(r.actual_moisture * 100, 2)}%` },
  ]
})
const headDiff = computed(() => (patch.value ? Object.entries(patch.value.head)
  .map(([key, val]) => ({ key, val, old: String(props.head?.[key] ?? '') }))
  .filter((d) => d.old !== d.val) : []))
const rowDiff = computed(() => (patch.value ? patch.value.rows.map((r) => ({
  ...r,
  oldRatio: String(editRows.value?.[r.rowIndex]?.['实际添加比例'] ?? ''),
  oldAmount: String(editRows.value?.[r.rowIndex]?.['单支物料含量'] ?? ''),
})) : []))
/** 物料行上那两列算出来的值(按行号对齐 patch.value.rows,与「回填预览」同一份数据源) */
const calcByRow = computed(() => {
  const map = new Map()
  for (const r of (patch.value?.rows || [])) map.set(r.rowIndex, r)
  return map
})
const rowCalc = (i, key) => String(calcByRow.value.get(i)?.[key] ?? '—')

/* ── 物料行的增/删/按编号查档案(2026-10-15)────────────────────────────────────
   加行/删行都是**改弹窗里这份草稿**,不动物单据;写回只发生在点「填入单据」时。
   物料编号改完(current-change,即失焦/回车)按商品档案带出物料名称与物料种类 ——
   走既有档案查询(INV→bs_inv),不新开后端接口。 */
function addMaterialRow() {
  editRows.value = [...editRows.value, blankRecipeRow()]
}
function removeMaterialRow(i) {
  const next = editRows.value.slice()
  next.splice(i, 1)
  editRows.value = next
}
/**
 * 商品档案行:商品档案面板(INV → bs_inv)按存货编码取一行。
 * ⚠ 后端 condition 对普通文本走 `LIKE %值%`(见 core/panel/invCarry.js 头注),`M-001` 会命中 `XM-001`,
 *   所以**本地按 trim 后全等收紧**,且只认唯一命中 —— 多条/没有都返回 null(宁可不带,不带错)。
 */
async function fetchInvRowOf(code) {
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: 'INV', condition: { 存货编码: code }, pageNo: 1, pageSize: 5,
    })
    const hits = invRowsOf(res?.data).filter((r) => String(r?.['存货编码'] ?? '').trim() === code)
    return hits.length === 1 ? hits[0] : null
  } catch {
    return null   // 无权限/查不到都按"档案没有"处理,转手填
  }
}
async function onMaterialCodeChange(i) {
  const code = String(editRows.value[i]?.['物料编号'] ?? '').trim()
  invTip.value = ''
  if (!code) return
  const inv = await fetchInvRowOf(code)
  if (!inv) {
    invTip.value = `· ${tt('这些物料编号在商品档案里查不到，物料名称/物料种类请手填')}`
    return
  }
  const fill = invFillFor(editRows.value[i], inv)
  if (Object.keys(fill).length) {
    Object.assign(editRows.value[i], fill)
    invTip.value = `· ${tt('已按商品档案带出')}：${Object.keys(fill).join('、')}`
  }
  // 含水率:同一份档案行顺带更新(只粉料位参与计算;用户手改过的格不覆盖 —— 复用已测的 applyArchiveMoisture)
  const pct = Number(inv['水分含量'])
  if (!Number.isFinite(pct) || pct <= 0) return
  const merged = applyArchiveMoisture(slots.value, moisture.value, moistureTouched.value, { [code]: pct })
  moisture.value = merged.values
  archiveFilled.value = merged.filledSlots
}
const footTip = computed(() => {
  if (blockReason.value) return blockReason.value
  const n = headDiff.value.length + rowDiff.value.length
  return n ? `${tt('将写入')} ${n} ${tt('处')}` : tt('没有需要写入的变化')
})

/** 打开时:台账/参数载入 + **把页 2 配方表已有的物料行带进来接着编** */
async function onOpen() {
  moisture.value = Array(10).fill('')
  moistureTouched.value = []
  archiveFilled.value = []
  archiveTip.value = ''
  invTip.value = ''
  paramEntryId.value = null
  Object.assign(form, builtinDefaults())
  paramScopeTip.value = scopeTip()
  sinterModel.value = ''
  sinterWorkshop.value = String(props.head?.['生产车间'] ?? '').trim()
  // 物料行:页 2 已有的行拷贝进弹窗(用户在页 2 填过的接着编);页 2 为空就是空的,由「加一行」从零加
  editRows.value = editRowsFrom(props.rows)
  const key = productCode.value || DEFAULT_ITEM
  try {
    const hit = await fetchParam(key)
    if (hit) applyEntry(hit)
    else if (key !== DEFAULT_ITEM) {
      const sys = await fetchParam(DEFAULT_ITEM)
      if (sys) applyEntry(sys)
    } else paramScopeTip.value = `${scopeTip()}；${tt('标准库里还没有系统默认条目，当前用内置默认值')}`
  } catch {
    paramScopeTip.value = `${scopeTip()}；${tt('参数库读取失败，已退回内置默认值')}`
  }
  await loadArchiveMoisture()
  await loadSinterRows()
}

/**
 * 含水率从物料档案带出(商品面板 INV 的「水分含量」,见 tools/migrate-recipe-materials.sql)。
 * 口径:只查粉料位的物料(只有它们参与湿重换算);按物料编号逐个查(等值条件),
 * 结果用 applyArchiveMoisture 合并 —— 用户手改过的格不覆盖。档案读不到就退回手填,不阻断计算。
 */
async function loadArchiveMoisture() {
  const codes = [...new Set(slots.value.filter((s) => isPowder(s) && s.code).map((s) => s.code))]
  if (!codes.length) return
  const archive = {}
  await Promise.all(codes.map(async (code) => {
    const row = await fetchInvRowOf(code)
    const v = row ? Number(row['水分含量']) : NaN
    archive[code] = Number.isFinite(v) && v > 0 ? v : null
  }))
  const merged = applyArchiveMoisture(slots.value, moisture.value, moistureTouched.value, archive)
  moisture.value = merged.values
  archiveFilled.value = merged.filledSlots
  archiveTip.value = merged.filledSlots.length
    ? `· ${tt('已从档案带出')} ${merged.filledSlots.length} ${tt('个料位的含水率')}`
    : `· ${tt('档案里没有这些物料的含水率，请手填')}`
}
async function fetchParam(item) {
  const res = await request.get('/stdlib/list', { params: { lib: LIB, item, all: 1 } })
  const list = res?.data || []
  const enabled = list.find((r) => Number(r.enabled) === 1) || list[0]
  return enabled || null
}
function applyEntry(entry) {
  paramEntryId.value = entry.id
  try {
    const obj = JSON.parse(entry.content)
    PARAM_FIELDS.forEach((f) => { if (obj[f.key] !== undefined && obj[f.key] !== null) form[f.key] = String(obj[f.key]) })
    paramScopeTip.value = `${scopeTip()}；${tt('已载入')}「${entry.item}」${tt('的参数')}`
  } catch {
    paramScopeTip.value = `${scopeTip()}；${tt('参数库条目不是合法 JSON，已退回内置默认值')}`
  }
}
async function loadSystemDefaults() {
  Object.assign(form, builtinDefaults())
  try {
    const sys = await fetchParam(DEFAULT_ITEM)
    if (sys) applyEntry(sys)
    else paramScopeTip.value = `${tt('已载入内置默认值')}；${tt('要永久生效请点「存为该产品参数」')}`
  } catch {
    paramScopeTip.value = `${tt('已载入内置默认值')}；${tt('要永久生效请点「存为该产品参数」')}`
  }
}
async function saveParams() {
  const item = productCode.value || DEFAULT_ITEM
  const content = JSON.stringify(overrides.value)
  try {
    if (paramEntryId.value) await request.post('/stdlib/update', { id: paramEntryId.value, content })
    else await request.post('/stdlib/add', { lib: LIB, item, content })
    const hit = await fetchParam(item)
    if (hit) applyEntry(hit)
    ElMessage.success(tt('已存为该产品参数'))
  } catch {
    ElMessage.error(tt('保存失败'))
  }
}

/* ── 按产品规格一键带出(2026-09-21)────────────────────────────────────────
   做同一产品的第二张单时,炭棒规格/烧结型号/密度范围本来都要重敲;这三样都能从已有数据推出来:
     · 炭棒规格 1/2/3 ← 产品信息表 RD_PROD_INFO(炭棒外径/炭棒内径/炭棒长度);
     · 烧结型号       ← 按外径/内径在烧结尺寸表里匹配(先看单据车间,匹配不到不猜);
     · 密度上下限     ← **该产品最近一张已保存的成型工艺清单**(只有「密度管控要求」文本也能解析)。
   取不到就如实提示,**绝不编造密度**(质量口径的数不能猜);已填的格一律不动(specCarryFrom 有单测)。
   放在 ③ 区头:算不出来时(blockReason)它就在眼前。 */
const carrying = ref(false)
/** 该面板下某条件的最新一张单据号(列表按新→旧;单据类面板列表键是「编号」,档案类是「单据编号」) */
async function listDocNos(panelCode, condition) {
  const res = await request.post('/px/queryFormDataList', { panelCode, condition, pageNo: 1, pageSize: 6 })
  const d = res?.data
  const list = Array.isArray(d) ? d : (d?.list || d?.rows || [])
  return list.map((r) => String(r?.['编号'] ?? r?.['单据编号'] ?? '').trim()).filter(Boolean)
}
/** 单据表头(字段名口径,与页 1 一致) */
async function fetchHeadRow(panelCode, code) {
  const res = await request.get('/px/getFormDescriptor', { params: { panelCode, code } })
  const d = res?.data
  return (d && (d.data || d)) || null
}
/**
 * 该产品最近一张**带密度**的成型工艺清单。
 * ⚠ 必须跳过当前这张单:它自己就是该产品最新的一张(还没填密度),不跳就会误判"历史没有密度"。
 * 取不到就给 null —— 界面据此提示"密度请手工填",绝不猜一个密度出来。
 */
async function findDensityHistory(code) {
  const cur = String(props.head?.['单据编号'] ?? props.head?.['编号'] ?? '').trim()
  const nos = (await listDocNos('RD_MOLD_PROC', { 产品编号: code })).filter((no) => no !== cur)
  for (const no of nos.slice(0, 3)) {
    const head = await fetchHeadRow('RD_MOLD_PROC', no)
    if (densityOf(head)) return head
  }
  return null
}
async function carrySpec() {
  if (carrying.value) return
  const code = productCode.value
  if (!code) { ElMessage.warning(tt('请先在页 1 产品基本信息里选「炭棒编号」')); return }
  carrying.value = true
  try {
    let product = null
    let history = null
    try {
      const pNo = (await listDocNos('RD_PROD_INFO', { 产品编号: code }))[0]
      if (pNo) product = await fetchHeadRow('RD_PROD_INFO', pNo)
    } catch { /* 读不到就当没有,靠 missing 提示 */ }
    try {
      history = await findDensityHistory(code)
    } catch { /* 同上 */ }

    const { patch, skipped, missing } = specCarryFrom(product, history, props.head)
    const keys = Object.keys(patch)
    keys.forEach((k) => { props.head[k] = patch[k] })

    // 烧结型号:拿带出后的外径/内径(含单据上已有的)去尺寸表匹配,匹配到就选中
    const od = patch['炭棒规格1'] || props.head?.['炭棒规格1']
    const id = patch['炭棒规格2'] || props.head?.['炭棒规格2']
    const model = matchSinterModel(sinterRows.value, sinterWorkshop.value || String(props.head?.['生产车间'] ?? ''), od, id)
    if (model) sinterModel.value = model

    const uniqSkip = [...new Set(skipped)]
    if (keys.length) ElMessage.success(`${tt('已带出')} ${keys.length} ${tt('处')}：${keys.join('、')}`)
    if (uniqSkip.length) ElMessage.info(`${tt('已有值未覆盖')}：${uniqSkip.join('、')}`)
    if (model) ElMessage.success(`${tt('烧结型号已选中')}：${model}`)
    else if (od && id) ElMessage.info(tt('尺寸表里没匹配到型号，请手工选'))
    if (missing.length) {
      const extra = missing.includes('密度') ? tt('（密度范围请手工填，或先给该产品存一张成型工艺清单）') : ''
      ElMessage.warning(`${tt('没有可带出的')}：${missing.join('、')}${extra}`)
    }
  } catch (e) {
    ElMessage.error(tt('带出失败') + '：' + (e?.message || e))
  } finally {
    carrying.value = false
  }
}

/**
 * 回填:页 1 十一个格(patch.head)+ **页 2 配方表整表替换为弹窗里这份物料行**
 * (设计文档口径:比例 2 位小数带 %、含量 2 位小数)。
 *
 * ⚠ 明细不再逐行改原行(那要求行必须先在页 2 存在),而是把整份新行交给面板
 * (emit applied 的 payload.rows),由面板按本表区(表区='配方表')换掉旧行 ——
 * 页 2 原来是空的也能一次写进去。行内两列由 buildRecipeRows 并好(纯函数+单测)。
 */
function apply() {
  if (!patch.value) return
  Object.entries(patch.value.head).forEach(([key, val]) => { props.head[key] = val })
  emit('applied', { rows: buildRecipeRows(editRows.value, patch.value.rows) })
  ElMessage.success(`${tt('已填入单据')}（${headDiff.value.length + rowDiff.value.length} ${tt('处')}）`)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.rcd { font-size: 12px; }
.rcd-note { padding: 6px 10px; margin-bottom: 10px; background: #f4f8ff; border: 1px solid #d6e4ff; border-radius: 4px; color: #4a5568; line-height: 1.6; }
.rcd-sec-h { display: flex; align-items: center; gap: 10px; margin: 12px 0 6px; flex-wrap: wrap; }
.rcd-sec-t { font-weight: 600; color: #303133; }
.rcd-muted { color: #909399; font-size: 11px; line-height: 1.5; }
.rcd-act { color: #409eff; cursor: pointer; border: 1px solid #a0cfff; border-radius: 3px; padding: 1px 8px; font-size: 11px; }
.rcd-act:hover { background: #ecf5ff; }
.rcd-act-off { opacity: 0.5; pointer-events: none; }
.rcd-params { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 14px; }
.rcd-pf { display: flex; align-items: center; gap: 8px; }
.rcd-pf-lb { width: 132px; color: #606266; text-align: right; }
.rcd-pf-in { flex: 1; min-width: 0; }
.rcd-tb { width: 100%; border-collapse: collapse; }
.rcd-tb th, .rcd-tb td { border: 1px solid #dcdfe6; padding: 2px 6px; height: 26px; }
.rcd-tb th { background: #fafafa; font-weight: 500; color: #606266; }
.rcd-c { text-align: center; }
.rcd-empty { background: #fbfbfb; color: #c0c4cc; }
.rcd-mini { width: 78px; }
.rcd-mini :deep(.el-input__inner) { text-align: center; }
.rcd-del { color: #f56c6c; cursor: pointer; padding: 0 6px; font-size: 12px; }
.rcd-del:hover { color: #c45656; }
.rcd-src { margin-left: 3px; font-size: 10px; color: #67c23a; border: 1px solid #b3e19d; border-radius: 2px; padding: 0 2px; vertical-align: middle; }
.rcd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 4px 14px; }
.rcd-r { display: flex; justify-content: space-between; border-bottom: 1px dashed #ebeef5; padding: 2px 0; }
.rcd-r-lb { color: #606266; }
.rcd-r-v { font-weight: 600; font-variant-numeric: tabular-nums; }
.rcd-warns { margin-top: 6px; }
.rcd-warn { color: #e6a23c; line-height: 1.7; }
.rcd-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.rcd-old { color: #c0c4cc; text-decoration: line-through; }
.rcd-foot { margin-right: auto; float: left; color: #909399; font-size: 11px; line-height: 32px; }
@media (max-width: 900px) {
  .rcd-params { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rcd-two { grid-template-columns: minmax(0, 1fr); }
}
</style>
