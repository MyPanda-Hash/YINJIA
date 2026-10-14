<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表(2026-10-12)
       写法仿 QcInspRecSheet(检验数据记录):标题 → 抬头 标签|值 → 分区表体 → 结论,
       单元格 editable 守卫 + v-model 直绑 + @input=emit('dirty');
       行数据取 head.detail 下的明细数组(与 QcInspRecSheet 同款契约,不另设 rows prop)。

       与 QcInspRecSheet 的差异(按用户截图):**表体按「表区」横向分组** ——
       外观 | 尺寸 | 出货重量 … 并排,组名横跨本组各列(两层表头)。
         · 定性组(外观/材质/包装…):列 = 该组各检验项目,单元格 = 实测数值
         · 定量组(尺寸/重量/性能…):列 = 项目 + 测量值1..5,行 = 该组各检验项目
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet">
    <!-- ① 标题 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('制程检验记录表') }}</div>
    </div>

    <!-- ② 抬头:面板表头字段,每行 4 组 标签|值(值可填) -->
    <table class="qr-head-table">
      <tbody>
        <tr v-for="(row, ri) in headRows" :key="'h' + ri">
          <template v-for="k in row" :key="k">
            <th class="qr-label">{{ tt(k) }}</th>
            <td class="qr-value">
              <el-input
                v-if="editable"
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

    <!-- ③ 表体:表区横向分组 -->
    <table class="qr-table">
      <thead>
        <tr>
          <th v-for="h in fixedCols" :key="h.k" rowspan="2" class="c-fixed">{{ tt(h.label) }}</th>
          <th v-for="g in groups" :key="g.sector" :colspan="g.cols.length" class="c-group">{{ g.title }}</th>
          <th rowspan="2" class="c-fixed">{{ tt('结果判断') }}</th>
        </tr>
        <tr>
          <template v-for="g in groups" :key="'c' + g.sector">
            <th v-for="c in g.cols" :key="'c' + g.sector + c.k" class="c-sub">{{ c.label }}</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ri in rowCount" :key="'r' + ri">
          <template v-if="ri === 1">
            <td v-for="h in fixedCols" :key="'f' + h.k" class="c-fixed" :rowspan="rowCount">{{ head[h.key] || '' }}</td>
          </template>
          <template v-for="g in groups" :key="'g' + g.sector + ri">
            <td v-for="c in g.cols" :key="'g' + g.sector + ri + c.k" class="c-val">
              <template v-if="cellRow(g, c, ri)">
                <el-input
                  v-if="editable"
                  v-model="cellRow(g, c, ri)[g.measure ? c.prop : '实测数值']"
                  size="small"
                  class="qr-cell-input"
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

/** 明细行:取 head.detail 下第一个数组(通常 items) */
const items = computed(() => {
  const d = props.head?.detail
  if (!d) return []
  for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k]
  return []
})

/** 左侧固定列(照截图:产品编码 | 型号(mm) | 批号 | 抽检总量) */
const fixedCols = [
  { k: '产品编码', label: '产品编码', key: '产品编码' },
  { k: '型号', label: '型号（mm)', key: '规格型号' },
  { k: '批号', label: '批号', key: '批次号' },
  { k: '抽检总量', label: '抽检总量', key: '抽检总量' },
]

/** 抬头字段行(每行 4 组):由 fields 驱动,已在固定列的不重复 */
const headRows = computed(() => {
  const skip = new Set(fixedCols.map((c) => c.key))
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName)
    .map((f) => f.dataName)
    .filter((k) => !skip.has(k))
  const rows = []
  for (let i = 0; i < names.length; i += 4) rows.push(names.slice(i, i + 4))
  return rows
})

const MEASURE = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const isMeasure = (rows) => rows.some((r) => MEASURE.some((m) => {
  const v = String(r[m] ?? '').trim()
  return v !== '' && v !== '0'
}))

/** 按「表区」横向分组 */
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

function cellText(g, c, ri) {
  const r = cellRow(g, c, ri)
  if (!r) return ''
  const v = g.measure ? r[c.prop] : (r['实测数值'] || r['单项判定'])
  if (v === undefined || v === null || String(v).trim() === '') return ''
  const s = String(v).trim()
  return /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : s
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
/* 抬头表:标签右对齐 + 值左对齐,贴报表观感 */
.qr-head-table {
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
/* 表体:组名跨列的两层表头 */
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
  height: 26px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
.qr-table th.c-group {
  background: #eef3f9;
  color: #1f4e79;
  font-weight: 600;
}
.qr-table th.c-sub {
  background: #f7fafd;
  font-weight: 500;
}
.qr-table th.c-fixed,
.qr-table td.c-fixed {
  background: #fafbfc;
  font-weight: 500;
}
/* 单元格内输入:铺满格子(与 QcInspRecSheet 的 qr-cell-input 同款) */
.qr-cell-input :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding: 0 2px;
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
