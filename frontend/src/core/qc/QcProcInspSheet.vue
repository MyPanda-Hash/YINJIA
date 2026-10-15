<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表 · **纵向表版**(一行一个检验项目)

       用户口径(2026-10-17 第六轮):
         「好的当前制程检验形式错误了,这个内容进行修改实现,当前这个修改一下内容实现,不需要那些外观什么的」
         「等下,表头内容可以不进行修改,当前针对检验结果处的格式进行修改即可」
       ⇒ 抬头(单据要素)与结论区**照旧不动**;只把「检验结果」那块从"表区分组横表(外观/尺寸/出货重量)"
         改成《生产相关品质检验.xlsx》制程检验页签第二块的**纵向表**:
           表头1:客户名称 | 产品编码 | 型号（mm） | 批号 | 检验人员：<值>(跨下面两列) | 产线常规功能性结果 | 结果判断
           表头2:以下检验要求自动填充出货检验计划表 | 以下检验方法自动填充出货检验计划表
           表体 :一行一个检验项目 —— 检验要求 | 检验方法 | 产线常规功能性结果 | 结果判断
         ⇒ 「表区」不再进纸面(数据里仍保留该列,由「带入检验项目」按检验类型写入);
           同批撤掉格数/测量值那套"一项一列"的渲染(字段仍在库里,列表页/报表照旧)。

       ⚠ 左四列(客户名称/产品编码/型号（mm）/批号)是**单据级**值(头字段),纵向合并铺满整个表体;
         其余四列是**明细级**值,一行一值。字段键与 yj_field 登记一致(型号→规格型号、批号→批次号)。
       ⚠ 检验要求/检验方法 = 多行域,`autosize{minRows:3,maxRows:12}`(**一打开就 3 行高**,随内容继续长高);
         2026-10-17 口径「当前超出当前行的内容框体要边长才行」+「将当前一开始的框体就变大一点」。
       ⚠ 手工新增的行:检验要求 填了内容而 检验项目 还空着时,顺手把同一段文字写进 检验项目
         (行的身份键,列表页按它显示;带入的行两者都有,不受影响)。
       ⚠ Excel 导出:版式在 `core/qc/qcProcInspExport.js`(纯函数 + 单测),本组件只做 aoa_to_sheet + writeFile,
         入口 = 面板右侧「文档输出 → 导出」→「导出 Excel（.xlsx）」(PanelxList 按面板码路由到 exportProcInspExcel)。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet">
    <!-- ① 标题 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('制程检验记录表') }}</div>
    </div>

    <!-- ② 抬头:一行 2 组「标签|值」(照旧不动) -->
    <table class="qr-head-table">
      <tbody>
        <tr v-for="(row, ri) in headRows" :key="'h' + ri">
          <template v-for="k in row" :key="k">
            <th class="qr-label">{{ tt(k) }}</th>
            <td class="qr-value">
              <el-date-picker
                v-if="editable && isDateKey(k)"
                v-model="head[k]"
                type="date"
                size="small"
                value-format="YYYY-MM-DD"
                class="qr-cell-input"
                :placeholder="tt('选择日期')"
                @change="emit('dirty')"
              />
              <el-input
                v-else-if="editable && !isLockedKey(k)"
                v-model="head[k]"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text">{{ head[k] || '' }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ③ 分区带「检验结果」+ 两个动作(新增检验项 / 带入检验项目) -->
    <div class="qr-band">
      <span class="qr-band-title">{{ tt('检验结果') }}</span>
      <span v-if="editable" class="qr-band-acts no-print">
        <span class="qr-band-act2" @click="addItem()">＋ {{ tt('新增检验项') }}</span>
        <span class="qr-band-act2" @click="emit('open-items')">⧉ {{ tt('带入检验项目') }}</span>
      </span>
    </div>

    <!-- ④ 纵向表:一行一个检验项目(左四列单据级、纵向合并) -->
    <table class="qr-grid">
      <colgroup>
        <col style="width: 118px" />
        <col style="width: 118px" />
        <col style="width: 104px" />
        <col style="width: 104px" />
        <col />
        <col />
        <col style="width: 150px" />
        <col style="width: 96px" />
        <col v-if="editable" style="width: 34px" />
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2" class="c-fixed">{{ tt('客户名称') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('产品编码') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('型号（mm）') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('批号') }}</th>
          <th colspan="2" class="c-inspector">
            <span class="qr-insp-label">{{ tt('检验人员') }}：</span>
            <el-input
              v-if="editable && !isLockedKey('检验员')"
              v-model="head['检验员']"
              size="small"
              class="qr-cell-input qr-insp-input"
              maxlength="50"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['检验员'] || '' }}</span>
          </th>
          <th rowspan="2" class="c-fixed">{{ tt('产线常规功能性结果') }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('结果判断') }}</th>
          <th v-if="editable" rowspan="2" class="c-op no-print"></th>
        </tr>
        <tr>
          <!-- 表头第二行 = 两个字段名(用户 2026-10-17 口径「把当前这两个框分别修改为检验要求和检验方法」);
               原来那两句"以下…自动填充出货检验计划表"挪进 tooltip,信息不丢、表头不啰嗦 -->
          <th class="c-sub" :title="tt('以下检验要求自动填充出货检验计划表')">{{ tt('检验要求') }}</th>
          <th class="c-sub" :title="tt('以下检验方法自动填充出货检验计划表')">{{ tt('检验方法') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in rowsForRender" :key="row ? uidOf(row) : 'empty'" :class="{ 'row-blank': !row }">
          <template v-if="ri === 0">
            <td v-for="c in headCols" :key="'f' + c.k" class="c-fixed" :rowspan="Math.max(items.length, 1)">
              <el-input
                v-if="editable && !isLockedKey(c.key)"
                v-model="head[c.key]"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text">{{ head[c.key] || '' }}</span>
            </td>
          </template>
          <template v-if="row">
            <td v-for="c in cellCols" :key="c.k" :class="c.cls">
              <el-input
                v-if="editable"
                :model-value="cellText(row, c.k)"
                size="small"
                class="qr-cell-input qr-cell-wrap"
                :type="c.multiline ? 'textarea' : undefined"
                :autosize="c.multiline ? { minRows: c.minRows || 1, maxRows: 12 } : undefined"
                :maxlength="c.max || 200"
                @input="setCell(row, c.k, $event)"
              />
              <span v-else class="qr-cell-text">{{ cellText(row, c.k) }}</span>
            </td>
            <td v-if="editable" class="c-op no-print">
              <span class="qr-row-del" :title="tt('删除本行')" @click="removeItem(row)">×</span>
            </td>
          </template>
          <template v-else>
            <td :colspan="emptyColspan" class="c-empty">
              {{ editable ? tt('暂无检验项，点右上「⧉带入检验项目」或「＋新增检验项」开始') : tt('暂无检验项') }}
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ 结论区(照旧不动) -->
    <table class="qr-foot-table">
      <tbody>
        <tr>
          <th class="qr-label">{{ tt('检验结论') }}</th>
          <td class="qr-value" colspan="3">
            <el-input
              v-if="editable"
              v-model="head['总结论']"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              class="qr-cell-input"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['总结论'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <th class="qr-label">{{ tt('处理意见') }}</th>
          <td class="qr-value" colspan="3">
            <el-input
              v-if="editable"
              v-model="head['处理方式']"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              class="qr-cell-input"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['处理方式'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <th class="qr-label">{{ tt('检验人') }}</th>
          <td class="qr-value">
            <el-input v-if="editable" v-model="head['检验员']" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ head['检验员'] || '' }}</span>
          </td>
          <th class="qr-label">{{ tt('审核人') }}</th>
          <td class="qr-value"><span class="qr-cell-text">{{ head['审核人'] || '' }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { tt } from '@/i18n'
import { ElMessageBox } from 'element-plus'
import { PROC_INSP_COLS, PROC_INSP_FOOT, buildProcInspExport } from '@/core/qc/qcProcInspExport.js'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'open-items'])

/** 明细里的「测量值1..10」= 上一版"一项一列 + 格数"留下的结构化格,纸面已不再渲染(值照存) */
const MEASURE = [
  '测量值1', '测量值2', '测量值3', '测量值4', '测量值5',
  '测量值6', '测量值7', '测量值8', '测量值9', '测量值10',
]

/** 左侧四列(单据级,纵向合并):纸面表头 → 头字段键(型号→规格型号、批号→批次号,与 yj_field 一致) */
const headCols = [
  { k: '客户名称', key: '客户名称' },
  { k: '产品编码', key: '产品编码' },
  { k: '型号（mm）', key: '规格型号' },
  { k: '批号', key: '批次号' },
]
/** 右侧四列(明细级,一行一值):照截图列序 —— 检验要求 | 检验方法 | 产线常规功能性结果 | 结果判断
 *  ⚠ multiline = 长文本格(自动长高的多行域,免得内容被单行框截断 —— 用户 2026-10-17 口径
 *    「当前超出当前行的内容框体要边长才行」);**minRows = 一打开就有几行高**(口径「将当前一开始的
 *    框体就变大一点」:长文本列默认 3 行,短结果列仍是单行);max = 物理列长度(检验要求 500 /
 *    检验方法 1000 / 产线常规功能性结果 200 / 结果判断 20),别写大了让用户填进库里存不下。 */
const cellCols = [
  { k: '检验要求', cls: 'c-req', multiline: true, minRows: 3, max: 500 },
  { k: '检验方法', cls: 'c-mtd', multiline: true, minRows: 3, max: 1000 },
  { k: '产线常规功能性结果', cls: 'c-func', max: 200 },
  { k: '结果判断', cls: 'c-verdict', max: 20 },
]

/** 本地版本号:明细数组/行可能被面板做了 raw 处理(非响应式),
 *  push/splice 后不会触发重渲染 —— 用它在组件内**强制刷新**(不依赖面板内部机制)。 */
const bump = ref(0)

/** 检验项明细行(一行一个检验项目) */
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

/** 渲染行:没有明细时铺一行"空表"(左四列照旧显示单据级值 + 一格提示) */
const rowsForRender = computed(() => (items.value.length ? items.value : [null]))
/** 空表提示行要跨的列数(右四列 + 操作列) */
const emptyColspan = computed(() => 4 + (props.editable ? 1 : 0))

/** 稳定的行键(v-for key 用;行是被 markRaw 的原对象,加个不可枚举的 uid) */
let uidSeq = 0
function uidOf(row) {
  if (!row.__uid) row.__uid = 'q' + (++uidSeq)
  return row.__uid
}

const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))
/** 抬头排除:左侧四列已在本表显示 + 已在表头格显示(检验员) + 已在结论区显示 + 系统/明细列 */
const HEAD_SKIP = new Set([
  ...headCols.map((c) => c.key),
  '单据状态', '处理方式', '表区', '行号', '检验项目', '检验要求',
  '检验方法', '检查频率', '检验仪器', '抽检量', '实测数值', ...MEASURE, '单项判定',
  '不合格应对措施', '不良数量', '产线常规功能性结果',
  '结果判断', '备注2', '备注', '总结论', '检验员', '审核人', '审核时间',
  '格数', '格数上限', '列数',
])
const headRows = computed(() => {
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName && !HEAD_SKIP.has(f.dataName))
    .map((f) => f.dataName)
  const rows = []
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2))
  return rows
})

