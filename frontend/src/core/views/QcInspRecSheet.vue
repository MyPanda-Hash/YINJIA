<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料品质·检验数据记录(QC_INSP_REC)—— 纸张式检验报告(YJ-QR-96)
       版式一比一照《品质资料 2026.09.19.xlsx》「检验数据记录模版」页签:
       标题「检验报告」/ 抬头四对(物料名称·检验日期 …) / 分区「检验结果」
       表体四列(检验项·检测标准·检测结果·单项判定) / 检验结论·处理意见 / 检验人·审核人
       呈现方式与项目进度查询同族:纸张 + 右侧竖排操作栏(PanelxList approval-layout 提供)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qc-rec-sheet">
    <!-- ① 标题 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('检验报告') }}</div>
    </div>

    <!-- ② 抬头(四行 × 标签/值 两对,对齐原表 B|C:D|E|F:I) -->
    <table class="qr-head-table">
      <colgroup>
        <col class="fc-label" />
        <col class="fc-v1" />
        <col class="fc-label2" />
        <col class="fc-v2" />
      </colgroup>
      <tbody>
        <tr v-for="(pair, ri) in QC_INSP_REC_HEAD_ROWS" :key="'h' + ri">
          <template v-for="cell in pair" :key="cell.key">
            <th class="qr-label">{{ tt(cell.label) }}</th>
            <!-- 物料编码的值格:编码(可填输入框)右侧跟「检验要求」查看链接 —— 2026-09-23
                 用户口径「把检验要求的链接放在右边物料编码后面」;纸面打印不出现(no-print) -->
            <td class="qr-value" :class="{ 'qr-value-code': cell.key === '物料编码' }">
              <el-date-picker
                v-if="isDateField(cell.key) && editable && !cell.locked"
                v-model="head[cell.key]"
                type="date"
                value-format="YYYY-MM-DD"
                size="small"
                class="qr-cell-input"
                :placeholder="tt('选择日期')"
                @change="emit('dirty')"
              />
              <el-input
                v-else-if="editable && !cell.locked"
                v-model="head[cell.key]"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @input="emit('dirty')"
              />
              <!-- locked 字段(物料批次=回填批次号)即便在草稿态也只显示文本,不允许手填 -->
              <span v-else class="qr-cell-text">{{ head[cell.key] || '' }}</span>
              <span
                v-if="cell.key === '物料编码'"
                class="qr-lib-btn no-print"
                :title="tt('按物料编码查看来料检验要求相关内容')"
                @click="openReqView"
              >⧉ {{ tt('检验要求') }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ③ 分区标题:检验结果 -->
    <div class="qr-section">{{ tt('检验结果') }}</div>

    <!-- ④ 表体:检验项 | 检测标准 | 检测结果 | 单项判定 -->
    <table class="qr-table">
      <thead>
        <tr>
          <th class="c-item">
            {{ tt('检验项') }}
            <span
              v-if="editable"
              class="qr-lib-btn no-print"
              :title="tt('检验项来自数据库选择，可在此维护')"
              @click="openStdLib"
            >⧉ {{ tt('标准库维护') }}</span>
          </th>
          <th class="c-std">{{ tt('检测标准') }}</th>
          <th class="c-result">{{ tt('检测结果') }}</th>
          <th class="c-judge">{{ tt('单项判定') }}</th>
          <th v-if="editable" class="c-op"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
          <td class="c-item">
            <el-select
              v-if="editable"
              v-model="row[K.ITEM]"
              size="small"
              filterable
              clearable
              allow-create
              default-first-option
              class="qr-cell-input"
              :placeholder="tt('请选择')"
              @change="emit('dirty')"
            >
              <el-option v-for="o in itemOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span v-else class="qr-cell-text">{{ row[K.ITEM] || '' }}</span>
          </td>
          <td class="c-std">
            <el-input v-if="editable" v-model="row[K.STD]" size="small" class="qr-cell-input" maxlength="500" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ row[K.STD] || '' }}</span>
          </td>
          <td class="c-result">
            <el-input
              v-if="editable"
              v-model="row[K.RESULT]"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 5 }"
              size="small"
              class="qr-cell-input"
              maxlength="500"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ row[K.RESULT] || '' }}</span>
          </td>
          <td class="c-judge">
            <el-select
              v-if="editable"
              v-model="row[K.JUDGE]"
              size="small"
              clearable
              class="qr-cell-input"
              :placeholder="tt('请选择')"
              @change="emit('dirty')"
            >
              <el-option v-for="o in judgeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span v-else class="qr-cell-text">{{ row[K.JUDGE] || '' }}</span>
          </td>
          <td v-if="editable" class="c-op">
            <span class="qr-addrow" :title="tt('在该行后新增一行')" @click="insertAfter(i)">＋</span>
            <span class="qr-del" :title="tt('删除该行')" @click="removeItem(i)">×</span>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td :colspan="editable ? 5 : 4" class="qr-empty">{{ tt('暂无检验项，点击下方按钮新增') }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="editable" class="qr-addbar">
      <div class="qr-add" @click="addItem">＋ {{ tt('新增检验项') }}</div>
    </div>

    <!-- ⑤ 表尾:检验结论 / 处理意见(值格铺满表格右侧,对齐原表 C:I 合并) + 签名行 -->
    <table class="qr-foot-table">
      <!-- 列宽与原表一致:标签列=表体首列(B),值区=C:I(其余三列合并) -->
      <colgroup>
        <col class="fc-label" />
        <col class="fc-v1" />
        <col class="fc-label2" />
        <col class="fc-v2" />
      </colgroup>
      <tbody>
        <tr v-for="cell in QC_INSP_REC_FOOT_FULL" :key="cell.key">
          <th class="qr-label">{{ tt(cell.label) }}</th>
          <td class="qr-value qr-value-wide" colspan="3">
            <el-input
              v-if="editable"
              v-model="head[cell.key]"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 8 }"
              size="small"
              class="qr-cell-input"
              maxlength="1000"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head[cell.key] || '' }}</span>
          </td>
        </tr>
        <!-- 签名行:检验人=账号登录人自动生成(锁定) / 审核人=固定:冯敏(落库列 表单审核人) -->
        <tr>
          <template v-for="cell in QC_INSP_REC_SIGN_ROW" :key="cell.key">
            <th class="qr-label">{{ tt(cell.label) }}</th>
            <td class="qr-value">
              <el-input
                v-if="editable && !cell.locked"
                v-model="head[cell.key]"
                size="small"
                class="qr-cell-input"
                maxlength="50"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text qr-sign">{{ signText(cell) }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- 标准库维护(检验项候选的数据库,可增删改;与项目记录表同一组件) -->
    <el-dialog v-model="stdLibVisible" :title="tt('标准库维护') + ' · ' + tt('检验项')" width="680px" append-to-body>
      <StdLibManager :lib="QC_INSP_ITEM_LIB" @changed="onStdLibChanged" />
      <template #footer>
        <el-button @click="stdLibVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <!-- 来料检验要求·按本单物料编码查看(只读;内容取自品质管理 > 来料检验要求) -->
    <QcInspReqViewDialog v-model="reqViewVisible" :material-code="materialCode" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import StdLibManager from './StdLibManager.vue'
