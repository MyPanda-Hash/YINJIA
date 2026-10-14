<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表
       版式照 **检验报告**(QcInspRecSheet / QC_INSP_REC):
         标题 → 抬头(一行 2 组,标签蓝底) → 分区带(居中蓝底 + 右侧带入) →
         表体(表头蓝底) → ＋新增检验项(表下虚线框) →
         检验结论 / 处理意见(多行) → 检验人 | 审核人
       契约同款:props = head(含 detail) / fields / editable;emit = dirty;
       行取 head.detail 下明细数组;单元格 v-model 直绑 + @input=emit('dirty')。

       ⚠ 测量值1..5 为**固定列**(不按数据推断) —— 新建行也能直接填:
         此前按「该组行里有没有测量值」推断定性/定量,新建行恒为空 ⇒ 永远填不了。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet">
    <!-- ① 标题 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('制程检验记录表') }}</div>
    </div>

    <!-- ② 抬头:一行 2 组「标签|值」(照检验报告的四行结构) -->
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
              <!-- 引擎生成/只读字段:纯文本展示(照检验报告的 locked 处理) -->
              <span v-else class="qr-cell-text">{{ head[k] || '' }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ③ 分区带:居中标题 + 右侧带入入口(照检验报告「检验结果 ⧉带入检验要求」) -->
    <div class="qr-band">
      <span class="qr-band-title">{{ tt('检验结果') }}</span>
      <span v-if="editable" class="qr-band-act no-print" @click="emit('open-items')">
        ⧉ {{ tt('带入检验项目') }}
      </span>
    </div>

    <!-- ④ 表体:一行一个检验项目 -->
    <table class="qr-table">
      <thead>
        <tr>
          <th class="c-sector">{{ tt('表区') }}</th>
          <th class="c-item">{{ tt('检验项目') }}</th>
          <th class="c-req">{{ tt('检验要求') }}</th>
          <th class="c-method">{{ tt('检验方法') }}</th>
          <th v-for="m in MEASURE" :key="m" class="c-mv">{{ tt(m) }}</th>
          <th class="c-judge">{{ tt('单项判定') }}</th>
          <th v-if="editable" class="c-op"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
          <td class="c-sector">
            <el-input
              v-if="editable"
              v-model="row['表区']"
              type="textarea"
              :autosize="{ minRows: 1 }"
              class="qr-cell-input qr-cell-wrap"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ row['表区'] || '' }}</span>
          </td>
          <td class="c-item">
            <el-input
              v-if="editable"
              v-model="row['检验项目']"
              type="textarea"
              :autosize="{ minRows: 1 }"
              class="qr-cell-input qr-cell-wrap"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ row['检验项目'] || '' }}</span>
          </td>
          <td class="c-req">
            <el-input
              v-if="editable"
              v-model="row['检验要求']"
              type="textarea"
              :autosize="{ minRows: 1 }"
              class="qr-cell-input qr-cell-wrap"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ row['检验要求'] || '' }}</span>
          </td>
          <td class="c-method">
            <el-input
              v-if="editable"
              v-model="row['检验方法']"
              type="textarea"
              :autosize="{ minRows: 1 }"
              class="qr-cell-input qr-cell-wrap"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ row['检验方法'] || '' }}</span>
          </td>
          <td v-for="m in MEASURE" :key="m" class="c-mv">
            <el-input v-if="editable" v-model="row[m]" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ num(row[m]) }}</span>
          </td>
          <td class="c-judge">
            <el-input v-if="editable" v-model="row['单项判定']" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ row['单项判定'] || '' }}</span>
          </td>
          <td v-if="editable" class="c-op">
            <span class="qr-del no-print" :title="tt('删除本行')" @click="removeRow(row)">×</span>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td :colspan="editable ? 11 : 10" class="c-empty">
            {{ editable ? tt('暂无检验项，点击下方按钮新增') : tt('暂无检验项') }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ ＋新增检验项:表格下方的虚线框按钮(照检验报告) -->
    <div v-if="editable" class="qr-add-row no-print">
      <span class="qr-add-btn" @click="addRow()">＋ {{ tt('新增检验项') }}</span>
    </div>

    <!-- ⑥ 结论区:检验结论 / 处理意见(多行) + 检验人 | 审核人 -->
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
import { computed } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  /** 当前单据(含 detail):与 QcInspRecSheet 同款契约 */
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'open-items'])

/** 测量值列(固定,不按数据推断) */
const MEASURE = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5']

/** 明细行:取 head.detail 下第一个数组 */
const items = computed(() => {
  const d = props.head?.detail
  if (!d) return []
  for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k]
  return []
})

/** 字段元数据索引 */
const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))