/** 单元格显示值(文本列原样;空值显示空串) */
function cellText(row, k) {
  const v = row?.[k]
  return v === undefined || v === null ? '' : String(v)
}

/** 单元格录入(行是 raw 对象:直写 + bump 强制刷新) */
function setCell(row, k, v) {
  const val = String(v ?? '')
  row[k] = val
  // 手工新增的行:检验要求 填了、检验项目 还空着 ⇒ 顺手写进 检验项目(行的身份键,列表页按它显示)
  if (k === '检验要求' && !String(row['检验项目'] ?? '').trim() && val.trim()) row['检验项目'] = val
  bump.value++
  emit('dirty')
}

/** 下一个行号(新行排在末尾;列表页也按 行号 排) */
function nextRowNo() {
  return items.value.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0) + 1
}

/** 新增一行检验项目(纸面"一行一个检验项目";要哪些项也可以走「带入检验项目」) */
function addItem() {
  if (!props.editable) return
  ensureItems().push({
    表区: '',
    行号: nextRowNo(),
    检验项目: '',
    检验要求: '',
    检验方法: '',
    产线常规功能性结果: '',
    结果判断: '',
  })
  bump.value++
  emit('dirty')
}

/** 这一行填过东西没有(删行要不要弹确认看它) */
function rowHasContent(row) {
  if (!row) return false
  for (const k of ['检验要求', '检验方法', '产线常规功能性结果', '结果判断', '检验项目']) {
    if (String(row[k] ?? '').trim()) return true
  }
  return false
}