import QcInspReqViewDialog from './QcInspReqViewDialog.vue'
import {
  QC_INSP_REC_HEAD_ROWS,
  QC_INSP_REC_FOOT_FULL,
  QC_INSP_REC_SIGN_ROW,
  QC_INSP_ITEM_LIB,
} from '@core/qc/qcInspRecColumns'

/** 表体数据键(与 qc_insp_rec_detail 物理列同名) */
const K = Object.freeze({
  ITEM: '检验项',
  STD: '检测标准',
  RESULT: '检测结果',
  JUDGE: '单项判定',
})

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'refresh-config'])

/** 检验项明细行(来自当前单据 detail.items;新增行无 id,保存后由引擎写入) */
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
/** 检验项候选:来自标准库 qc.insp_item(原表「检验项为数据库选择」) */
const itemOptions = computed(() => optionsOf(K.ITEM))
/** 单项判定:下拉(合格/不合格),字典值=中文数据键 */
const judgeOptions = computed(() => optionsOf(K.JUDGE))

function isDateField(key) {
  return String(fieldMap.value.get(key)?.dataType || '') === '日期'
}

/**
 * 签名行取值(只读态):
 * · 检验人(锁定,原表「账号登录人自动生成」)——未落值时显示说明文案;
 * · 审核人(原表「固定:冯敏」)——落库键是 表单审核人;单据真审核后另有虚拟键 审核人(=yj_doc_status.shr)兜底。
 */
