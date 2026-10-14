<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表(2026-10-12)
       实现模式完全照 **检验记录报告**(QcInspRecSheet / QC_INSP_REC):
         标题 → 抬头 标签|值 → 分区表体(一行一个检验项目) → 删除/新增行
       契约同款:props = head(含 detail) / fields / editable;emit = dirty;
       行取 head.detail 下明细数组;单元格 v-model 直绑 + @input=emit('dirty')
       (明细行是 markRaw 的,必须走 dirty 链路,不能直写后期望响应)。

       ⚠ 上一版的错误(已废弃):按「该组行里有没有测量值」推断定性/定量 ——
         新建/带入的行测量值本就是空的 ⇒ 恒判为定性,永远渲染不出测量值输入框,
         纸张上无法建立定量数据(即用户说的"无法创建到这个页面/填不了")。
         现改为**固定列**:测量值1..5 恒为可填列,不依赖数据推断。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet">
    <!-- ① 标题 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('制程检验记录表') }}</div>
    </div>

    <!-- ② 抬头:面板表头字段,每行 4 组 标签|值(按字段可编辑性与类型渲染) -->
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
              <!-- 单据编号=引擎生成,lok 字段只读展示(照 QcInspRecSheet 的 locked 处理) -->
              <span v-else class="qr-cell-text">{{ head[k] || '' }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ③ 分区标题 + 新增行 -->
    <div class="qr-section">
      {{ tt('检验结果') }}
      <span
        v-if="editable"
        class="qr-lib-btn no-print"
        :title="tt('在末尾追加一行检验项目')"
        @click="addRow()"
      >＋ {{ tt('新增检验项目') }}</span>
    </div>

    <!-- ④ 表体:一行一个检验项目(平铺,不做定性/定量推断) -->
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
            <el-input v-if="editable" v-model="row['表区']" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ row['表区'] || '' }}</span>
          </td>
          <td class="c-item">
            <el-input v-if="editable" v-model="row['检验项目']" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ row['检验项目'] || '' }}</span>
          </td>
          <td class="c-req">
            <el-input v-if="editable" v-model="row['检验要求']" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ row['检验要求'] || '' }}</span>
          </td>
          <td class="c-method">
            <el-input v-if="editable" v-model="row['检验方法']" size="small" class="qr-cell-input" @input="emit('dirty')" />
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
          <td :colspan="editable ? 11 : 10" class="c-empty">{{ tt('暂无检验项目，点上方「新增检验项目」或工具栏「检验项目/检验方案」带入') }}</td>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ 结论:总结论 + 备注(照检验记录报告的结论/意见区) -->
    <table class="qr-foot-table">
      <tbody>
        <tr>
          <th class="qr-label">{{ tt('结果判断') }}</th>
          <td class="qr-value">
            <el-input v-if="editable" v-model="head['总结论']" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ head['总结论'] || '' }}</span>
          </td>
          <th class="qr-label">{{ tt('备注') }}</th>
          <td class="qr-value">
            <el-input v-if="editable" v-model="head['备注']" size="small" class="qr-cell-input" @input="emit('dirty')" />
            <span v-else class="qr-cell-text">{{ head['备注'] || '' }}</span>
          </td>
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
const emit = defineEmits(['dirty'])

/** 测量值列(固定,不按数据推断 —— 否则新建行永远填不了这几个格) */
const MEASURE = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5']

/** 明细行:取 head.detail 下第一个数组(通常 items) */
const items = computed(() => {
  const d = props.head?.detail
  if (!d) return []
  for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k]
  return []
})

/** 字段元数据索引(判可编辑性/类型,照 QcInspRecSheet 的 fieldMap) */
const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))

/** 抬头字段行(每行 4 组):只取表头字段里 visible 的,跳过系统/审计与明细类 */
const HEAD_SKIP = new Set([
  '单据状态', '审核人', '审核时间', '处理方式', '表区', '行号', '检验项目', '检验要求',
  '检验方法', '检查频率', '检验仪器', '抽检量', '实测数值', '测量值1', '测量值2',
  '测量值3', '测量值4', '测量值5', '单项判定', '不合格应对措施', '不良数量',
  '结果判断', '备注2', '备注',
])
const headRows = computed(() => {
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName && !HEAD_SKIP.has(f.dataName))
    .map((f) => f.dataName)
  const rows = []
  for (let i = 0; i < names.length; i += 4) rows.push(names.slice(i, i + 4))
  return rows
})

