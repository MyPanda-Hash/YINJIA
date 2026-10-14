<template>
  <!-- 制程检验单 · 整页报表式交叉表(2026-10-12)
       用户口径:「照截图:横向组头」+「不是修改明细表而是修改当前页面」——
       本组件接管整页:上方=表头字段(报表式 标签|值),下方=交叉表(表区横向并排,组名横跨本组列)。 -->
  <div class="qsheet">
    <!-- ① 表头字段(报表式两列一组:标签 + 值) -->
    <table class="qsheet-meta">
      <tbody>
        <tr v-for="(row, i) in metaRows" :key="'m' + i">
          <template v-for="k in row" :key="k">
            <th class="ml">{{ tt(k) }}</th>
            <td class="mv" :class="{ ed: editable }" @click="onMetaClick(k)">
              <input
                v-if="editing && editing.key === 'meta|' + k"
                ref="inp"
                class="cell-inp"
                :value="fmt(doc[k])"
                @blur="commitMeta($event, k)"
                @keyup.enter="commitMeta($event, k)"
              />
              <template v-else>{{ fmt(doc[k]) }}</template>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ② 交叉表:表区横向并排 -->
    <table class="qsheet-tb">
      <thead>
        <tr>
          <th v-for="h in headCols" :key="h.k" rowspan="2" class="fc">{{ tt(h.label) }}</th>
          <th v-for="g in groups" :key="g.sector" :colspan="g.cols.length" class="gh">{{ g.title }}</th>
          <th rowspan="2" class="fc">{{ tt('结果判断') }}</th>
        </tr>
        <tr>
          <template v-for="g in groups" :key="'c' + g.sector">
            <th v-for="c in g.cols" :key="'c' + g.sector + c.k" class="sh">{{ c.label }}</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ri in rowCount" :key="'r' + ri">
          <template v-if="ri === 1">
            <td v-for="h in headCols" :key="'h' + h.k" class="fc" :rowspan="rowCount">{{ fmt(doc[h.key]) }}</td>
          </template>
          <template v-for="g in groups" :key="'g' + g.sector + ri">
            <td
              v-for="c in g.cols"
              :key="'g' + g.sector + ri + c.k"
              class="vc"
              :class="{ ed: editable && cellRow(g, c, ri) }"
              @click="onCellClick(g, c, ri)"
            >
              <input
                v-if="editing && editing.key === g.sector + '|' + ri + '|' + c.k"
                ref="inp"
                class="cell-inp"
                :value="cellText(g, c, ri)"
                @blur="commit($event)"
                @keyup.enter="commit($event)"
              />
              <template v-else>{{ cellText(g, c, ri) }}</template>
            </td>
          </template>
          <td v-if="ri === 1" class="fc" :rowspan="rowCount">{{ fmt(doc['总结论']) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  doc: { type: Object, default: () => ({}) },
  rows: { type: Array, default: () => [] },
  /** 面板表头字段(yj_field 的 label/dataName);整页报表把它们排成 标签|值 */
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

/** 表头字段行(每行 4 组 标签|值):由面板表头字段驱动,已在左侧固定列的 产品编码/型号/批号/抽检总量 不重复 */
const metaRows = computed(() => {
  const skip = new Set(headCols.map((h) => h.key))
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName)
    .map((f) => f.dataName)
    .filter((k) => !skip.has(k))
  const rows = []
  for (let i = 0; i < names.length; i += 4) rows.push(names.slice(i, i + 4))
  return rows
})

/** 左侧固定列(照截图:产品编码 | 型号(mm) | 批号 | 抽检总量) */
const headCols = [
  { k: '产品编码', label: '产品编码', key: '产品编码' },
  { k: '型号', label: '型号（mm)', key: '规格型号' },
  { k: '批号', label: '批号', key: '批次号' },
  { k: '抽检总量', label: '抽检总量', key: '抽检总量' },
]
const MEASURE = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function isMeasure(rows) {
  return rows.some((r) => MEASURE.some((m) => {
    const v = String(r[m] ?? '').trim()
    return v !== '' && v !== '0'
  }))
}

/** 按「表区」横向分组:每组自带列定义 */
const groups = computed(() => {
  const order = []
  const map = new Map()
  for (const r of props.rows || []) {
    if (r._placeholder) continue
    const s = String(r['表区'] ?? '').trim()
    if (!s) continue
    if (!map.has(s)) { map.set(s, []); order.push(s) }
    map.get(s).push(r)
  }
  return order.map((s, i) => {
    const rs = map.get(s)
    const meas = isMeasure(rs)
    const cols = meas
      ? [{ k: '项目', label: '项目' }].concat(MEASURE.map((m) => ({ k: m, label: m, prop: m })))
      : rs.map((r, j) => ({ k: 'i' + j, label: String(r['检验项目'] || ''), itemIdx: j }))
    return { sector: s, title: (LETTERS[i] || '') + '.' + tt(s), cols, rows: rs, measure: meas }
  })
})

const rowCount = computed(() => {
  let n = 1
  for (const g of groups.value) n = Math.max(n, g.measure ? g.rows.length : 1)
  return n
})

function cellRow(g, c, ri) {
  const i = ri - 1
  if (g.measure) return g.rows[i] || null
  return c.itemIdx != null ? (g.rows[c.itemIdx] || null) : null
}

function fmt(v) {
  if (v === undefined || v === null) return ''
  const s = String(v).trim()
  if (s === '') return ''
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? String(n) : s
  }
  return s
}