/** 签名行取值(只读态):见 signText 注释;取值走 headVal,避免与模板里的 props.head 同名遮蔽 */
function signText(cell) {
  const v = headVal(cell.key) || (cell.auditKey ? headVal(cell.auditKey) : '')
  if (v) return v
  return cell.locked ? tt('账号登录人自动生成') : ''
}
function headVal(key) {
  const v = props.head?.[key]
  return v === undefined || v === null ? '' : String(v)
}

/** 行增删(与检验目录同款 ＋/× 操作) */
function insertAfter(i) {
  const d = props.head.detail
  if (!d || !Array.isArray(d.items)) return
  d.items.splice(i + 1, 0, {})
  emit('dirty')
}
function removeItem(i) {
  const d = props.head.detail
  if (d && Array.isArray(d.items)) d.items.splice(i, 1)
  emit('dirty')
}
function addItem() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  d.items.push({})
  emit('dirty')
}

/** 标准库维护:改完让面板重拉一次配置(选项随之刷新) */
const stdLibVisible = ref(false)
function openStdLib() {
  stdLibVisible.value = true
}
function onStdLibChanged() {
  emit('refresh-config')
}

/**
 * 按「物料编码」查看来料检验要求(2026-09-23 用户口径)。
 * 只读弹窗按物料编号精确匹配品质管理 > 来料检验要求里的行;本单没填物料编码时先提示再拦。
 */
const reqViewVisible = ref(false)
const materialCode = computed(() => String(props.head?.['物料编码'] ?? '').trim())
function openReqView() {
  if (!materialCode.value) {
    ElMessage.warning(tt('请先填写物料编码'))
    return
  }
  reqViewVisible.value = true
}

/**
 * 从检验目录「新增检验」跳进来时,把批次/物料预填到**新建的空报告**上
 * (路由 query: prefillBatch/prefillMaterial)。只在单据还空着时填一次,已录入内容一律不动。
 */
const route = useRoute()
const prefilled = ref(false)
watch(
  () => [props.editable, props.head?.['单据编号'], props.head?.['物料批次']],
  () => {
    if (prefilled.value || !props.editable) return
    const q = route.query || {}
    const batch = String(q.prefillBatch || '').trim()
    if (!batch) return
    const d = props.head?.detail
    const hasRows = !!(d && Array.isArray(d.items) && d.items.length)
    if (props.head['物料批次'] || hasRows) {
      prefilled.value = true // 已有内容:不是新建空单,不预填
      return
    }
    props.head['物料批次'] = batch
    const mat = String(q.prefillMaterial || '').trim()
    if (mat) props.head['物料名称'] = mat
    prefilled.value = true
    emit('dirty')
  },
  { immediate: true },
)
</script>

<style scoped>
/* ═══ 纸张主体(与检验目录同宽同观感) ═══ */
.qc-rec-sheet {
  width: calc(100vw - 300px);
  min-width: 760px;
  max-width: 1400px;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 13px;
  color: #222;
}
/* 格内直编:去边框,白纸观感 */
.qc-rec-sheet :deep(.qr-cell-input) {
  width: 100%;
}
.qc-rec-sheet :deep(.el-input__wrapper),
.qc-rec-sheet :deep(.el-input__wrapper.is-focus),
.qc-rec-sheet :deep(.el-textarea__inner),
.qc-rec-sheet :deep(.el-textarea__inner:focus),
.qc-rec-sheet :deep(.el-select__wrapper),
.qc-rec-sheet :deep(.el-select__wrapper.is-focused) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
}
.qc-rec-sheet :deep(.el-input__inner),
.qc-rec-sheet :deep(.el-textarea__inner),
.qc-rec-sheet :deep(.el-select__selected-item) {
  font-size: 13px;
  padding: 0;
  line-height: 1.6;
}