/** 日期类字段(用日期选择器,照 QcInspRecSheet 的 isDateField) */
function isDateKey(k) {
  const t = fieldMap.value.get(k)?.dataType
  return t === '日期' || t === '日期时间'
}
/** 只读字段:引擎生成的单据编号不可手改 */
function isLockedKey(k) {
  const f = fieldMap.value.get(k)
  return !f || f.editable === false || f.editable === 0
}

function num(v) {
  if (v === undefined || v === null || String(v).trim() === '') return ''
  const s = String(v).trim()
  return /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : s
}

/** 追加一行检验项目(照 QcInspRecSheet 的新增:只塞进 items,保存时由引擎落库) */
function addRow() {
  const d = props.head?.detail
  if (!d) return
  const k = Object.keys(d).find((x) => Array.isArray(d[x]))
  if (!k) return
  d[k].push({ 表区: '', 检验项目: '', 检验要求: '', 检验方法: '', 单项判定: '' })
  emit('dirty')
}

/** 删除一行 */
function removeRow(row) {
  const d = props.head?.detail
  if (!d) return
  const k = Object.keys(d).find((x) => Array.isArray(d[x]))
  if (!k) return
  const i = d[k].indexOf(row)
  if (i >= 0) { d[k].splice(i, 1); emit('dirty') }
}
</script>

<style scoped>
/* 纸张容器:与 QcInspRecSheet 同族观感 */
.qr-sheet {
  background: #fff;
  border: 1px solid #d7dce5;
  padding: 10px 12px 14px;
  margin: 0 6px 8px;
}
.qr-titlerow {
  text-align: center;
  margin-bottom: 8px;
}
.qr-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 2px;
}
/* 抬头表 */
.qr-head-table,
.qr-foot-table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 8px;
  font-size: 12px;
  table-layout: fixed;
}
.qr-label {
  border: 1px solid #c9d4e0;
  background: #f7fafd;
  font-weight: 500;
  text-align: right;
  padding: 2px 6px;
  width: 84px;
  white-space: nowrap;
}
.qr-value {
  border: 1px solid #c9d4e0;
  padding: 1px 4px;
  text-align: left;
}
/* 分区标题 */
.qr-section {
  font-weight: 600;
  color: #1f4e79;
  background: #eef3f9;
  border-left: 3px solid #5b9bd5;
  padding: 4px 8px;
  margin: 6px 0;
  font-size: 13px;
}
.qr-lib-btn {
  margin-left: 10px;
  font-weight: 400;
  font-size: 12px;
  color: #2b6cb0;
  cursor: pointer;
}
.qr-lib-btn:hover {
  text-decoration: underline;
}
/* 表体:一行一个检验项目 */
.qr-table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
}
.qr-table th,
.qr-table td {
  border: 1px solid #c9d4e0;
  padding: 2px 4px;
  min-height: 26px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
.qr-table thead th {
  background: #eef3f9;
  color: #1f4e79;
  font-weight: 600;
}
.c-sector { width: 90px; }
.c-item { width: 150px; }
.c-req { width: 200px; }
.c-method { width: 200px; }
.c-mv { width: 72px; }
.c-judge { width: 80px; }
.c-op { width: 40px; }
.c-empty {
  color: #8a94a0;
  padding: 10px 0;
}
.qr-del {
  color: #f56c6c;
  cursor: pointer;
  font-weight: 700;
}
/* 可填写:输入框看得见(此前做透明过,看着像死文本) */
.qr-cell-input :deep(.el-input__wrapper),
.qr-cell-input :deep(.el-input__inner) {
  box-shadow: none;
  background: #fff;
}
.qr-cell-input :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #b8c8da inset;
  padding: 0 4px;
}
.qr-cell-input :deep(.el-input__wrapper:hover),
.qr-cell-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #5b9bd5 inset;
}
.qr-cell-input :deep(.el-input__inner) {
  height: 20px;
  line-height: 20px;
  text-align: center;
}
.qr-cell-text {
  display: inline-block;
  min-height: 18px;
}
</style>
