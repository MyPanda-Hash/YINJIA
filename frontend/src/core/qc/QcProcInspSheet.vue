<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表 · 分组横表版
       版式照用户提供的表格图:
         标题 → 抬头(一行 2 组,标签蓝底) → 分区带「检验结果」 →
         **分组横表**:左侧固定列为单据要素,各「表区」横向并排、组名横跨本组各列,
         右侧「结果判断」 → ＋新增检验项 → 检验结论 / 处理意见 / 检验人 | 审核人

       ⚠ 组类别(定性/定量)由**表区名**判定,不看数据 ——
         上一版按「该组行里有没有测量值」推断,新建行恒为空 ⇒ 恒判为定性 ⇒
         测量值格永远没有输入框(即"填不了"的根因)。现规则:
           · 表区名含 尺寸/重量/厚度/直径/长度/宽度/高度 → 定量组:
             子列 = 项目 + 测量值1..5,行 = 该组各检验项目
           · 其余(外观/性能/卫生安全…) → 定性组:
             子列 = 该组各检验项目名,格 = 该项目的「实测数值」
         组名可自由维护;要换判定的关键词只需改 QUANT_KEYS。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet">
    <!-- ① 标题 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('制程检验记录表') }}</div>
    </div>

    <!-- ② 抬头:一行 2 组「标签|值」 -->
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

    <!-- ③ 分区带 -->
    <div class="qr-band">
      <span class="qr-band-title">{{ tt('检验结果') }}</span>
      <span v-if="editable" class="qr-band-act no-print" @click="emit('open-items')">
        ⧉ {{ tt('带入检验项目') }}
      </span>
    </div>

    <!-- ④ 分组横表 -->
    <table class="qr-grid">
      <thead>
        <tr>
          <th v-for="c in fixedCols" :key="c.k" rowspan="2" class="c-fixed">{{ tt(c.label) }}</th>
          <th v-for="g in groups" :key="g.sector" :colspan="g.cols.length" class="c-group">{{ g.title }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('结果判断') }}</th>
          <th v-if="editable" rowspan="2" class="c-op"></th>
        </tr>
        <tr>
          <template v-for="g in groups" :key="'sc' + g.sector">
            <th v-for="c in g.cols" :key="'sc' + g.sector + c.k" class="c-sub">{{ c.label }}</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ri in rowCount" :key="'r' + ri">
          <template v-if="ri === 1">
            <td v-for="c in fixedCols" :key="'f' + c.k" class="c-fixed" :rowspan="rowCount">
              <el-input
                v-if="editable && !isLockedKey(c.key)"
                v-model="head[c.key]"
                size="small"
                class="qr-cell-input"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text">{{ head[c.key] || '' }}</span>
            </td>
          </template>
          <template v-for="g in groups" :key="'g' + g.sector + ri">
            <td v-for="c in g.cols" :key="'g' + g.sector + ri + c.k" class="c-val">
              <template v-if="cellRow(g, c, ri)">
                <el-input
                  v-if="editable"
                  v-model="cellRow(g, c, ri)[g.quant ? c.prop : '实测数值']"
                  size="small"
                  class="qr-cell-input qr-cell-wrap"
                  @input="emit('dirty')"
                />
                <span v-else class="qr-cell-text">{{ cellText(g, c, ri) }}</span>
              </template>
            </td>
          </template>
          <td v-if="ri === 1" class="c-fixed" :rowspan="rowCount">
            <el-input
              v-if="editable"
              v-model="head['总结论']"
              size="small"
              class="qr-cell-input"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ head['总结论'] || '' }}</span>
          </td>
          <td v-if="editable && ri === 1" class="c-op" :rowspan="rowCount">
            <span class="qr-del no-print" :title="tt('删除本表区')" @click="removeGroup(groups[0])">×</span>
          </td>
        </tr>
        <tr v-if="!groups.length">
          <td :colspan="fixedCols.length + 2 + (editable ? 1 : 0)" class="c-empty">
            {{ editable ? tt('暂无检验项，点击下方按钮新增') : tt('暂无检验项') }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ ＋新增检验项 -->
    <div v-if="editable" class="qr-add-row no-print">
      <span class="qr-add-btn" @click="addRow()">＋ {{ tt('新增检验项') }}</span>
    </div>

    <!-- ⑥ 结论区 -->
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
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'open-items'])

const MEASURE = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** 表区名含这些词 => 定量组(项目 + 测量值1..5);否则定性组(按项目名分列) */
const QUANT_KEYS = ['尺寸', '重量', '厚度', '直径', '长度', '宽度', '高度']

/** 左侧固定列(照用户图:检验时间 | 客户名称 | 产品编码 | 型号(mm) | 批号 | 抽检总量) */
const fixedCols = [
  { k: '检验时间', label: '检验时间', key: '检验时间' },
  { k: '客户名称', label: '客户名称', key: '客户名称' },
  { k: '产品编码', label: '产品编码', key: '产品编码' },
  { k: '型号', label: '型号（mm）', key: '规格型号' },
  { k: '批号', label: '批号', key: '批次号' },
  { k: '抽检总量', label: '抽检总量', key: '抽检总量' },
]

