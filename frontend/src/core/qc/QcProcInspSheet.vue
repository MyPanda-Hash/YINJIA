<template>
  <!-- 制程检验单 · 交叉表版式(2026-10-12)
       用户口径:「照截图:横向组头」—— 外观 | 尺寸 | 出货重量 等**表区并排**,
       组名横跨在本组各列之上(两层表头);固定头列在左、结果判断在右。
       数据来源仍是明细行(每行=一个检验项目),按「表区」横向分组渲染:
         · 定性组(外观/材质/包装…):列 = 该组各检验项目名,单元格 = 实测值/判定
         · 定量组(尺寸/重量/性能…):列 = 项目 + 测量值1..5,行 = 该组各检验项目 -->
  <div class="qsheet">
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
          <!-- 固定头列只在首行渲染并纵向合并(照截图:左侧一列跨整块) -->
          <template v-if="ri === 1">
            <td v-for="h in headCols" :key="'h' + h.k" class="fc" :rowspan="rowCount">{{ fmt(doc[h.key]) }}</td>
          </template>
          <template v-for="g in groups" :key="'g' + g.sector + ri">
            <td
              v-for="c in g.cols"
              :key="'g' + g.sector + ri + c.k"
              class="vc"
              :class="{ ed: editable && cellRow(g, c, ri) }"
              @click="onCellClick(g, c, ri, $event)"
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
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

/** 左侧固定列(来自单据头;照截图:产品编码 | 型号(mm) | 批号 | 抽检总量) */
const headCols = [
  { k: '产品编码', label: '产品编码', key: '产品编码' },
  { k: '型号', label: '型号（mm)', key: '规格型号' },
  { k: '批号', label: '批号', key: '批次号' },
  { k: '抽检总量', label: '抽检总量', key: '抽检总量' },
]
const MEASURE = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** 该组是否定量(有任意测量值) */
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
      ? [{ k: '项目', label: '项目' }].concat(
          MEASURE.map((m) => ({ k: m, label: m, prop: m })))
      : rs.map((r, j) => ({ k: 'i' + j, label: String(r['检验项目'] || ''), itemIdx: j }))
    return { sector: s, title: (LETTERS[i] || '') + '.' + tt(s), cols, rows: rs, measure: meas }
  })
})

/** 行数 = 各定量组的项目数取最大(定性组占第 1 行) */
const rowCount = computed(() => {
  let n = 1
  for (const g of groups.value) n = Math.max(n, g.measure ? g.rows.length : 1)
  return n
})

/** 某单元格对应的明细行 */
function cellRow(g, c, ri) {
  const i = ri - 1
  if (g.measure) return g.rows[i] || null
  return c.itemIdx != null ? (g.rows[c.itemIdx] || null) : null
}

function fmt(v) {
  if (v === undefined || v === null) return ''
  const s = String(v).trim()
  if (s === '') return ''
  // 纯数值去尾零(44.5000 → 44.5)
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