/** 删掉一行;填过内容的先弹确认(删了就没了) */
async function removeItem(row) {
  if (!props.editable || !row) return
  if (rowHasContent(row)) {
    try {
      await ElMessageBox.confirm(
        tt('删除本行将清空已填内容，确定删除吗？'), tt('删除本行'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
      )
    } catch { return /* 取消 */ }
  }
  const arr = ensureItems()
  const i = arr.indexOf(row)
  if (i >= 0) { arr.splice(i, 1); bump.value++; emit('dirty') }
}

function isDateKey(k) {
  const t = fieldMap.value.get(k)?.dataType
  return t === '日期' || t === '日期时间'
}
/** 只读判定:**登记过**且明确 editable=false 才算锁定(未登记 ≠ 锁定) */
function isLockedKey(k) {
  const f = fieldMap.value.get(k)
  return !!f && (f.editable === false || f.editable === 0)
}

/**
 * 导出 Excel(.xlsx)—— 导出的是**当前这张纸**(制程检验记录表),不是列表页那套数据导出。
 * 版式(标题/抬头/表头两行/左侧四列合并/结论区)由 core/qc/qcProcInspExport.js 给(纯函数 + 单测),
 * 这里只做 xlsx 的 aoa_to_sheet + 样式 + writeFile(照 QcCatalogSheet 的写法)。
 * 入口:面板右侧「文档输出 → 导出 Excel」(PanelxList.exportSheetExcel 按面板码路由到本函数)。
 */
async function exportProcInspExcel() {
  const XLSX = await import('xlsx')
  const name = String(props.head?.['单据编号'] || props.head?.['编号'] || '制程检验记录表')
  const pairs = headRows.value.map((row) => row.map((k) => ({ label: tt(k), value: String(props.head?.[k] ?? '') })))
  const { aoa, cols, merges, headerRow1, headerRow2 } = buildProcInspExport({
    title: tt('制程检验记录表'),
    subtitle: `惠州市银嘉环保科技有限公司　　${tt('单据编号')}：${name}　　${tt('单据状态')}：${tt(String(props.head?.['单据状态'] || ''))}`,
    headPairs: pairs,
    head: props.head || {},
    rows: items.value,
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = cols
  ws['!merges'] = merges
  const style = (r, c, s) => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.s = s }
  // ⚠ 下面这些 `.s` 样式**落不进 .xlsx**(社区版 xlsx 0.18.5 不写单元格样式,见 qcProcInspExport.js 头部取证):
  //   留着是为了将来换 xlsx-js-style 时直接可用,别指望现在导出的文件带框线/底色/自动换行。
  const headFill = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: 'DCE9F5' } } }
  const labelFill = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'DCE9F5' } } }
  const wrap = { alignment: { vertical: 'top', wrapText: true } }
  style(0, 0, { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } })
  style(1, 0, { font: { sz: 10 }, alignment: { horizontal: 'left' } })
  // 抬头标签/值
  for (let r = 3; r < headerRow1 - 1; r++) {
    if (!aoa[r] || !aoa[r].length) continue
    style(r, 0, labelFill); style(r, 4, labelFill)
    style(r, 1, { alignment: { horizontal: 'left' } }); style(r, 5, { alignment: { horizontal: 'left' } })
  }
  // 表头两行 + 左侧四列(纵向合并:样式落在合并区左上角)
  for (let c = 0; c < PROC_INSP_COLS.length; c++) {
    style(headerRow2, c, headFill)
    if (c !== 4 && c !== 5) style(headerRow1, c, headFill)
  }
  style(headerRow1, 4, { ...headFill, alignment: { horizontal: 'left', vertical: 'center' } })
  // 数据区:长文本自动换行
  for (let r = headerRow2 + 1; r < headerRow2 + 1 + Math.max(items.value.length, 1); r++) {
    for (const c of [4, 5]) style(r, c, wrap)
  }
  // 结论区
  for (let r = aoa.length - PROC_INSP_FOOT.length; r < aoa.length; r++) {
    style(r, 0, labelFill)
    if (PROC_INSP_FOOT[r - (aoa.length - PROC_INSP_FOOT.length)]?.secondLabel) style(r, 4, labelFill)
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, tt('制程检验记录表').slice(0, 28))
  XLSX.writeFile(wb, `${tt('制程检验记录表')}-${name}.xlsx`)
}