/* ═══ 标题 ═══ */
.qr-titlerow {
  border-bottom: 1px solid #8a8a8a;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-title {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 28px;
  font-weight: 600;
  color: #1f5fa8;
  letter-spacing: 6px;
}

/* ═══ 抬头 / 表尾 ═══ */
.qr-head-table,
.qr-foot-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.qr-head-table th,
.qr-head-table td,
.qr-foot-table th,
.qr-foot-table td {
  border: 1px solid #9a9a9a;
  padding: 3px 6px;
  vertical-align: middle;
  font-size: 12.5px;
}
.qr-label {
  background: #eef6fe;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}
/* 整张纸共用一套列宽(与原表 B|C:D|E|F:I 同节奏):
   标签列 20% / 值列 30% / 标签列 20% / 值列 30%;表尾「检验结论/处理意见」值格跨后三列铺到表格右缘 */
.qr-head-table col.fc-label,
.qr-foot-table col.fc-label { width: 20%; }
.qr-head-table col.fc-v1,
.qr-foot-table col.fc-v1 { width: 30%; }
.qr-head-table col.fc-label2,
.qr-foot-table col.fc-label2 { width: 20%; }
.qr-head-table col.fc-v2,
.qr-foot-table col.fc-v2 { width: 30%; }
.qr-value-wide {
  vertical-align: top;
}
.qr-value {
  background: #fff;
  height: 26px;
}
.qr-cell-text {
  display: inline-block;
  width: 100%;
  word-break: break-all;
}
.qr-sign {
  font-weight: 600;
  color: #1f5fa8;
}

/* ═══ 分区标题 ═══ */
.qr-section {
  border-top: 1px solid #8a8a8a;
  border-bottom: 1px solid #8a8a8a;
  background: #d9ecfb;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
  padding: 4px 0;
  letter-spacing: 2px;
}

/* ═══ 表体 ═══ */
.qr-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.qr-table th,
.qr-table td {
  border: 1px solid #9a9a9a;
  padding: 3px 6px;
  vertical-align: middle;
  font-size: 12.5px;
  word-break: break-all;
}
.qr-table th {
  background: #b9dbf8;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
}
.qr-table td {
  background: #fff;
  min-height: 24px;
}
.qr-table tr:hover td {
  background: #f7fbff;
}
.c-item { width: 20%; }
.c-std { width: 24%; }
.c-result { width: 42%; }
.c-judge { width: 14%; }
.c-op { width: 46px; text-align: center; }
.qr-lib-btn {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  color: #1677ff;
  cursor: pointer;
  white-space: nowrap;
}
.qr-lib-btn:hover { text-decoration: underline; }
/* 物料编码值格:编码(或编码输入框)+ 右侧「检验要求」链接 同行排布,链接紧跟编码后面 */
.qr-value-code {
  display: flex;
  align-items: center;
  gap: 2px;
}
.qr-value-code .qr-cell-input {
  flex: 1;
  width: auto;
  min-width: 0;
}
.qr-empty {
  text-align: center;
  color: #98a4b3;
  padding: 16px 0 !important;
}

/* ═══ 增行条 / 行操作 ═══ */
.qr-addbar {
  display: flex;
  gap: 8px;
  margin: 6px 8px;
}
.qr-add {
  padding: 5px 10px;
  border: 1px dashed #8fb4e0;
  border-radius: 4px;
  background: #f4f9ff;
  color: #1c4f8a;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.qr-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
.qr-addrow {
  display: inline-block;
  color: #0d5bd3;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
  margin-right: 4px;
}
.qr-del {
  display: inline-block;
  color: #c0392b;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
}
</style>

<!-- 打印整张:只保留纸张(与项目进度查询/检验目录同口径) -->
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
  body.approval-printing .qc-rec-sheet {
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
  body.approval-printing .qc-rec-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .qr-table th,
  body.approval-printing .qr-table td,
  body.approval-printing .qr-head-table th,
  body.approval-printing .qr-head-table td,
  body.approval-printing .qr-foot-table th,
  body.approval-printing .qr-foot-table td {
    font-size: 10px !important;
    padding: 1px 3px !important;
  }
  body.approval-printing .qr-addbar,
  body.approval-printing .qr-lib-btn {
    display: none !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
