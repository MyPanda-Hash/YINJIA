<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料品质·检验目录(QC_CATALOG)—— 纸张式控制列表
       实现方式与「项目进度查询」(ProgressControlSheet/RD_PROGRESS)完全一致:
       纸张外框 + 大标题 + 主从大表(分组列 rowspan 合并 + 格内直编 + ＋/× 行操作),
       右侧竖排操作栏由 PanelxList 的 approval-layout 统一提供(保存等),本组件只管纸面。
       表格一比一照《品质资料 2026.09.19.xlsx》「检验目录」页签:
       第1类 检测物料类别 | 第2类 物料名称 | 第3类 检验记录目录(批次号|数量|检验状态|是否合格)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="catalog-sheet">
    <!-- ① 标题 -->
    <div class="cs-titlerow">
      <div class="cs-title">{{ tt('检验目录') }}</div>
    </div>

    <!-- ② 控制表 -->
    <div class="cs-scroll">
      <table class="cs-table">
        <thead>
          <tr>
            <th class="c-cat">{{ tt('第1类') }}</th>
            <th class="c-mat">{{ tt('第2类') }}</th>
            <th class="c-group" colspan="4">{{ tt('第3类') }}</th>
          </tr>
          <tr>
            <th class="c-cat" rowspan="2">{{ tt('检测物料类别') }}</th>
            <th class="c-mat" rowspan="2">{{ tt('物料名称') }}</th>
            <th class="c-group" colspan="4">{{ tt('检验记录目录') }}</th>
          </tr>
          <tr>
            <th class="c-batch">{{ tt('批次号') }}</th>
            <th class="c-qty">{{ tt('数量') }}</th>
            <th class="c-status">{{ tt('检验状态') }}</th>
            <th class="c-ok">{{ tt('是否合格') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
            <!-- 检测物料类别(第1类):同类别单元格合并,编辑即整块联动 -->
            <td v-if="isGroupHead(i, K.CAT)" class="c-cat" :rowspan="groupSpan(i, K.CAT)">
              <el-input
                v-if="editable"
                v-model="row[K.CAT]"
                size="small"
                class="cs-cell-input"
                maxlength="100"
                @input="changeGroupValue(i, K.CAT, row[K.CAT])"
              />
              <span v-else class="cs-cell-text cs-block">{{ row[K.CAT] || '' }}</span>
            </td>
            <!-- 物料名称(第2类):同物料单元格合并,编辑即整块联动 -->
            <td v-if="isGroupHead(i, K.MAT)" class="c-mat" :rowspan="groupSpan(i, K.MAT)">
              <el-input
                v-if="editable"
                v-model="row[K.MAT]"
                size="small"
                class="cs-cell-input"
                maxlength="200"
                @input="changeGroupValue(i, K.MAT, row[K.MAT])"
              />
              <span v-else class="cs-cell-text cs-block">{{ row[K.MAT] || '' }}</span>
            </td>
            <!-- 批次号:点 📄 可查阅该批次检验单或新增检验(原表页签脚注) -->
            <td class="c-batch">
              <div class="cs-batch-cell">
                <el-input
                  v-if="editable"
                  v-model="row[K.BATCH]"
                  size="small"
                  class="cs-cell-input"
                  maxlength="100"
                  @input="emit('dirty')"
                />
                <span v-else class="cs-cell-text">{{ row[K.BATCH] || '' }}</span>
                <span
                  v-if="row[K.BATCH]"
                  class="cs-batch-link no-print"
                  :title="tt('点击批次号可查阅详细或者新增检验')"
                  @click.stop="openInspection(row)"
                >📄</span>
              </div>
            </td>
            <td class="c-qty">
              <el-input
                v-if="editable"
                v-model="row[K.QTY]"
                size="small"
                class="cs-cell-input"
                maxlength="50"
                @input="emit('dirty')"
              />
              <span v-else class="cs-cell-text">{{ row[K.QTY] || '' }}</span>
            </td>
            <td class="c-status">
              <el-select
                v-if="editable"
                v-model="row[K.STATUS]"
                size="small"
                clearable
                class="cs-cell-input"
                :placeholder="tt('请选择')"
                @change="emit('dirty')"
              >
                <el-option v-for="o in selectOptions(K.STATUS)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="cs-cell-text">{{ row[K.STATUS] || '' }}</span>
            </td>
            <td class="c-ok">
              <el-select
                v-if="editable"
                v-model="row[K.OK]"
                size="small"
                clearable
                class="cs-cell-input"
                :placeholder="tt('请选择')"
                @change="emit('dirty')"
              >
                <el-option v-for="o in selectOptions(K.OK)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="cs-cell-text">{{ row[K.OK] || '' }}</span>
            </td>
            <td v-if="editable" class="c-op">
              <span class="cs-addrow" :title="tt('在该批次后新增一行')" @click="insertAfter(i)">＋</span>
              <span class="cs-del" :title="tt('删除该批次')" @click="removeItem(i)">×</span>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td :colspan="editable ? 7 : 6" class="cs-empty">{{ tt('暂无检验批次，点击下方按钮新增') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ③ 页签脚注(原表第16行:输入批次号后点击批次号可查阅详细或者新增检验) -->
    <div class="cs-note">{{ tt('输入批次号后点击批次号可查阅详细或者新增检验') }}</div>

    <!-- ④ 增行条 -->
    <div v-if="editable" class="cs-addbar">
      <div class="cs-add" @click="openAdd">＋ {{ tt('新增物料批次') }}</div>
    </div>

    <!-- 新增物料批次弹窗(三个必填项一次填齐,免得保存时才被校验拦下) -->
    <el-dialog v-model="addVisible" :title="tt('新增物料批次')" width="440px" append-to-body>
      <div class="cs-dlg-row">
        <span class="cs-dlg-label">{{ tt('检测物料类别') }}</span>
        <el-select
          v-model="dlgCat"
          filterable
          allow-create
          default-first-option
          clearable
          size="default"
          style="width: 240px"
          :placeholder="tt('选择或输入')"
        >
          <el-option v-for="v in existingValues(K.CAT)" :key="v" :label="v" :value="v" />
        </el-select>
      </div>
      <div class="cs-dlg-row">
        <span class="cs-dlg-label">{{ tt('物料名称') }}</span>
        <el-select
          v-model="dlgMat"
          filterable
          allow-create
          default-first-option
          clearable
          size="default"
          style="width: 240px"
          :placeholder="tt('选择或输入')"
        >
          <el-option v-for="v in existingValues(K.MAT)" :key="v" :label="v" :value="v" />
        </el-select>
      </div>
      <div class="cs-dlg-row">
        <span class="cs-dlg-label">{{ tt('批次号') }}</span>
        <el-input v-model="dlgBatch" size="default" style="width: 240px" maxlength="100" :placeholder="tt('必填')" />
      </div>
      <div class="cs-dlg-row">
        <span class="cs-dlg-label">{{ tt('数量') }}</span>
        <el-input v-model="dlgQty" size="default" style="width: 240px" maxlength="50" :placeholder="tt('选填（如 51Kg）')" />
      </div>
      <template #footer>
        <el-button @click="addVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="confirmAdd">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>

    <!-- 该批次检验记录弹窗(查阅详细 / 新增检验):按批次号查检验数据记录 + 来料检验单 -->
    <el-dialog v-model="inspVisible" :title="tt('批次检验记录')" width="980px" append-to-body>
      <div class="csd-head">
        <span>{{ tt('批次号') }}：<b>{{ inspBatch }}</b></span>
        <span v-if="inspRecRows.length">{{ tt('检验数据记录') }} {{ inspRecRows.length }} {{ tt('张') }}</span>
        <span v-if="inspRows.length">{{ tt('来料检验单') }} {{ inspRows.length }} {{ tt('张') }}</span>
      </div>
      <div v-if="inspLoading" class="csd-loading">{{ tt('查询中…') }}</div>
      <template v-else>
        <!-- ① 检验数据记录(检验报告 YJ-QR-96):原表脚注「查阅详细」的正解 -->
        <div class="csd-sec">{{ tt('检验数据记录') }}</div>
        <el-table v-if="inspRecRows.length" :data="inspRecRows" size="small" border highlight-current-row max-height="200" @row-click="(r) => openInspDetail(r, 'QC_INSP_REC')">
          <el-table-column prop="单据编号" :label="tt('单据编号')" width="170" />
          <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="150" show-overflow-tooltip />
          <el-table-column prop="检验日期" :label="tt('检验日期')" width="110" />
          <el-table-column prop="检验结论" :label="tt('检验结论')" min-width="160" show-overflow-tooltip />
          <el-table-column prop="检验人" :label="tt('检验人')" width="100" />
          <el-table-column prop="单据状态" :label="tt('单据状态')" width="100" />
          <el-table-column :label="tt('操作')" width="90" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click.stop="openInspDetail(row, 'QC_INSP_REC')">{{ tt('查阅详细') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="csd-empty">{{ tt('该批次暂无检验数据记录') }}</div>

        <!-- ② 来料检验单(采购链单据) -->
        <div class="csd-sec">{{ tt('来料检验单') }}</div>
        <el-table v-if="inspRows.length" :data="inspRows" size="small" border highlight-current-row max-height="200" @row-click="(r) => openInspDetail(r, 'QC_INSP')">
          <el-table-column prop="单据编号" :label="tt('单据编号')" width="170" />
          <el-table-column prop="单据日期" :label="tt('单据日期')" width="110" />
          <el-table-column prop="供应商" :label="tt('供应商')" min-width="150" show-overflow-tooltip />
          <el-table-column prop="总结论" :label="tt('检验结论')" width="110" />
          <el-table-column prop="单据状态" :label="tt('单据状态')" width="100" />
          <el-table-column :label="tt('操作')" width="90" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click.stop="openInspDetail(row, 'QC_INSP')">{{ tt('查阅详细') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="csd-empty">{{ tt('该批次暂无检验单') }}</div>

        <!-- 只读渲染选中单据(头字段 + 明细行) -->
        <div v-if="inspDetail" class="csd-detail">
          <div class="csd-detail-title">{{ inspDetail.panelName }} {{ inspDetail.no }}</div>
          <el-table :data="inspDetail.head" size="small" border class="csd-kv">
            <el-table-column prop="label" :label="tt('项目')" width="150" />
            <el-table-column prop="value" :label="tt('内容')" min-width="260" show-overflow-tooltip />
          </el-table>
          <template v-if="inspDetail.detailFields.length">
            <div class="csd-detail-title">{{ tt('检验明细') }}</div>
            <el-table :data="inspDetail.rows" size="small" border max-height="260">
              <el-table-column type="index" :label="tt('序号')" width="52" align="center" />
              <el-table-column
                v-for="f in inspDetail.detailFields"
                :key="f"
                :prop="f"
                :label="tt(f)"
                min-width="110"
                show-overflow-tooltip
              />
            </el-table>
          </template>
        </div>
      </template>
      <template #footer>
        <el-button @click="inspVisible = false">{{ tt('关闭') }}</el-button>
        <el-button type="primary" @click="gotoNewInspection">{{ tt('新增检验') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { QC_CATALOG_COLUMNS, exportHeaderRow, exportRow } from '@core/qc/qcCatalogColumns'

/**
 * 数据键(与 qc_catalog_detail 物理列同名,见 qcCatalogColumns.js)。
 * 用常量而不是散落的字符串字面量,便于列名变更时一处改、测试守住。
 */
const K = Object.freeze({
  CAT: '检测物料类别',
  MAT: '物料名称',
  BATCH: '批次号',
  QTY: '数量',
  STATUS: '检验状态',
  OK: '是否合格',
})

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

const engine = usePanelRuntime()
const router = useRouter()

/** 批次行(来自当前单据 detail.items;新增行无 id,保存后由引擎写入) */
const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
/** 下拉选项(字典值=中文数据键,ADR-0001:值不翻译) */
function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ---------- 分组列(检测物料类别 / 物料名称)合并 ----------
/** 组首行:与上一行该列不同(或首行) → 渲染出带 rowspan 的单元格 */
function isGroupHead(i, key) {
  if (i <= 0) return true
  return items.value[i]?.[key] !== items.value[i - 1]?.[key]
}
/** 组内行数(同值连续行数;空值不合并) */
function groupSpan(i, key) {
  if (!isGroupHead(i, key)) return 0
  const v = items.value[i]?.[key]
  if (!v) return 1
  let n = 1
  while (i + n < items.value.length && items.value[i + n]?.[key] === v) n++
  return n
}
/** 组首行改值:同组整块联动(合并单元格语义) */
function changeGroupValue(i, key, v) {
  const rows = items.value
  for (let j = i + 1; j < rows.length; j++) {
    if (rows[j][key] !== rows[j - 1][key]) break
    rows[j][key] = v
  }
  emit('dirty')
}

/** 已有取值(新增弹窗下拉候选:类别/物料名称) */
function existingValues(key) {
  const set = new Set()
  for (const r of items.value) {
    const v = r?.[key]
    if (v) set.add(v)
  }
  return [...set]
}

// ---------- 行增删 ----------
/** 在当前行后插入同组新行(复制所属类别与物料名称,满足明细必填) */
function insertAfter(i) {
  const d = props.head.detail
  if (!d || !Array.isArray(d.items)) return
  const src = d.items[i] || {}
  d.items.splice(i + 1, 0, { [K.CAT]: src[K.CAT], [K.MAT]: src[K.MAT] })
  emit('dirty')
}
function removeItem(i) {
  const d = props.head.detail
  if (d && Array.isArray(d.items)) d.items.splice(i, 1)
  emit('dirty')
}

/** 新增物料批次(类别/物料名称/批次号必填,与 yj_field required 一致) */
const addVisible = ref(false)
const dlgCat = ref('')
const dlgMat = ref('')
const dlgBatch = ref('')
const dlgQty = ref('')
function openAdd() {
  dlgCat.value = ''
  dlgMat.value = ''
  dlgBatch.value = ''
  dlgQty.value = ''
  addVisible.value = true
}
function confirmAdd() {
  const cat = String(dlgCat.value || '').trim()
  const mat = String(dlgMat.value || '').trim()
  const batch = String(dlgBatch.value || '').trim()
  if (!cat) return ElMessage.warning(tt('请填写检测物料类别'))
  if (!mat) return ElMessage.warning(tt('请填写物料名称'))
  if (!batch) return ElMessage.warning(tt('请填写批次号'))
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  const row = { [K.CAT]: cat, [K.MAT]: mat, [K.BATCH]: batch }
  const qty = String(dlgQty.value || '').trim()
  if (qty) row[K.QTY] = qty
  // 同类同料排在已有该组之后,否则追加到末尾(保持目录的分组观感)
  let idx = -1
  for (let i = d.items.length - 1; i >= 0; i--) {
    if (d.items[i][K.CAT] === cat && d.items[i][K.MAT] === mat) { idx = i; break }
  }
  if (idx >= 0) d.items.splice(idx + 1, 0, row)
  else d.items.push(row)
  addVisible.value = false
  emit('dirty')
}

// ---------- 点批次号 → 该批次的检验记录(检验数据记录 + 来料检验单) ----------
const inspVisible = ref(false)
const inspLoading = ref(false)
const inspBatch = ref('')
const inspRows = ref([])      // 来料检验单(QC_INSP,按 批次号)
const inspRecRows = ref([])   // 检验数据记录(QC_INSP_REC,按 物料批次)
const inspDetail = ref(null)
async function openInspection(row) {
  const batch = String(row?.[K.BATCH] || '').trim()
  if (!batch) return ElMessage.warning(tt('请先填写批次号'))
  inspBatch.value = batch
  inspRows.value = []
  inspRecRows.value = []
  inspDetail.value = null
  inspVisible.value = true
  inspLoading.value = true
  // 两个面板各查一次:检验数据记录是「查阅详细」的正解,来料检验单是采购链单据;单个失败不拖垮另一个
  const [rec, insp] = await Promise.allSettled([
    engine.queryFormDataList({ panelCode: 'QC_INSP_REC', condition: { [K.BATCH]: batch }, pageNo: 1, pageSize: 50 }),
    engine.queryFormDataList({ panelCode: 'QC_INSP', condition: { [K.BATCH]: batch }, pageNo: 1, pageSize: 50 }),
  ])
  if (rec.status === 'fulfilled') inspRecRows.value = rec.value?.list || rec.value?.rows || []
  if (insp.status === 'fulfilled') inspRows.value = insp.value?.list || insp.value?.rows || []
  if (rec.status === 'rejected' && insp.status === 'rejected') {
    ElMessage.error(engine.errMsg(rec.reason) || tt('查询失败'))
  }
  inspLoading.value = false
}
/** 查阅详细:取目标单据只读渲染(头字段键值 + 明细行);panel 缺省按来料检验单 */
async function openInspDetail(row, panel = 'QC_INSP') {
  const no = row?.['单据编号'] || row?.['编号']
  if (!no) return
  try {
    const fd = await engine.getFormDescriptor({ panelCode: panel, code: no })
    const head = fd?.data || {}
    const tabs = fd?.detail?.tabs || []
    const tab = tabs[0] || { fields: [] }
    const rows = fd?.detailData?.[tab.key || 'items'] || []
    inspDetail.value = {
      no,
      panelName: panel === 'QC_INSP_REC' ? tt('检验数据记录') : tt('来料检验单'),
      head: Object.entries(head)
        .filter(([k, v]) => !['saved', '编号'].includes(k) && v !== null && v !== '' && v !== undefined)
        .map(([k, v]) => ({ label: k, value: String(v) })),
      detailFields: (tab.fields || []).map((f) => f.dataName || f.code),
      rows,
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  }
}
/** 新增检验:跳检验数据记录面板新增,并把本行批次/物料带过去(新单空值时预填) */
function gotoNewInspection() {
  inspVisible.value = false
  const row = items.value.find((r) => String(r?.[K.BATCH] || '').trim() === inspBatch.value) || {}
  router.push({
    path: '/panelx/list/QC_INSP_REC',
    query: {
      new: 1,
      prefillBatch: inspBatch.value,
      prefillMaterial: String(row[K.MAT] || ''),
    },
  })
}

/** 导出 Excel:标题 + 列头 + 全部批次行(列定义见 qcCatalogColumns.js,与纸面同源) */
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
  const cols = header.length
  for (let c = 0; c < cols; c++) {
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
  min-width: 760px;
  max-width: 1400px;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 13px;
  color: #222;
}
/* 格内直编:白纸观感(去边框,聚焦亦无框) */
.catalog-sheet :deep(.cs-cell-input) {
  width: 100%;
}
.catalog-sheet :deep(.el-input__wrapper),
.catalog-sheet :deep(.el-input__wrapper.is-focus),
.catalog-sheet :deep(.el-select__wrapper),
.catalog-sheet :deep(.el-select__wrapper.is-focused) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
  min-height: 22px;
}
.catalog-sheet :deep(.el-input__inner),
.catalog-sheet :deep(.el-select__selected-item) {
  font-size: 13px;
  padding: 0;
  line-height: 1.6;
}

/* ═══ 标题 ═══ */
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
  min-width: 760px;
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
.cs-table thead tr:nth-child(3) th { top: 52px; }
.cs-table td {
  background: #fff;
  height: 24px;
}
.cs-table tr:hover td {
  background: #f7fbff;
}
/* 分组列:合并块涂色,内容居中(对齐原表第1类/第2类) */
.cs-table td.c-cat {
  background: #d9ecfb;
  color: #1f5fa8;
  text-align: center;
  vertical-align: middle;
  min-width: 120px;
}
.cs-table td.c-mat {
  background: #eaf4fe;
  color: #1f5fa8;
  text-align: center;
  vertical-align: middle;
  min-width: 140px;
}
.cs-block {
  display: inline-block;
  width: 100%;
  font-weight: 600;
  font-size: 14px;
}
.cs-cell-text {
  display: inline-block;
  width: 100%;
}
.c-batch { width: 14%; }
.c-qty { width: 11%; }
.c-status { width: 15%; }
.c-ok { width: 11%; }
.c-op { width: 46px; text-align: center; }

/* 批次号格:文本 + 查检验单图标(打印隐藏) */
.cs-batch-cell {
  display: flex;
  align-items: center;
  gap: 2px;
}
.cs-batch-cell .cs-cell-input { flex: 1; }
.cs-batch-link {
  flex: none;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.45;
}
.cs-batch-link:hover { opacity: 1; }

/* ═══ 脚注 / 增行条 ═══ */
.cs-note {
  border-top: 1px solid #8a8a8a;
  padding: 6px 12px;
  background: #f7fbff;
  color: #5a6b7d;
  font-size: 12.5px;
}
.cs-addbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin: 6px 8px;
}
.cs-add {
  padding: 5px 10px;
  border: 1px dashed #8fb4e0;
  border-radius: 4px;
  background: #f4f9ff;
  color: #1c4f8a;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.cs-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
.cs-addrow {
  display: inline-block;
  color: #0d5bd3;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
  margin-right: 4px;
}
.cs-del {
  display: inline-block;
  color: #c0392b;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
}
.cs-empty {
  text-align: center;
  color: #98a4b3;
  padding: 18px 0 !important;
}

/* ═══ 弹窗 ═══ */
.cs-dlg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.cs-dlg-label {
  width: 100px;
  text-align: right;
  color: #333;
  font-weight: 600;
}
.csd-head {
  display: flex;
  gap: 18px;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 13px;
  color: #303133;
}
.csd-loading,
.csd-empty {
  padding: 16px 4px;
  color: #909399;
  font-size: 13px;
}
.csd-detail {
  margin-top: 12px;
}
.csd-sec {
  margin: 10px 0 6px;
  font-weight: 600;
  color: #1f5fa8;
  font-size: 13px;
  border-left: 3px solid #b9dbf8;
  padding-left: 8px;
}
.csd-detail-title {
  margin: 8px 0 6px;
  font-weight: 600;
  color: #1f5fa8;
  font-size: 13px;
}
.csd-kv :deep(.el-table__cell) { font-size: 12px; }
</style>

<!-- 打印整张:只保留纸张(与项目进度查询同口径) -->
<style>
@media print {
  body.approval-printing .portal {
    visibility: hidden;
  }
  body.approval-printing .topbar,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
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
    overflow: visible !important;
    padding-right: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .catalog-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border: 1px solid #8a8a8a !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .catalog-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .cs-scroll {
    overflow: visible !important;
    max-height: none !important;
  }
  body.approval-printing .cs-table {
    min-width: 100% !important;
  }
  body.approval-printing .cs-table th,
  body.approval-printing .cs-table td {
    font-size: 10px !important;
    padding: 1px 2px !important;
    height: auto !important;
  }
  body.approval-printing .cs-addbar {
    display: none !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