function cellText(g, c, ri) {
  const r = cellRow(g, c, ri)
  if (!r) return ''
  if (g.measure) return fmt(r[c.prop])
  return fmt(r['实测数值']) || fmt(r['单项判定'])
}

/* ── 表头字段编辑(与明细格同一套:点击即编辑,回车/失焦提交) ── */
function onMetaClick(k) {
  if (!props.editable) return
  editing.value = { key: 'meta|' + k, row: props.doc, prop: k }
  nextTick(() => {
    const el = Array.isArray(inp.value) ? inp.value[0] : inp.value
    if (el && el.focus) el.focus()
  })
}

function commitMeta(ev, k) {
  props.doc[k] = ev.target.value
  editing.value = null
  emit('dirty')
}

/* ── 单元格编辑(点击即编辑,回车/失焦提交) ── */
const editing = ref(null)
const inp = ref(null)

function onCellClick(g, c, ri) {
  if (!props.editable) return
  const r = cellRow(g, c, ri)
  if (!r) return
  const prop = g.measure ? c.prop : '实测数值'
  if (!prop) return
  editing.value = { key: g.sector + '|' + ri + '|' + c.k, row: r, prop }
  nextTick(() => {
    const el = Array.isArray(inp.value) ? inp.value[0] : inp.value
    if (el && el.focus) el.focus()
  })
}

function commit(ev) {
  if (!editing.value) return
  const { row, prop } = editing.value
  row[prop] = ev.target.value
  editing.value = null
  emit('dirty')
}
</script>

<style scoped>
.qsheet {
  margin: 4px 8px 10px;
  overflow-x: auto;
}
.qsheet-meta {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 6px;
  font-size: 12px;
}
.qsheet-meta th.ml {
  border: 1px solid #c9d4e0;
  background: #f7fafd;
  font-weight: 500;
  text-align: right;
  padding: 2px 6px;
  width: 90px;
  white-space: nowrap;
}
.qsheet-meta td.mv {
  border: 1px solid #c9d4e0;
  text-align: left;
  padding: 2px 6px;
  color: #1f2d3d;
}
.qsheet-meta td.mv.ed {
  cursor: pointer;
}
.qsheet-meta td.mv.ed:hover {
  background: #f0f7ff;
}
.qsheet-tb {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
}
.qsheet-tb th,
.qsheet-tb td {
  border: 1px solid #c9d4e0;
  padding: 2px 4px;
  height: 26px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
/* 组名行:浅蓝底,横跨本组各列 */
.qsheet-tb th.gh {
  background: #eef3f9;
  color: #1f4e79;
  font-weight: 600;
}
.qsheet-tb th.sh {
  background: #f7fafd;
  font-weight: 500;
}
.qsheet-tb th.fc,
.qsheet-tb td.fc {
  background: #fafbfc;
  font-weight: 500;
}
.qsheet-tb td.vc.ed {
  cursor: pointer;
}
.qsheet-tb td.vc.ed:hover {
  background: #f0f7ff;
}
.qsheet-tb .cell-inp {
  width: 100%;
  height: 22px;
  border: 1px solid #5b9bd5;
  outline: none;
  text-align: center;
  font-size: 12px;
}
</style>