/** 抬头排除项:系统/审计类 + 已在表体或结论区出现的字段 */
const HEAD_SKIP = new Set([
  '单据状态', '处理方式', '表区', '行号', '检验项目', '检验要求',
  '检验方法', '检查频率', '检验仪器', '抽检量', '实测数值', '测量值1', '测量值2',
  '测量值3', '测量值4', '测量值5', '单项判定', '不合格应对措施', '不良数量',
  '结果判断', '备注2', '备注', '总结论', '检验员', '审核人', '审核时间',
])
/** 抬头字段行:一行 2 组(照检验报告) */
const headRows = computed(() => {
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName && !HEAD_SKIP.has(f.dataName))
    .map((f) => f.dataName)
  const rows = []
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2))
  return rows
})

function isDateKey(k) {
  const t = fieldMap.value.get(k)?.dataType
  return t === '日期' || t === '日期时间'
}
function isLockedKey(k) {
  const f = fieldMap.value.get(k)
  return !f || f.editable === false || f.editable === 0
}

function num(v) {
  if (v === undefined || v === null || String(v).trim() === '') return ''
  const s = String(v).trim()
  return /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : s
}

/** 明细数组键 */
function rowsKey() {
  const d = props.head?.detail
  if (!d) return null
  return Object.keys(d).find((x) => Array.isArray(d[x])) || null
}

/** 追加一行检验项目 */
function addRow() {
  const k = rowsKey()
  if (!k) return
  props.head.detail[k].push({ 表区: '', 检验项目: '', 检验要求: '', 检验方法: '', 单项判定: '' })
  emit('dirty')
}

/** 删除一行 */
function removeRow(row) {
  const k = rowsKey()
  if (!k) return
  const arr = props.head.detail[k]
  const i = arr.indexOf(row)
  if (i >= 0) { arr.splice(i, 1); emit('dirty') }
}
</script>

<style scoped>
/* 纸张容器 */
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
/* ── 抬头:一行 2 组,标签蓝底(照检验报告) ── */
.qr-head-table,
.qr-foot-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  table-layout: fixed;
}
.qr-head-table {
  margin-bottom: 0;
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
/* ── 分区带:居中标题 + 右侧动作 ── */
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
.qr-band-act {
  position: absolute;
  right: 8px;
  top: 3px;
  font-size: 12px;
  font-weight: 400;
  color: #2b6cb0;
  cursor: pointer;
}
.qr-band-act:hover {
  text-decoration: underline;
}
/* ── 表体:表头蓝底 ── */
.qr-table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
  margin-top: -1px;
}
.qr-table th,
.qr-table td {
  border: 1px solid #b8cfe6;
  padding: 2px 4px;
  min-height: 26px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
.qr-table thead th {
  background: #dce9f5;
  color: #1f4e79;
  font-weight: 600;
}
.c-sector { width: 80px; }
.c-item { width: 140px; }
.c-req { width: 190px; }
.c-method { width: 190px; }
.c-mv { width: 70px; }
.c-judge { width: 76px; }
.c-op { width: 36px; }
.c-empty {
  color: #8a94a0;
  padding: 12px 0;
}
.qr-del {
  color: #f56c6c;
  cursor: pointer;
  font-weight: 700;
}
/* ── ＋新增检验项:表下虚线框(照检验报告) ── */
.qr-add-row {
  padding: 8px 0 10px;
}
.qr-add-btn {
  display: inline-block;
  border: 1px dashed #9db8d2;
  border-radius: 3px;
  padding: 4px 14px;
  color: #2b6cb0;
  cursor: pointer;
  font-size: 12px;
  background: #fbfdff;
}
.qr-add-btn:hover {
  border-color: #5b9bd5;
  background: #f2f8ff;
}
/* ── 结论区 ── */
.qr-foot-table {
  margin-top: 2px;
}
.qr-foot-table .qr-label {
  width: 96px;
}
/* 输入控件:方角、贴合单元格 —— 去掉 el-input 自带的圆角框,
   让**单元格自身的边框**成为唯一的框(照检验报告的平铺观感)。
   悬停/聚焦只做淡蓝底提示,不再画第二个框。 */
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
  text-align: center;
}
/* 多行列:左对齐、铺满格子(随内容增高) */
.qr-cell-wrap :deep(.el-textarea__inner) {
  text-align: left;
  padding: 2px 2px;
  line-height: 18px;
  resize: none;
  font-family: inherit;
}
/* 单元格:给内容撑高留出空间 */
.qr-table td {
  vertical-align: top;
  padding: 1px 2px;
}
.qr-cell-text {
  display: inline-block;
  min-height: 18px;
}
</style>
