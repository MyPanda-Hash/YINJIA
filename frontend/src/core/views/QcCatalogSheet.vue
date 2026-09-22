<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料品质·检验目录(QC_CATALOG)—— 纸张式控制列表(**不可手工编辑**,只读呈现)
       数据来源:检验单生单(暂收单→来料检验单)时按明细物料自动生成,检测物料类别取自商品档案「所属类别」;
       数量=检验单送检数量+单位;批次号靠回填;每行带 检验单号 与 检验数据记录单号(数据挂靠键)。
       行上动作:「完成」(校验挂靠单据已审批→已完成检验+是否合格)/「修改」(回弹状态并写修改记录)/
                 「删除记录」(挂靠单据还在时拒绝)。
       呈现方式与项目进度查询同族:纸张 + 右侧竖排操作栏(PanelxList approval-layout 提供)。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="catalog-sheet">
    <!-- ① 标题 -->
    <div class="cs-titlerow">
      <div class="cs-title">{{ tt('检验目录') }}</div>
    </div>

    <!-- ② 控制表(两行表头:物料层三列各有列名,检验记录目录跨其后六列) -->
    <div class="cs-scroll">
      <table class="cs-table">
        <thead>
          <tr>
            <th class="c-cat" rowspan="2">{{ tt('检测物料类别') }}</th>
            <th class="c-mat" rowspan="2">{{ tt('物料名称') }}</th>
            <th class="c-code" rowspan="2">{{ tt('物料编码') }}</th>
            <th class="c-group" :colspan="catalogCols.length">{{ tt('检验记录目录') }}</th>
            <!-- 操作列表头:列内是行按钮,表头无内容 —— 去边框/底色(视觉上不出现空框),保留单元格以稳定列宽 -->
            <th class="c-op c-op-plain" :rowspan="2"></th>
          </tr>
          <tr>
            <th v-for="c in catalogCols" :key="c.key" :class="colClass(c.key)">{{ tt(c.label) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in items" :key="row.id ?? ('r' + i)">
            <!-- 检测物料类别(第1类):同类别合并;类别为空不归纳(单独成行) -->
            <td v-if="isGroupHead(i, K.CAT)" class="c-cat" :rowspan="groupSpan(i, K.CAT)">
              <span class="cs-cell-text cs-block">{{ row[K.CAT] || '—' }}</span>
            </td>
            <!-- 物料名称(第2类):同「名称+编码」合并 -->
            <td v-if="isMatHead(i)" class="c-mat" :rowspan="matSpan(i)">
              <span class="cs-cell-text cs-block">{{ row[K.MAT] || '' }}</span>
            </td>
            <td class="c-code">{{ row[K.CODE] || '' }}</td>
            <td class="c-batch">{{ row[K.BATCH] || '' }}</td>
            <td class="c-qty">{{ row[K.QTY] || '' }}</td>
            <td class="c-status">
              <span class="cs-status-tag" :class="row[K.STATUS] === QC_STATUS_DONE ? 'done' : 'doing'">
                {{ row[K.STATUS] || '—' }}
              </span>
            </td>
            <td class="c-ok">{{ row[K.OK] || '' }}</td>
            <!-- 检验单号:查看详情 + 跳转 -->
            <td class="c-no">
              <span v-if="row[K.INSP]" class="cs-no-cell">
                <span class="cs-no-text">{{ row[K.INSP] }}</span>
                <span class="cs-link no-print" :title="tt('查看该检验单详情')" @click.stop="openDoc(row[K.INSP], 'QC_INSP')">📄</span>
                <span class="cs-link no-print" :title="tt('跳转到该检验单')" @click.stop="gotoDoc(row[K.INSP], 'QC_INSP')">↗</span>
              </span>
              <span v-else class="cs-cell-text">—</span>
            </td>
            <!-- 检验数据记录单号(数据挂靠键):查看详情 + 跳转 -->
            <td class="c-no">
              <span v-if="row[K.REC]" class="cs-no-cell">
                <span class="cs-no-text">{{ row[K.REC] }}</span>
                <span class="cs-link no-print" :title="tt('查看该检验数据记录详情')" @click.stop="openDoc(row[K.REC], 'QC_INSP_REC')">📄</span>
                <span class="cs-link no-print" :title="tt('跳转到该检验数据记录')" @click.stop="gotoDoc(row[K.REC], 'QC_INSP_REC')">↗</span>
              </span>
              <span v-else class="cs-cell-text">—</span>
            </td>
            <!-- 行操作:完成检验 / 修改(两钮常在,不适用时置灰并说明)/ 删除记录 -->
            <td class="c-op no-print">
              <span
                class="cs-act"
                :class="{ disabled: row[K.STATUS] === QC_STATUS_DONE || !row[K.INSP] || !row[K.REC] }"
                :title="row[K.STATUS] === QC_STATUS_DONE
                  ? tt('该行已完成检验')
                  : tt('完成检验（需关联的检验单与检验数据记录都已审批）')"
                @click.stop="openComplete(row)"
              >{{ tt('完成检验') }}</span>
              <span
                class="cs-act warn"
                :class="{ disabled: row[K.STATUS] !== QC_STATUS_DONE }"
                :title="row[K.STATUS] === QC_STATUS_DONE
                  ? tt('取消完成并回弹为正在检验中（之后才可反审核挂靠单据）')
                  : tt('仅「已完成检验」的行可取消完成')"
                @click.stop="row[K.STATUS] === QC_STATUS_DONE && doReopen(row)"
              >{{ tt('修改') }}</span>
              <span class="cs-act danger" :title="tt('删除该目录记录（需先删除挂靠的检验单与检验数据记录）')" @click.stop="doDelete(row)">✕</span>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td :colspan="catalogCols.length + 4" class="cs-empty">{{ tt('暂无检验记录，暂收单生单生成检验单后自动带入') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ③ 页签脚注(原表第16行)+ 只读说明(「修改记录」入口已移至右侧竖排按钮栏) -->
    <div class="cs-note">
      <div>{{ tt('输入批次号后点击批次号可查阅详细或者新增检验') }}</div>
      <div class="cs-note-sub">{{ tt('目录记录由检验单生单自动生成、不可手工修改；状态变更走行上的「完成 / 修改」。') }}</div>
    </div>

    <!-- 完成弹窗:确认 + 是否合格 -->
    <el-dialog v-model="completeVisible" :title="tt('完成检验')" width="420px" append-to-body>
      <div class="csd-head">
        <span>{{ tt('物料') }}：<b>{{ completeRow && completeRow[K.MAT] }}</b></span>
        <span>{{ tt('批次号') }}：<b>{{ completeRow && completeRow[K.BATCH] }}</b></span>
      </div>
      <div class="cs-dlg-row">
        <span class="cs-dlg-label">{{ tt('是否合格') }}</span>
        <el-select v-model="completeQualified" clearable size="default" style="width: 200px" :placeholder="tt('请选择')">
          <el-option v-for="o in qualifiedOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>
      <div class="csd-tip">{{ tt('完成前会校验：关联的检验单已审核、检验数据记录已审批（归档）。') }}</div>
      <template #footer>
        <el-button @click="completeVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="acting" @click="doComplete">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>

    <!-- 查看关联单据详情(只读渲染) -->
    <el-dialog v-model="docVisible" :title="docTitle" width="920px" append-to-body>
      <div v-if="docLoading" class="csd-empty">{{ tt('查询中…') }}</div>
      <template v-else-if="docDetail">
        <el-table :data="docDetail.head" size="small" border max-height="320" class="csd-kv">
          <el-table-column prop="label" :label="tt('项目')" width="160" />
          <el-table-column prop="value" :label="tt('内容')" min-width="240" show-overflow-tooltip />
        </el-table>
        <template v-if="docDetail.detailFields.length">
          <div class="csd-sec">{{ tt('明细') }}</div>
          <el-table :data="docDetail.rows" size="small" border max-height="280">
            <el-table-column type="index" :label="tt('序号')" width="52" align="center" />
            <el-table-column v-for="f in docDetail.detailFields" :key="f" :prop="f" :label="tt(f)" min-width="110" show-overflow-tooltip />
          </el-table>
        </template>
      </template>
      <template #footer>
        <el-button @click="docVisible = false">{{ tt('关闭') }}</el-button>
        <el-button v-if="docNo" type="primary" @click="gotoDoc(docNo, docPanel)">{{ tt('跳转到该单据') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import {
  QC_CATALOG_COLUMNS,
  QC_STATUS_DOING,
  QC_STATUS_DONE,
  exportHeaderRow,
  exportRow,
} from '@core/qc/qcCatalogColumns'

/** 数据键(与 qc_catalog_detail 物理列同名,见 qcCatalogColumns.js) */
const K = Object.freeze({
  CAT: '检测物料类别',
  MAT: '物料名称',
  CODE: '物料编码',
  BATCH: '批次号',
  QTY: '数量',
  STATUS: '检验状态',
  OK: '是否合格',
  INSP: '检验单号',
  REC: '检验数据记录单号',
})

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

const engine = usePanelRuntime()
const router = useRouter()

/** 表体列(第3类 检验记录目录 的叶子列) */
const catalogCols = computed(() => QC_CATALOG_COLUMNS.filter((c) => c.group === '检验记录目录'))

/** 目录行(来自当前目录单 detail.items) */
const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function optionsOf(key) {
  const f = fieldMap.value.get(key)
  return (f?.options || []).map((o) => (typeof o === 'object'
    ? { value: o.value ?? o.label, label: o.label ?? o.value }
    : { value: o, label: o }))
}
/** 是否合格候选(字典值=中文数据键) */
const qualifiedOptions = computed(() => optionsOf(K.OK))

/** 分组合并:检测物料类别(空值不归纳 —— 每行各自渲染单元格,避免与 groupSpan 不自洽导致整行错列) */
function isGroupHead(i, key) {
  const v = items.value[i]?.[key]
  if (!v) return true                 // 空类别:本行自成一行(必须渲染单元格)
  if (i <= 0) return true
  return v !== items.value[i - 1]?.[key]
}
function groupSpan(i, key) {
  if (!isGroupHead(i, key)) return 0
  const v = items.value[i]?.[key]
  if (!v) return 1
  let n = 1
  while (i + n < items.value.length && items.value[i + n]?.[key] === v) n++
  return n
}
/** 物料层:按「物料名称 + 物料编码」合并;两者皆空时每行自成一行(同空值不自洽会错列) */
function matKeyOf(row) {
  return [row?.[K.MAT] || '', row?.[K.CODE] || ''].join('|')
}
function isMatHead(i) {
  if (i <= 0) return true
  const k = matKeyOf(items.value[i])
  if (k === '|') return true
  return k !== matKeyOf(items.value[i - 1])
}
function matSpan(i) {
  if (!isMatHead(i)) return 0
  const k = matKeyOf(items.value[i])
  if (k === '|') return 1
  let n = 1
  while (i + n < items.value.length && matKeyOf(items.value[i + n]) === k) n++
  return n
}
function colClass(key) {
  return {
    批次号: 'c-batch',
    数量: 'c-qty',
    检验状态: 'c-status',
    是否合格: 'c-ok',
    检验单号: 'c-no',
    检验数据记录单号: 'c-no',
  }[key] || 'c-no'
}

// ---------- 行动作:完成 / 修改 / 删除记录 ----------
const acting = ref(false)
const completeVisible = ref(false)
const completeRow = ref(null)
const completeQualified = ref('')

function openComplete(row) {
  if (!row?.[K.INSP] || !row?.[K.REC]) {
    return ElMessage.warning(tt('该目录行缺少关联的检验单或检验数据记录，无法完成'))
  }
  completeRow.value = row
  completeQualified.value = row[K.OK] || ''
  completeVisible.value = true
}

async function callCatalog(buttonName, payload) {
  acting.value = true
  try {
    const res = await engine.callButton({
      panelCode: 'QC_CATALOG',
      buttonName,
      formData: { 编号: props.head['单据编号'], ...payload },
      buttonParam: {},
    })
    await reloadDoc()
    return res
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('操作失败'))
    return null
  } finally {
    acting.value = false
  }
}

async function doComplete() {
  const row = completeRow.value
  if (!row) return
  const res = await callCatalog('完成', { id: row.id, 是否合格: completeQualified.value })
  if (!res) return
  completeVisible.value = false
  ElMessage.success(tt('已标记为已完成检验'))
}

async function doReopen(row) {
  try {
    await ElMessageBox.confirm(
      tt('取消完成后该目录行回到「正在检验中」，之后才可反审核挂靠的检验单与检验数据记录。确定取消完成吗？'),
      tt('取消完成'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  const res = await callCatalog('修改', { id: row.id })
  if (!res) return
  ElMessage.success(tt('已取消完成（已写入修改记录）'))
}

async function doDelete(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除该目录记录前，需先删除挂靠的检验单与检验数据记录。确定删除吗？'),
      tt('删除目录记录'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  const res = await callCatalog('删除记录', { id: row.id })
  if (!res) return
  ElMessage.success(tt('已删除该目录记录'))
}

// ---------- 查看/跳转关联单据 ----------
const docVisible = ref(false)
const docLoading = ref(false)
const docDetail = ref(null)
const docTitle = ref('')
const docNo = ref('')
const docPanel = ref('')

async function openDoc(no, panel) {
  if (!no) return
  docNo.value = no
  docPanel.value = panel
  docTitle.value = (panel === 'QC_INSP_REC' ? tt('检验数据记录') : tt('来料检验单')) + ' ' + no
  docDetail.value = null
  docVisible.value = true
  docLoading.value = true
  try {
    const fd = await engine.getFormDescriptor({ panelCode: panel, code: no })
    const head = fd?.data || {}
    const tabs = fd?.detail?.tabs || []
    const tab = tabs[0] || { fields: [] }
    docDetail.value = {
      head: Object.entries(head)
        .filter(([k, v]) => !['saved', '编号'].includes(k) && v !== null && v !== '' && v !== undefined)
        .map(([k, v]) => ({ label: k, value: String(v) })),
      detailFields: (tab.fields || []).map((f) => f.dataName || f.code),
      rows: fd?.detailData?.[tab.key || 'items'] || [],
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  } finally {
    docLoading.value = false
  }
}

/** 跳转到目标面板并定位该单据(PanelxList 支持 ?docNo= 定位) */
function gotoDoc(no, panel) {
  if (!no) return
  docVisible.value = false
  router.push({ path: `/panelx/list/${panel}`, query: { docNo: no } })
}

/** 动作后重取当前目录单(状态/是否合格/挂靠单号都已变化) */
async function reloadDoc() {
  const no = props.head['单据编号']
  if (!no) return
  try {
    const fd = await engine.getFormDescriptor({ panelCode: 'QC_CATALOG', code: no })
    const d = fd?.data || {}
    for (const [k, v] of Object.entries(d)) {
      if (k === 'detail') continue
      props.head[k] = v
    }
    const rows = fd?.detailData?.items || []
    if (props.head.detail && Array.isArray(props.head.detail.items)) props.head.detail.items = rows
    else props.head.detail = { items: rows }
  } catch { /* 重取失败保持现状 */ }
}

/** 导出 Excel:标题 + 列头 + 全部目录行(与 qcCatalogColumns 同源) */
async function exportCatalogExcel() {
  const XLSX = await import('xlsx')
  const rows = items.value || []
  const title = '检验目录'
  const header = exportHeaderRow()
  const aoa = [[title], [], header, ...rows.map((r) => exportRow(r))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = QC_CATALOG_COLUMNS.map((c) => ({ wch: c.width }))
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: QC_CATALOG_COLUMNS.length - 1 } }]
  const c0 = ws[{ r: 0, c: 0 }]
  if (c0) c0.s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } }
  for (let c = 0; c < header.length; c++) {
    const cell = ws[{ r: 2, c }]
    if (cell) cell.s = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true }, fill: { fgColor: { rgb: 'D9ECFB' } } }
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title)
  XLSX.writeFile(wb, `${title}-${props.head['单据编号'] || '导出'}.xlsx`)
}

defineExpose({ exportCatalogExcel })
</script>

<style scoped>
/* ═══ 纸张主体 ═══ */
.catalog-sheet {
  width: calc(100vw - 300px);
  min-width: 900px;
  max-width: 1500px;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 13px;
  color: #222;
}
.cs-titlerow {
  border-bottom: 1px solid #8a8a8a;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cs-title {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 28px;
  font-weight: 600;
  color: #1f5fa8;
  letter-spacing: 4px;
}
/* ═══ 控制表 ═══ */
.cs-scroll {
  overflow: auto;
  max-height: calc(100vh - 300px);
  min-height: 220px;
}
.cs-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  table-layout: fixed;
}
.cs-table th,
.cs-table td {
  border: 1px solid #9a9a9a;
  padding: 3px 5px;
  vertical-align: middle;
  font-size: 12.5px;
  word-break: break-all;
}
.cs-table th {
  position: sticky;
  z-index: 3;
  background: #b9dbf8;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
}
.cs-table thead tr:nth-child(1) th { top: 0; }
.cs-table thead tr:nth-child(2) th { top: 26px; }
.cs-table td { background: #fff; height: 24px; }
.cs-table tr:hover td { background: #f7fbff; }
.cs-table td.c-cat { background: #d9ecfb; color: #1f5fa8; text-align: center; }
.cs-table td.c-mat { background: #eaf4fe; color: #1f5fa8; text-align: center; }
.cs-block { display: inline-block; width: 100%; font-weight: 600; }
.cs-cell-text { display: inline-block; width: 100%; }
.c-cat { width: 110px; }
.c-mat { width: 130px; }
.c-code { width: 110px; }
.c-batch { width: 100px; }
.c-qty { width: 80px; }
.c-status { width: 104px; text-align: center; }
.c-ok { width: 76px; text-align: center; }
.c-no { width: 150px; }
.c-op { width: 132px; text-align: center; }
/* 操作列表头:无内容 → 无框无底色(用户口径:把没数据的空框去掉),仍占列以稳住固定布局 */
.cs-table th.c-op-plain {
  border: none;
  background: transparent;
}
.cs-status-tag {
  display: inline-block; padding: 1px 7px; border-radius: 9px; font-size: 12px; line-height: 18px; white-space: nowrap;
}
.cs-status-tag.doing { background: #eaf4fe; color: #1677ff; border: 1px solid #b9dcff; }
.cs-status-tag.done { background: #e8f7ee; color: #1a7f37; border: 1px solid #b7e3c6; }
.cs-no-cell { display: flex; align-items: center; gap: 2px; }
.cs-no-text { flex: 1; word-break: break-all; }
.cs-link { flex: none; cursor: pointer; font-size: 12px; opacity: 0.45; }
.cs-link:hover { opacity: 1; }
.cs-act {
  display: inline-block; margin: 0 2px; padding: 0 6px; border-radius: 3px; font-size: 12px;
  line-height: 20px; cursor: pointer; color: #1c4f8a; background: #f4f9ff; border: 1px solid #8fb4e0;
}
.cs-act:hover { background: #e8f2ff; }
.cs-act.warn { color: #b26a00; background: #fff8ee; border-color: #ffd9a8; }
.cs-act.danger { color: #c0392b; background: #fff5f5; border-color: #f0b4ae; }
.cs-act.disabled { opacity: 0.45; cursor: not-allowed; }
.c-op .cs-act { margin: 1px 1px; padding: 0 4px; font-size: 11.5px; }
/* ═══ 脚注(原表第16行 + 只读说明) ═══ */
.cs-note {
  border-top: 1px solid #8a8a8a; padding: 6px 12px; background: #f7fbff; color: #5a6b7d; font-size: 12.5px;
}
.cs-note-sub { margin-top: 2px; font-size: 11.5px; color: #8a97a6; }
.cs-empty { text-align: center; color: #98a4b3; padding: 18px 0 !important; }
/* ═══ 弹窗 ═══ */
.cs-dlg-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.cs-dlg-label { width: 100px; text-align: right; color: #333; font-weight: 600; }
.csd-head { display: flex; gap: 18px; align-items: baseline; margin-bottom: 8px; font-size: 13px; color: #303133; }
.csd-tip { font-size: 12px; color: #8a97a6; line-height: 1.6; }
.csd-empty { padding: 16px 4px; color: #909399; font-size: 13px; }
.csd-sec { margin: 10px 0 6px; font-weight: 600; color: #1f5fa8; font-size: 13px; border-left: 3px solid #b9dbf8; padding-left: 8px; }
.csd-kv :deep(.el-table__cell) { font-size: 12px; }
</style>

<!-- 打印整张:只保留纸张(与项目进度查询/检验数据记录同口径) -->
<style>
@media print {
  body.approval-printing .portal { visibility: hidden; }
  body.approval-printing .topbar,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .tools { display: none !important; }
  body.approval-printing .portal-body,
  body.approval-printing .portal-main,
  body.approval-printing .portal-content,
  body.approval-printing .panelx-list,
  body.approval-printing .approval-layout {
    display: block !important; height: auto !important; overflow: visible !important;
    padding-right: 0 !important; margin: 0 !important;
  }
  body.approval-printing .catalog-sheet {
    visibility: visible !important; position: absolute !important; top: 0 !important; left: 0 !important;
    width: 100% !important; max-width: none !important; margin: 0 !important;
    border: 1px solid #8a8a8a !important; box-shadow: none !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  body.approval-printing .catalog-sheet * {
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  body.approval-printing .cs-scroll { overflow: visible !important; max-height: none !important; }
  body.approval-printing .cs-table { min-width: 100% !important; }
  body.approval-printing .cs-table th, body.approval-printing .cs-table td {
    font-size: 10px !important; padding: 1px 2px !important; height: auto !important;
  }
  @page { margin: 8mm; }
}
</style>