defineExpose({ exportProcInspExcel })
</script>

<style scoped>
.qr-sheet {
  background: #fff;
  border: 1px solid #d7dce5;
  padding: 10px 12px 14px;
  margin: 0 6px 8px;
}
.qr-titlerow {
  text-align: center;
  margin-bottom: 10px;
}
.qr-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #1f4e79;
}
/* 抬头 / 结论区 */
.qr-head-table,
.qr-foot-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  table-layout: fixed;
}
.qr-label {
  border: 1px solid #b8cfe6;
  background: #dce9f5;
  font-weight: 600;
  color: #1f4e79;
  text-align: center;
  padding: 3px 6px;
  width: 96px;
  white-space: nowrap;
}
.qr-value {
  border: 1px solid #b8cfe6;
  padding: 1px 4px;
  text-align: left;
  background: #fff;
}
/* 分区带 */
.qr-band {
  position: relative;
  margin-top: -1px;
  border: 1px solid #b8cfe6;
  background: #cfe0f2;
  text-align: center;
  padding: 3px 6px;
  font-size: 13px;
  font-weight: 700;
  color: #1f4e79;
}
.qr-band-acts {
  position: absolute;
  right: 8px;
  top: 3px;
}
.qr-band-act2 {
  margin-left: 12px;
  font-size: 12px;
  font-weight: 400;
  color: #2b6cb0;
  cursor: pointer;
}
.qr-band-act2:hover {
  text-decoration: underline;
}
/* 纵向表 */
.qr-grid {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
  margin-top: -1px;
}
.qr-grid th,
.qr-grid td {
  border: 1px solid #b8cfe6;
  padding: 3px 4px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
.qr-grid thead th {
  background: #dce9f5;
  color: #1f4e79;
  font-weight: 600;
}
.qr-grid th.c-fixed {
  background: #dce9f5;
}
.qr-grid td.c-fixed {
  background: #fbfdff;
  font-weight: 500;
}
/* 表头第二行:两句"自动填充"说明 */
.qr-grid th.c-sub {
  background: #e8f1fa;
  font-weight: 400;
  color: #1f4e79;
}
/* 检验人员格(跨 检验要求 + 检验方法 两列) */
.qr-grid th.c-inspector {
  text-align: left;
  padding: 2px 6px;
}
.qr-insp-label {
  color: #1f4e79;
}
.qr-insp-input {
  width: 60%;
  min-width: 120px;
}
/* 明细四列:要求/方法左对齐(文字长),两个结果列居中 */
.qr-grid td.c-req,
.qr-grid td.c-mtd {
  text-align: left;
  vertical-align: top;
  line-height: 17px;
}
.qr-grid td.c-func,
.qr-grid td.c-verdict {
  text-align: center;
}
.c-op {
  width: 34px;
}
.qr-row-del {
  font-weight: 700;
  color: #f56c6c;
  cursor: pointer;
  padding: 0 2px;
}
.row-blank td.c-empty {
  color: #8a94a0;
  padding: 12px 0;
  text-align: center;
}
/* 输入控件:方角、贴合单元格(以格子边框为唯一框) */
.qr-cell-input :deep(.el-input__wrapper),
.qr-cell-input :deep(.el-textarea__inner) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}
.qr-cell-input :deep(.el-input__wrapper) {
  padding: 0 2px;
}
.qr-cell-input :deep(.el-input__wrapper:hover),
.qr-cell-input :deep(.el-input__wrapper.is-focus),
.qr-cell-input :deep(.el-textarea__inner:hover),
.qr-cell-input :deep(.el-textarea__inner:focus) {
  box-shadow: none;
  background: #f2f8ff;
}
.qr-cell-input :deep(.el-input__inner) {
  height: 20px;
  line-height: 20px;
}
.qr-grid td.c-req .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-mtd .qr-cell-input :deep(.el-input__inner) {
  text-align: left;
}
.qr-grid td.c-func .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-verdict .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-fixed .qr-cell-input :deep(.el-input__inner) {
  text-align: center;
}
.qr-cell-wrap :deep(.el-textarea__inner) {
  text-align: left;
  padding: 2px;
  line-height: 18px;
  resize: none;
  font-family: inherit;
}
.qr-cell-text {
  display: inline-block;
  min-height: 18px;
}
@media print {
  .no-print {
    display: none !important;
  }
}
</style>