const items = computed(() => {
  const d = props.head?.detail
  if (!d) return []
  for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k]
  return []
})

const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))
/** 抬头排除:固定列已显示 + 系统/审计 + 已在表体/结论区出现 */
const HEAD_SKIP = new Set([
  ...fixedCols.map((c) => c.key),
  '单据状态', '处理方式', '表区', '行号', '检验项目', '检验要求',
  '检验方法', '检查频率', '检验仪器', '抽检量', '实测数值', '测量值1', '测量值2',
  '测量值3', '测量值4', '测量值5', '单项判定', '不合格应对措施', '不良数量',
  '结果判断', '备注2', '备注', '总结论', '检验员', '审核人', '审核时间',
])
const headRows = computed(() => {
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName && !HEAD_SKIP.has(f.dataName))
    .map((f) => f.dataName)
  const rows = []
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2))
  return rows
})

/** 按「表区」分组;组类由表区名判定(不看数据) */
const groups = computed(() => {
  const order = []
  const map = new Map()
  for (const r of items.value) {
    const s = String(r['表区'] ?? '').trim()
    if (!s) continue
    if (!map.has(s)) { map.set(s, []); order.push(s) }
    map.get(s).push(r)
  }
  return order.map((s, i) => {
    const rs = map.get(s)
    const quant = QUANT_KEYS.some((k) => s.includes(k))
    const cols = quant
      ? [{ k: '项目', label: '项目' }].concat(
          MEASURE.map((m) => ({ k: m, label: m, prop: m })))
      : rs.map((r, j) => ({ k: 'i' + j, label: String(r['检验项目'] || ''), itemIdx: j }))
    return { sector: s, title: (LETTERS[i] || '') + '.' + tt(s), cols, rows: rs, quant }
  })
})

const rowCount = computed(() => {
  let n = 1
  for (const g of groups.value) n = Math.max(n, g.quant ? g.rows.length : 1)
  return n
})

/** 单元格对应的明细行:定性组按项目下标,定量组按行号 */
function cellRow(g, c, ri) {
  if (!g.quant) return c.itemIdx != null ? (g.rows[c.itemIdx] || null) : null
  return g.rows[ri - 1] || null
}

function cellText(g, c, ri) {
  const r = cellRow(g, c, ri)
  if (!r) return ''
  const v = g.quant ? r[c.prop] : r['实测数值']
  if (v === undefined || v === null || String(v).trim() === '') return ''
  const s = String(v).trim()
  return /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : s
}

function isDateKey(k) {
  const t = fieldMap.value.get(k)?.dataType
  return t === '日期' || t === '日期时间'
}
function isLockedKey(k) {
  const f = fieldMap.value.get(k)
  return !f || f.editable === false || f.editable === 0
}

function rowsKey() {
  const d = props.head?.detail
  if (!d) return null
  return Object.keys(d).find((x) => Array.isArray(d[x])) || null
}

/** 追加一行检验项目(表区留空,由用户填;填了表区即自动成组) */
function addRow() {
  const k = rowsKey()
  if (!k) return
  props.head.detail[k].push({ 表区: '', 检验项目: '', 检验要求: '', 检验方法: '', 单项判定: '' })
  emit('dirty')
}

/** 删除一个表区的全部行 */
function removeGroup(g) {
  if (!g) return
  const k = rowsKey()
  if (!k) return
  const arr = props.head.detail[k]
  for (const r of [...g.rows]) {
    const i = arr.indexOf(r)
    if (i >= 0) arr.splice(i, 1)
  }
  emit('dirty')
}
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
/* 分组横表 */
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
  padding: 2px 4px;
  min-height: 26px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
.qr-grid thead th {
  background: #dce9f5;
  color: #1f4e79;
  font-weight: 600;
}
.qr-grid th.c-group {
  background: #cfe0f2;
}
.qr-grid th.c-sub {
  background: #e8f1fa;
  font-weight: 500;
}
.qr-grid th.c-fixed,
.qr-grid td.c-fixed {
  background: #fbfdff;
  font-weight: 500;
}
.c-op {
  width: 34px;
}
.c-empty {
  color: #8a94a0;
  padding: 12px 0;
}
.qr-del {
  color: #f56c6c;
  cursor: pointer;
  font-weight: 700;
}
/* ＋新增检验项 */
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
  text-align: center;
}
.qr-cell-wrap :deep(.el-textarea__inner) {
  text-align: center;
  padding: 2px;
  line-height: 18px;
  resize: none;
  font-family: inherit;
}
.qr-cell-text {
  display: inline-block;
  min-height: 18px;
}
</style>
