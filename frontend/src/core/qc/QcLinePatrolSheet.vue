<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       成型车间巡线记录表(QC_LINE_PATROL)—— 纸张式记录表

       版式一比一照用户 2026-11-14 给的第二张纸样(脱模检验记录表,1843×1109,
       原图 tools/archive/_qc-line-patrol-20261114/refs/paper.png):
         纸头   : 左「日期：<单据日期>」· 中「大标题」· 右「审核人：<审核人>」(审核人本期只读)
         主表   : **12 列**(列序照纸样)
                  巡线时间 | 车间 | 产品信息确认（重点产品标注★） | 炭棒长度范围mm |
                  内径检查mm | 重量范围g | 两端密度（伊可普高品质炭棒需要测试） |
                  表面状态 | 跌落强度 | 抗压强度 | 结果判定 | 巡线人员
         记录块 : 每块 = **4 个子行**(纸样如此:每块记 2 支 / 2 个产品):
                  子行1 编号① + 长度标准① + 内径标准① + 重量标准①
                  子行2 型号① + 长度实测① + 内径实测① + 重量实测①
                  子行3 编号② + 长度标准② + 内径标准② + 重量标准②
                  子行4 型号② + 长度实测② + 内径实测② + 重量实测②
                  块级列(巡线时间/车间/两端密度/表面状态/跌落强度/抗压强度/结果判定/巡线人员)
                  在 4 个子行上 **rowspan=4**(纸样就是这样一块一大格)。
         交互   : 每块右侧「＋」= 在本块之后插入一块、「×」= 删除本块(no-print,不上纸);
                  新建草稿空表**默认铺 3 块**(用户口径「先可填即可」);草稿态全格可填、
                  只读态一律显示文本。导出 Excel 本期不做(打印 = 浏览器打印本纸)。
                  **审批流 2026-11-17 已接**(用户口径 Excel #13「程志/李光从填 → 刘磊审核」):
                    单级审批 提交审批 → 审批通过 → 已审核 → 弃审 → 草稿,
                    编制格 = 巡线人员;登记见 ButtonService.SINGLE_LEVEL_INSP_PANELS。

       契约唯一真源:docs/design/成型车间巡线记录表-首版.md(§一 版式 / §二 库表)。
       写法与 QcFirstInspSheet.vue / QcOqcSheet.vue 同款:
         props = head / fields / editable,emit('dirty');明细行 = head.detail.items,
         单元格 :model-value + 写入函数(行对象可能被面板 markRaw ⇒ 改完 bump++ 强制重渲)。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="lp-sheet" :class="{ 'is-editing': editable }" data-lp-sheet="QC_LINE_PATROL">
    <!-- ① 纸头:左日期 · 中标题 · 右审核人
         ⚠ 审核人本期**只读**(契约 §一「审核人（只读）」/ 审批流以后接),故这里恒 render 文本,
           不给输入框 —— 后端 ButtonService 保存时也会把「审核人」键从 body 摘掉(审批流才落值)。 -->
    <div class="lp-head">
      <div class="lp-head-left">
        <span class="lp-label">{{ tt('日期') }}：</span>
        <el-date-picker
          v-if="editable && !isLocked('单据日期')"
          v-model="head['单据日期']"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          class="lp-date"
          :placeholder="tt('选择日期')"
          @change="emit('dirty')"
        />
        <span v-else class="lp-val">{{ head['单据日期'] || '' }}</span>
      </div>
      <div class="lp-title">{{ tt('成型车间巡线记录表') }}</div>
      <div class="lp-head-right">
        <span class="lp-label">{{ tt('审核人') }}：</span>
        <span class="lp-val">{{ head['审核人'] || '' }}</span>
      </div>
    </div>

    <!-- ② 主表:12 列 + (可编辑时)行操作列
         ⚠ 列多且块内 4 子行 ⇒ 给表格一个最小宽度、外面套横向滚动容器
           (屏上窗口窄时不把每列压成一条线,拉滚动条即可;打印时容器退回可见,见文件末尾 @media print)。 -->
    <div class="lp-grid-scroll">
      <table class="lp-grid" :style="{ minWidth: gridMinWidth }">
        <colgroup>
          <col v-for="c in COLUMNS" :key="c.key" :style="{ width: c.width }" />
          <col v-if="editable" style="width: 42px" />
        </colgroup>
        <thead>
          <tr>
            <th v-for="c in COLUMNS" :key="c.key">{{ tt(c.label) }}</th>
            <th v-if="editable" class="lp-opcol no-print">{{ tt('增删') }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- 一块 = 4 个 <tr>;块级格只在第一子行出现并 rowspan=4 -->
          <template v-for="(row, ri) in items" :key="rowKeyOf(row, ri)">
            <tr v-for="(sr, si) in SUB_ROWS" :key="ri + '-' + si" class="lp-row" :class="{ 'is-block-first': si === 0 }">
              <!-- 块级列(前半:巡线时间 / 车间) -->
              <template v-if="si === 0">
                <td
                  v-for="c in LEAD_BLOCK_COLUMNS"
                  :key="c.key"
                  class="lp-block"
                  :rowspan="SUB_ROWS.length"
                  :data-lp="c.key"
                >
                  <el-input
                    v-if="editable"
                    :model-value="cell(row, c.key)"
                    size="small"
                    class="lp-cell"
                    maxlength="50"
                    @update:model-value="(v) => setCell(row, c.key, v)"
                  />
                  <span v-else class="lp-text">{{ cell(row, c.key) }}</span>
                </td>
              </template>

              <!-- 产品信息确认 4 格:编号/型号 + 本标准值/实测(纸样:「编号：____」「标准值：____」这种label+值的格) -->
              <td
                v-for="(cellDef, ci) in sr.cells"
                :key="ri + '-' + si + '-' + ci"
                class="lp-prod"
                :data-lp="cellDef.field"
              >
                <div class="lp-prod-cell">
                  <span class="lp-prefix">{{ tt(cellDef.prefix) }}：</span>
                  <el-input
                    v-if="editable"
                    :model-value="cell(row, cellDef.field)"
                    size="small"
                    class="lp-cell"
                    maxlength="50"
                    @update:model-value="(v) => setCell(row, cellDef.field, v)"
                  />
                  <span v-else class="lp-text">{{ cell(row, cellDef.field) }}</span>
                </div>
              </td>

              <!-- 块级列(后半:两端密度 / 表面状态 / 跌落强度 / 抗压强度 / 结果判定 / 巡线人员)
                   + 行操作(＋插入本块之后 / ×删除本块) -->
              <template v-if="si === 0">
                <td
                  v-for="c in TAIL_BLOCK_COLUMNS"
                  :key="c.key"
                  class="lp-block"
                  :rowspan="SUB_ROWS.length"
                  :data-lp="c.key"
                >
                  <el-input
                    v-if="editable"
                    :model-value="cell(row, c.key)"
                    size="small"
                    class="lp-cell"
                    maxlength="50"
                    @update:model-value="(v) => setCell(row, c.key, v)"
                  />
                  <span v-else class="lp-text">{{ cell(row, c.key) }}</span>
                </td>
                <td v-if="editable" class="lp-op no-print" :rowspan="SUB_ROWS.length">
                  <span class="lp-btn" :title="tt('在本块之后插入一块')" @click="addBlockAfter(ri)">＋</span>
                  <span class="lp-btn is-del" :title="tt('删除本块')" @click="removeBlock(ri)">×</span>
                </td>
              </template>
            </tr>
          </template>

          <!-- 一块都没有(新建空草稿 / 用户把块删光了):给出「＋ 新增巡线记录」入口
               ⚠ 只读单上不给操作指引(那时按钮本来就不该点)。 -->
          <tr v-if="!items.length">
            <td :colspan="COL_COUNT" class="lp-empty">
              <template v-if="editable">
                <span class="lp-addblock" @click="addBlockAfter(items.length - 1)">＋ {{ tt('新增巡线记录') }}</span>
              </template>
              <template v-else>{{ tt('暂无巡线记录') }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  /** 当前单据(列表行:表头字段平铺 + detail.items 明细;与首件/出厂检验报告同款) */
  head: { type: Object, required: true },
  /** 表头字段元数据(yj_field 下发:用于判 locked/editable,与 QcFirstInspSheet 同口径) */
  fields: { type: Array, default: () => [] },
  /** 草稿态才可填;只读态(已审核/归档/无权限/标注模式)全部渲染成纯文本 */
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

/** 本地版本号:明细数组/行可能被面板 markRaw(非响应式),push/splice/写值后不会触发重渲染
 *  ⇒ 用它在组件内**强制刷新**(与首件检验单/出厂检验报告同一套做法)。 */
const bump = ref(0)

/** 明细行(= 一间块:一块记 2 支/2 个产品) */
const items = computed(() => {
  bump.value // ← 建立依赖:变更后强制重算并触发重渲染
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

/** 取(必要时创建)明细数组 —— 新建单据 head.detail 可能是 {} 或 {tabs:[…]} 而**没有 items**。 */
function ensureItems() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}

/**
 * 表头 12 列(顺序/文案照契约 §一 与纸样;数据键 = qc_line_patrol_detail 的中文列名)。
 * `block: true` = 块级列(4 子行合并 rowspan=4);`prod: true` = 产品确认区(每子行一格)。
 * 列宽按纸样比例分配(合计 100%);两端密度那列纸样文字最长,给到 11%。
 */
const COLUMNS = [
  { key: '巡线时间', label: '巡线时间', width: '8%', block: true },
  // 车间 7%:原 6% 时「成型一车间」在格内会被截断(2026-11-14 实机截图抓到),加宽 1% 后够放 5 字;
  // 产品信息确认让出 1%(14% → 13%)平账。
  { key: '车间', label: '车间', width: '7%', block: true },
  { key: 'prod', label: '产品信息确认（重点产品标注★）', width: '13%', prod: true },
  { key: 'len', label: '炭棒长度范围mm', width: '10%', prod: true },
  { key: 'dia', label: '内径检查mm', width: '10%', prod: true },
  { key: 'wt', label: '重量范围g', width: '10%', prod: true },
  // ⚠ key = **物理列名**（qc_line_patrol_detail.[两液密度]），不可改 —— 改了就读不到值、
  //   保存也写不进库（2026-11-17 首次改版踩过：把 key 一起改成「两端密度」，线上直接空列）。
  //   用户口径（Excel #13）改的是**显示名**：「原列标题为两端密度（伊可普高品质炭棒需要测试），
  //   实际搞错为两液密度（伊玛印品耐水煮要求测试）」⇒ 只换 label，数据键按 ADR-0001 保持中文原样。
  { key: '两液密度', label: '两端密度（伊可普高品质炭棒需要测试）', width: '11%', block: true },
  { key: '表面状态', label: '表面状态', width: '7%', block: true },
  { key: '跌落强度', label: '跌落强度', width: '6%', block: true },
  { key: '抗压强度', label: '抗压强度', width: '6%', block: true },
  { key: '结果判定', label: '结果判定', width: '6%', block: true },
  { key: '巡线人员', label: '巡线人员', width: '6%', block: true },
]
/** 块级列拆两段:前半(巡线时间/车间)在第一个产品格之前,后半在两块之间 —— 模板按纸样顺序渲染 */
const LEAD_BLOCK_COLUMNS = COLUMNS.filter((c) => c.block).slice(0, 2)
const TAIL_BLOCK_COLUMNS = COLUMNS.filter((c) => c.block).slice(2)
/** 表格总列数(空表提示行的 colspan;可编辑时多一列行操作) */
const COL_COUNT = computed(() => COLUMNS.length + (props.editable ? 1 : 0))

/**
 * 4 个子行(**契约 §一 + 纸样**):
 *   cells = 产品确认区的 4 格(编号/型号 + 三组标准值/实测),prefix = 纸样印在格内的标签。
 * 数据键 = qc_line_patrol_detail 的物理列名(编号1/型号1/长度标准1/…),中文数据键不翻译(ADR-0001)。
 */
const SUB_ROWS = [
  // 2026-11-17 用户口径（Excel #13）：「产品信息确认，一个巡线时间里面就只有一个编号和型号内容
  // （现在有 2 个）」⇒ 由 4 组（编号1/型号1/编号2/型号2）**收敛为 1 组**。
  // 旧列 编号2/型号2/…标准2/…实测2 保留在 DETAIL_KEYS 里（历史数据不丢），
  // 只是不再上纸面、新块也不铺值。
  { cells: [
    { field: '编号1', prefix: '编号' },
    { field: '长度标准1', prefix: '标准值' },
    { field: '内径标准1', prefix: '标准值' },
    { field: '重量标准1', prefix: '标准值' },
  ] },
  { cells: [
    { field: '型号1', prefix: '型号' },
    { field: '长度实测1', prefix: '实测' },
    { field: '内径实测1', prefix: '实测' },
    { field: '重量实测1', prefix: '实测' },
  ] },
]

/**
 * 明细行的**全部物理列**(新建块时铺齐,与契约 §二 逐列对齐)。
 * 「行号」= 块序号(1..n),保存时一并落库;`hidden=1` 只是不给列表页当列显示。
 */
const DETAIL_KEYS = [
  '行号',
  '巡线时间', '车间',
  '编号1', '型号1', '长度标准1', '长度实测1', '内径标准1', '内径实测1', '重量标准1', '重量实测1',
  '编号2', '型号2', '长度标准2', '长度实测2', '内径标准2', '内径实测2', '重量标准2', '重量实测2',
  '两液密度', '表面状态', '跌落强度', '抗压强度', '结果判定', '巡线人员',
]

/** 新建一块(所有格空白;行号先给序号,插入/删除后统一重排) */
function newBlock(seq) {
  const row = {}
  for (const k of DETAIL_KEYS) row[k] = k === '行号' ? seq : ''
  return row
}

/** 块序号重排:插入/删除块后 行号 保持 1..n 连续(落库顺序 = 纸面从上到下) */
function renumber() {
  const arr = ensureItems()
  arr.forEach((row, i) => { row['行号'] = i + 1 })
}

/** 在 index 之后插入一块(index < 0 = 插到最前面,空表时用它) */
function addBlockAfter(index) {
  if (!props.editable) return
  const arr = ensureItems()
  const at = Math.max(0, Math.min(arr.length, Number(index) + 1))
  arr.splice(at, 0, newBlock(at + 1))
  renumber()
  bump.value++
  emit('dirty')
}

/** 删除本块(纸样上的「×」;本期不做二次确认 —— 未保存前「放弃」可整单回退) */
function removeBlock(index) {
  if (!props.editable) return
  const arr = ensureItems()
  if (index < 0 || index >= arr.length) return
  arr.splice(index, 1)
  renumber()
  bump.value++
  emit('dirty')
}

/** 单元格取值(老单据可能没有该键 / 值为 null ⇒ 统一成字符串) */
function cell(row, key) {
  return String(row?.[key] ?? '')
}
/** 单元格写值:行对象可能是 markRaw ⇒ 写完 bump++ 强制重渲 + 标脏 */
function setCell(row, key, v) {
  row[key] = String(v ?? '')
  bump.value++
  emit('dirty')
}

/** v-for 的 key:行没有稳定 id(新建行才有 id) ⇒ 用「id 或 行号+下标」兜底 */
function rowKeyOf(row, index) {
  const id = row?.id
  return id != null && id !== '' ? `id-${id}` : `ix-${index}`
}

/**
 * 默认铺 3 块(契约 §一「新建草稿空表时默认铺 3 块」;用户口径「先可填即可」)。
 *
 * 触发口径(只此一处,避免"删光就自动又冒出来"):
 *   · 可编辑 + 明细为 0 时,按**单据身份**判一次:换了单(或第一次进)才铺;
 *   · 空白新建草稿(无单据编号)每次换单都判 —— 连点两次「新增」两张空单都能各铺 3 块;
 *   · 已保存单据(有单据编号)只在第一次进它时判,用户手动把块删光后不会再被强行塞回。
 * 铺完标脏:这些块要跟着第一次「保存」一起落库(与首件检验单的默认列同一口径)。
 */
const seededFor = ref(null)
function docKeyOf() {
  return String(props.head?.['单据编号'] || props.head?.['编号'] || '')
}
function seedBlocksOnce() {
  if (!props.editable) return
  const key = docKeyOf()
  // 已保存单据:同一张只判一次(key 相同直接跳过)
  if (key && key === seededFor.value) return
  // 空白草稿:每次「新增」都是一张新单(key 恒为空串 ⇒ 用 items 长度兜底,不在有数据时重铺)
  if (!key && items.value.length) { seededFor.value = key; return }
  seededFor.value = key
  const arr = ensureItems()
  if (arr.length) return
  for (let i = 0; i < DEFAULT_BLOCKS; i++) arr.push(newBlock(i + 1))
  bump.value++
  emit('dirty')
}
const DEFAULT_BLOCKS = 3
watch(
  () => [props.editable, docKeyOf(), items.value.length],
  () => { seedBlocksOnce() },
  { immediate: true },
)

/**
 * 只读判定:该字段在 yj_field 里登记成不可编辑(未登记 ≠ 锁定,与首件/出厂检验报告同口径)。
 * ⚠ 后端契约:yj_field.editable=0 在 dataSchema 里下发的是 **`readonly:true`**
 *   (PanelConfigService.fieldSpec),同时兼容旧的 editable:false/0 写法。
 */
function isLocked(key) {
  const f = (props.fields || []).find((x) => (x.dataName || x.name || x.code) === key)
  return !!f && (f.readonly === true || f.editable === false || f.editable === 0)
}

/** 表格最小宽度:12 列 × 约 96px + 行操作列;窗口更窄时靠 .lp-grid-scroll 出横向滚动条 */
const COL_MIN_WIDTH = 96
const gridMinWidth = computed(() => `${COLUMNS.length * COL_MIN_WIDTH + (props.editable ? 42 : 0)}px`)
</script>

<style scoped>
/* ── 纸张本体:白色卡片 + 细灰框(屏上象一张纸;打印时由文件末尾的 @media print 收回纸宽) ── */
.lp-sheet {
  background: #fff;
  border: 1px solid #8a8a8a;
  max-width: 1560px;
  min-width: 900px;
  margin: 14px auto 24px;
  padding: 10px 12px 14px;
  color: #222;
  font-size: 13.5px;
  box-sizing: border-box;
}
.lp-sheet *,
.lp-sheet *::before,
.lp-sheet *::after {
  box-sizing: border-box;
}

/* ── 纸头:左日期 / 中标题 / 右审核人(三栏网格,标题天然居中) ── */
.lp-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  column-gap: 12px;
  padding: 2px 4px 8px;
}
.lp-head-left {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.lp-head-right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.lp-title {
  text-align: center;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: 3px;
  white-space: nowrap;
}
.lp-label {
  color: #333;
  white-space: nowrap;
}
.lp-val {
  min-width: 90px;
  border-bottom: 1px solid #8a8a8a;
  padding: 0 2px;
  text-align: center;
}
.lp-date {
  width: 150px;
}

/* ── 主表滚动容器(列多时不挤压;打印时退回可见) ── */
.lp-grid-scroll {
  overflow-x: auto;
}

/* ── 主表:12 列 + 4 子行,框线与首件检验单同色 ── */
.lp-grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.lp-grid th,
.lp-grid td {
  border: 1px solid #8a8a8a;
  padding: 3px 4px;
  text-align: center;
  vertical-align: middle;
  height: 30px;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.lp-grid thead th {
  background: #f2f2f2;
  font-weight: 600;
  font-size: 13px;
  height: 40px;
  line-height: 1.25;
}
/* 块级格:一块一大格(rowspan=4),垂直居中;纸样上这些格子偏左对齐 */
.lp-grid td.lp-block {
  padding: 2px 4px;
}
/* 产品确认区的四格:格内 = 标签 + 值 */
.lp-prod-cell {
  display: flex;
  align-items: center;
  gap: 1px;
  min-width: 0;
}
.lp-prefix {
  flex: none;
  color: #333;
  font-size: 12.5px;
  white-space: nowrap;
}
.lp-text {
  display: block;
  width: 100%;
  min-height: 18px;
  line-height: 1.35;
  text-align: center;
}
/* 格内直编:去边框,白纸观感(与首件检验单 .fi-cell 同款) */
.lp-cell {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}
.lp-cell :deep(.el-input__wrapper),
.lp-cell :deep(.el-input__wrapper.is-focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
}
.lp-cell :deep(.el-input__inner) {
  text-align: center;
  font-size: 13px;
  height: 22px;
}

/* ── 行操作(＋插入 / ×删除):只编辑态出现,且不上纸(no-print) ── */
.lp-opcol {
  background: #fafafa;
  font-weight: 400;
  font-size: 12px;
  color: #888;
}
.lp-op {
  background: #fafafa;
  padding: 2px !important;
  white-space: nowrap;
}
.lp-btn {
  display: inline-block;
  width: 17px;
  height: 17px;
  line-height: 15px;
  margin: 1px 2px;
  border: 1px solid #8a8a8a;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #333;
}
.lp-btn:hover {
  background: #eef6fe;
  border-color: #1f5fa8;
  color: #1f5fa8;
}
.lp-btn.is-del:hover {
  background: #fdecea;
  border-color: #b3261e;
  color: #b3261e;
}

/* ── 空表提示 + 「＋ 新增巡线记录」 ── */
.lp-empty {
  height: 72px;
  color: #909399;
}
.lp-addblock {
  display: inline-block;
  padding: 6px 16px;
  border: 1px dashed #8a8a8a;
  border-radius: 4px;
  cursor: pointer;
  color: #333;
  font-size: 13.5px;
}
.lp-addblock:hover {
  background: #eef6fe;
  border-color: #1f5fa8;
  color: #1f5fa8;
}
</style>

<!-- 打印整张:只保留这张纸(与首件检验单 / 出厂检验报告同一套白名单机制)
     ⚠ 公共打印样式(见 DocSheet.vue 的非 scoped 块)把 `body.approval-printing .portal` 整体
       `visibility: hidden`,再逐个 whitelist 纸张根类名;本纸的 `.lp-sheet` **不在名单里**
       ⇒ 点「打印」出来是一张**空白页**(2026-10-17 首件检验单踩过同一个坑)。**这段必须写**。
     ⚠ 与首件检验单不同的是:巡线块数量可变(可增删),纸面可能**多页** ⇒ 不用 position:absolute
       (离屏定位的多页内容在打印分页时会被裁/叠),改为静态流式 + 上溯容器 display:block/overflow:visible,
       由浏览器按横向 A4 自然分页;块级 tr 加 break-inside:avoid,一块不会被劈两半。 -->
<style>
@media print {
  /* ⚠ index.html 给 html 预置了底色(防加载闪白)—— 打印时不清掉,纸面结束后的余量会被刷成灰底 */
  html,
  body,
  body.approval-printing {
    background: #fff !important;
  }
  body.approval-printing {
    margin: 0 !important;
  }
  body.approval-printing .portal {
    visibility: hidden;
    display: block !important;
    height: auto !important;
    padding: 0 !important;
  }
  body.approval-printing .topbar,
  body.approval-printing .leftnav,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .doc-select-rail,
  body.approval-printing .tools {
    display: none !important;
  }
  body.approval-printing .portal-body,
  body.approval-printing .portal-main,
  body.approval-printing .portal-content,
  body.approval-printing .panelx-list,
  body.approval-printing .approval-layout {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .lp-sheet {
    visibility: visible !important;
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    color: #000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .lp-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* 屏上靠 min-width 撑开 + 横向滚动;打印把表格收回纸宽,否则右半张被裁 */
  body.approval-printing .lp-grid-scroll {
    overflow: visible !important;
  }
  body.approval-printing .lp-grid {
    min-width: 0 !important;
    width: 100% !important;
    table-layout: fixed !important;
  }
  /* 12 列横排:字号收到 9px 一档,行高按内容自适应(不写死 height,否则长值被截) */
  body.approval-printing .lp-grid th,
  body.approval-printing .lp-grid td {
    font-size: 9px !important;
    padding: 1px 2px !important;
    height: auto !important;
    line-height: 1.25 !important;
  }
  body.approval-printing .lp-grid thead th {
    height: auto !important;
    font-size: 9px !important;
  }
  body.approval-printing .lp-prefix {
    font-size: 9px !important;
  }
  body.approval-printing .lp-title {
    font-size: 18px !important;
    letter-spacing: 2px !important;
  }
  body.approval-printing .lp-label,
  body.approval-printing .lp-val {
    font-size: 9.5px !important;
  }
  /* 输入框在纸上与表体同字号、去控件外观(值照常打印) */
  body.approval-printing .lp-cell .el-input__wrapper {
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
  }
  body.approval-printing .lp-cell .el-input__inner {
    font-size: 9px !important;
    height: auto !important;
    min-height: 0 !important;
    line-height: 1.25 !important;
    padding: 0 !important;
  }
  /* 日期控件的日历图标不是纸面内容 */
  body.approval-printing .lp-sheet .el-input__suffix,
  body.approval-printing .lp-sheet .el-input__prefix {
    display: none !important;
  }
  /* 占位提示词不该印在纸上 */
  body.approval-printing .lp-sheet input::placeholder {
    color: transparent !important;
  }
  /* 一块(4 子行)不拆页 */
  body.approval-printing .lp-row {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  /* 编辑控件不上纸(＋/×、行操作列) */
  body.approval-printing .no-print,
  body.approval-printing .lp-op {
    display: none !important;
  }
  /* 弹窗(append-to-body,不在 .portal 里)**不跟着 .portal 一起隐藏** ⇒ 开着弹窗按打印会把它印上去 */
  body.approval-printing .el-overlay,
  body.approval-printing .el-message-box__wrapper,
  body.approval-printing .el-message,
  body.approval-printing .el-picker__popper {
    display: none !important;
  }
  /* 12 列横排:纸样就是横向 A4 */
  @page {
    size: A4 landscape;
    margin: 8mm;
  }
}
</style>
