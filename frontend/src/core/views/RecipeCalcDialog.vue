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
        {{ tt('计算口径与《炭棒工艺配方设计器》逐位一致；本弹窗的输入不保存、不打印，只有点「填入单据」写进单据的值才随单据保存。') }}
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

      <!-- ② 料位(读单据页 2 配方表)+ 含水率 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">② {{ tt('料位与含水率') }}</span>
        <span class="rcd-muted">{{ tt('料位按配方表的物料种类分组(粉料 1~5 / 胶粉 6~7 / 折算料 8~10);料位 1 是补差位。含水率默认从物料档案(商品·水分含量)按物料编号带出,档案没有的请手填 —— 只有粉料位的含水率参与计算。') }}</span>
        <span v-if="archiveTip" class="rcd-muted">{{ archiveTip }}</span>
      </div>
      <table class="rcd-tb">
        <thead>
          <tr>
            <th style="width:52px">{{ tt('料位') }}</th>
            <th style="width:74px">{{ tt('分组') }}</th>
            <th style="width:130px">{{ tt('物料编号') }}</th>
            <th>{{ tt('物料名称') }}</th>
            <th style="width:150px">{{ tt('设计值(来自配方表)') }}</th>
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

      <!-- ③ 结果 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">③ {{ tt('计算结果') }}</span>
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

      <!-- ④ 回填预览 -->
      <div class="rcd-sec-h">
        <span class="rcd-sec-t">④ {{ tt('回填预览') }}</span>
        <span class="rcd-muted">{{ tt('点「填入单据」后按下面这张表覆盖对应格;未变化的格不列出。') }}</span>
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
            <tr v-if="!rowDiff.length"><td colspan="4" class="rcd-muted">{{ tt('配方表没有可回填的行') }}</td></tr>
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
import { applyArchiveMoisture, buildPatch, moisturePercent, paramsFromHead, slotsFromRows } from '@/core/mold/recipeSheet.js'
import { DEFAULT_LENGTH_TOL } from '@/core/mold/recipeConstants.js'

/**
 * 配方计算弹窗(2026-09-20)。
 *
 * 口径见 CONTEXT.md「配方计算器(Recipe Calculator)」与 docs/adr/0004:
 *   - 公式 = 与《炭棒工艺配方设计器》exe 逐位一致(core/mold/recipeEngine.js),本弹窗不做任何计算;
 *   - 输入(工艺参数/含水率)**不落库、不打印**;只有回填进单据字段的值随单据保存;
 *   - 配方真源 = 当前单据页 2 配方表(本弹窗读它、写回同一行);
 *   - 可调参数(一切几/折算比/公差/漂移)= 系统默认 + 按产品编号覆盖,落标准库 yj_std_lib
 *     (lib=mold.calcparam,条目名=产品编号,条目名"默认"为系统默认),维护界面用现成的 StdLibManager。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  head: { type: Object, required: true },
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
const paramEntryId = ref(null)
const paramScopeTip = ref('')
const paramLibVisible = ref(false)

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

const overrides = computed(() => Object.fromEntries(
  Object.entries(form).map(([k, v]) => [k, Number(String(v).trim())]).filter(([, v]) => Number.isFinite(v))))

const slots = computed(() => slotsFromRows(props.rows).slots
  // 弹窗输入是百分数(exe 前端同款),引擎吃小数 —— 换算在 recipeSheet.moisturePercent 里,有单测
  .map((s, i) => ({ ...s, moisture: moisturePercent(moisture.value[i]) })))

const parsed = computed(() => {
  const { params, missing } = paramsFromHead(props.head, overrides.value)
  if (missing.length) return { missing }
  try {
    return { params, result: compute(params, slots.value.map((s) => ({ design_ratio: s.designRatio, amount_g: s.amountG, moisture: s.moisture }))) }
  } catch (e) {
    return { error: e.message }
  }
})
const result = computed(() => parsed.value.result || null)
const blockReason = computed(() => {
  if (parsed.value.missing?.length) return `${tt('单据上还缺')}：${parsed.value.missing.join('、')}${tt('（请先在页 1 填好，或补齐密度管控范围）')}`
  if (parsed.value.error) return parsed.value.error
  return ''
})
const patch = computed(() => (result.value ? buildPatch(result.value, slots.value) : null))
const rowWarnings = computed(() => slotsFromRows(props.rows).warnings)
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
  oldRatio: String(props.rows?.[r.rowIndex]?.['实际添加比例'] ?? ''),
  oldAmount: String(props.rows?.[r.rowIndex]?.['单支物料含量'] ?? ''),
})) : []))
const footTip = computed(() => {
  if (blockReason.value) return blockReason.value
  const n = headDiff.value.length + rowDiff.value.length
  return n ? `${tt('将写入')} ${n} ${tt('处')}` : tt('没有需要写入的变化')
})

/** 打开时:载入该产品的参数(没有就用系统默认条目,再没有就用内置默认) */
async function onOpen() {
  moisture.value = Array(10).fill('')
  moistureTouched.value = []
  archiveFilled.value = []
  archiveTip.value = ''
  paramEntryId.value = null
  Object.assign(form, builtinDefaults())
  paramScopeTip.value = scopeTip()
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
    try {
      const res = await request.post('/px/queryFormDataList', {
        panelCode: 'INV', condition: { 存货编码: code }, pageNo: 1, pageSize: 1,
      })
      const d = res?.data
      const list = Array.isArray(d) ? d : (d?.list || d?.rows || [])
      // ⚠ 档案面板返回的是**主从结构**:list[0].detail.items[0] 才是行数据(实测),
      //   直接把 list[0] 当行会拿到 {编号,状态,单据状态,detail} 四个键、含水量永远取不到。
      const row = list.length ? (list[0]?.detail?.items?.[0] || list[0]) : null
      const v = row ? Number(row['水分含量']) : NaN
      archive[code] = Number.isFinite(v) && v > 0 ? v : null
    } catch {
      archive[code] = null   // 无权限/查不到都按"档案没有"处理,转手填
    }
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

/** 回填:页 1 十一个格 + 配方表对应行的两列(设计文档口径:比例 2 位小数带 %、含量 2 位小数) */
function apply() {
  if (!patch.value) return
  Object.entries(patch.value.head).forEach(([key, val]) => { props.head[key] = val })
  patch.value.rows.forEach((r) => {
    const row = props.rows[r.rowIndex]
    if (!row) return
    row['实际添加比例'] = r.实际添加比例
    row['单支物料含量'] = r.单支物料含量
  })
  emit('applied')
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
