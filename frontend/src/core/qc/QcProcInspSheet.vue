<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表 · 「一个检验项目 = 一列」版

       用户口径(2026-10-16):
         「让当前检验项目可以选择多少格框线,再让当前框线可以增加」
         「当前表可以不实现增加行,只需要保持原有的列增加和列表格增加」
         拍板甲-1:一个检验项目 = 一列,列内格数可加减。
         「对需要几个数据量填写就有几个数据列…当前就预设10个测量数据列,当不使用到数据列的情况下
           就不激活当前的数据列,让当前的检验项目可以选择多少个数据列」
         ⇒ 物理列预置 测量值1..10(值真落库),界面**只渲染本条「格数」用到的前 N 格**(1..10),
            未用到的格既不渲染也不激活;要几格点列头 −/＋。

       版式照纸质《制程检验记录表》:
         标题 → 抬头 → 分区带「检验结果」→ **分组横表**
           · 左侧固定列(检验时间/客户名称/产品编码/型号/批号/抽检总量)= 整表**一行**数据;
           · 每个「表区」= 一组列,组名横跨本组各列;
           · **每个「检验项目」占一列**,列头填项目名,列内格数由本行「格数」决定(1..10);
           · 右侧「结果判断」= 头字段 总结论。
         → (原「检验项目明细」表已按用户 2026-10-16 口径**删除**)
         → 检验结论 / 处理意见 / 检验人 | 审核人

       ⚠ 组类别(定量/定性)由**表区名**判定,不看数据(新建行恒为空,按数据推断会永远判错):
           · 表区名含 尺寸/重量/厚度/直径/长度/宽度/高度 → 定量:第 k 格 = 测量值k(小数列)
           · 其余(外观/性能/卫生安全…)                    → 定性:第 k 格 = 实测数值 按 "/" 拆的第 k 段
         要换判定的关键词只改 QUANT_KEYS。

       ⚠ 新增只有两种,没有「加行」:组内「＋」= 加一列(一个检验项目)、分区带右上「＋新增表区」= 加一张表。
       格数落库在 qc_proc_insp_detail.格数(yj_field 登记 hidden=1/visible=0:值照存照取,不进列表列)。
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

    <!-- ③ 分区带(右上角两个动作:新增表区 / 带入检验项目) -->
    <div class="qr-band">
      <span class="qr-band-title">{{ tt('检验结果') }}</span>
      <span v-if="editable" class="qr-band-acts no-print">
        <span class="qr-band-act2" @click="addGroup()">＋ {{ tt('新增表区') }}</span>
        <span class="qr-band-act2" @click="emit('open-items')">⧉ {{ tt('带入检验项目') }}</span>
      </span>
    </div>

    <!-- ④ 分组横表:一个检验项目 = 一列,列内格数由「格数」决定(可加减) -->
    <table class="qr-grid">
      <thead>
        <tr>
          <th v-for="c in fixedCols" :key="c.k" :rowspan="groups.length ? 2 : 1" class="c-fixed">
            {{ tt(c.label) }}
          </th>
          <th v-for="g in groups" :key="g.sector" :colspan="g.cols.length" class="c-group">
            {{ g.title }}
            <span
              v-if="editable"
              class="qr-grp-add no-print"
              :title="tt('在本表区新增一个检验项目（加一列）')"
              @click.stop="addItemInGroup(g)"
            >＋</span>
          </th>
          <th :rowspan="groups.length ? 2 : 1" class="c-fixed">{{ tt('结果判断') }}</th>
          <th v-if="editable && groups.length" rowspan="2" class="c-op"></th>
        </tr>
        <tr v-if="groups.length">
          <template v-for="g in groups" :key="'sc' + g.sector">
            <th v-for="c in g.cols" :key="'sc' + c.uid" class="c-sub c-item-hd" :title="itemTip(c)">
              <el-input
                v-if="editable"
                v-model="c.row['检验项目']"
                size="small"
                class="qr-cell-input"
                maxlength="100"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text">{{ c.row['检验项目'] || '' }}</span>
              <span v-if="editable" class="qr-cells no-print">
                <span
                  class="qr-cells-btn"
                  :class="{ off: c.cells <= 1 }"
                  :title="tt('减一格')"
                  @click.stop="stepCells(c, -1)"
                >−</span>
                <span class="qr-cells-n" :title="tt('格数')">{{ c.cells }}</span>
                <span
                  class="qr-cells-btn"
                  :class="{ off: c.cells >= MAX_CELLS }"
                  :title="tt('加一格')"
                  @click.stop="stepCells(c, 1)"
                >＋</span>
              </span>
              <span
                v-if="editable"
                class="qr-item-del no-print"
                :title="tt('删除本项')"
                @click.stop="removeItem(c)"
              >×</span>
            </th>
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
            <template v-for="c in g.cols" :key="'g' + g.sector + ri + c.uid">
              <td v-if="ri <= c.cells" class="c-val" :rowspan="cellSpan(c, ri)">
                <el-input
                  v-if="editable"
                  :model-value="cellValue(c, ri)"
                  size="small"
                  class="qr-cell-input qr-cell-wrap"
                  @input="setCell(c, ri, $event)"
                />
                <span v-else class="qr-cell-text">{{ cellValue(c, ri) }}</span>
              </td>
            </template>
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
          <td v-if="editable && ri === 1 && groups.length" class="c-op" :rowspan="rowCount"></td>
        </tr>
        <tr v-if="!groups.length">
          <td :colspan="fixedCols.length + 2 + (editable ? 1 : 0)" class="c-empty">
            {{ editable ? tt('暂无检验项，点右上「＋新增表区」开始') : tt('暂无检验项') }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ 结论区 -->
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

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'open-items'])

/** 定量项(表区名含这些词)的格 = 结构化列 测量值1..10;定性项的格 = 实测数值 按 "/" 拆的段 */
const MEASURE = [
  '测量值1', '测量值2', '测量值3', '测量值4', '测量值5',
  '测量值6', '测量值7', '测量值8', '测量值9', '测量值10',
]
/** 物理列预置 10 个(2026-10-16 用户口径「当前就预设10个测量数据列」),界面只渲染用到的前 N 格 */
const MAX_CELLS = MEASURE.length
/** 新建检验项的默认格数(定量项):沿用老口径 5 格;要几格点列头 −/＋ 自己调(1..10)。
 *  ⚠ 刻意不取 MAX_CELLS ——「不使用到数据列的情况下就不激活」,新项一上来铺满 10 格等于全激活。 */
const DEFAULT_QUANT_CELLS = 5
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const QUANT_KEYS = ['尺寸', '重量', '厚度', '直径', '长度', '宽度', '高度']

/** 左侧固定列(照纸质表:检验时间 | 客户名称 | 产品编码 | 型号(mm) | 批号 | 抽检总量);整表就一行 */
const fixedCols = [
  { k: '检验时间', label: '检验时间', key: '检验时间' },
  { k: '客户名称', label: '客户名称', key: '客户名称' },
  { k: '产品编码', label: '产品编码', key: '产品编码' },
  { k: '型号', label: '型号（mm）', key: '规格型号' },
  { k: '批号', label: '批号', key: '批次号' },
  { k: '抽检总量', label: '抽检总量', key: '抽检总量' },
]

/** 本地版本号:明细数组/行可能被面板做了 raw 处理(非响应式),
 *  push/splice 后不会触发重渲染 —— 用它在组件内**强制刷新**(不依赖面板内部机制)。 */
const bump = ref(0)

/** 检验项明细行:照 QcInspRecSheet 硬编码 head.detail.items */
const items = computed(() => {
  bump.value // ← 建立依赖:变更后强制重算并触发重渲染
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

/** 取(必要时创建)明细数组 —— 照 QcInspRecSheet addItem:
    新建单据 head.detail 可能是 {} 或 {tabs:[…]} 而**没有 items**。 */
function ensureItems() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}

/** 稳定的行键(v-for key 用;新建行没有 id,用本地序号,免得按索引复用 DOM) */
let uidSeq = 0
function uidOf(row) {
  if (!row.__uid) row.__uid = 'q' + (++uidSeq)
  return row.__uid
}

const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))
/** 抬头排除:固定列已显示 + 系统/审计 + 已在表体/结论区出现 */
const HEAD_SKIP = new Set([
  ...fixedCols.map((c) => c.key),
  '单据状态', '处理方式', '表区', '行号', '检验项目', '检验要求',
  '检验方法', '检查频率', '检验仪器', '抽检量', '实测数值', ...MEASURE, '单项判定',
  '不合格应对措施', '不良数量',
  '结果判断', '备注2', '备注', '总结论', '检验员', '审核人', '审核时间', '格数',
])
const headRows = computed(() => {
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName && !HEAD_SKIP.has(f.dataName))
    .map((f) => f.dataName)
  const rows = []
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2))
  return rows
})

/** 表区名 → 定量组?(只看名字,不看数据 —— 新建行恒为空,按数据推断会永远判错) */
function isQuant(sector) {
  const s = String(sector ?? '')
  return QUANT_KEYS.some((k) => s.includes(k))
}

/** 数值列 → 显示串(去尾零;0 视为未填,与报表 ReportService.num 同口径) */
function numText(v) {
  if (v === undefined || v === null) return ''
  const s = String(v).trim()
  if (!s) return ''
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    return n === 0 ? '' : String(n)
  }
  return s
}

/** 定性项的格值 = 实测数值 按 "/" 拆的段 */
function segsOf(row) {
  const raw = String(row['实测数值'] ?? '').trim()
  return raw ? raw.split('/').map((s) => s.trim()) : []
}

/** 本行的格数:优先读落库的「格数」;取不到按老口径推(定量=已填到第几格或默认 5 格,定性=段数或 1) */
function cellCount(row, quant) {
  const n = Number(row['格数'])
  if (Number.isFinite(n) && n > 0) return Math.min(Math.max(Math.round(n), 1), MAX_CELLS)
  if (quant) {
    let last = 0
    MEASURE.forEach((m, i) => { if (numText(row[m])) last = i + 1 })
    return last || DEFAULT_QUANT_CELLS
  }
  return Math.max(segsOf(row).length, 1)
}

/** 按「表区」分组:组 = 横向并排的一张表,组里**每一项 = 一列** */
const groups = computed(() => {
  bump.value
  const order = []
  const map = new Map()
  for (const r of items.value) {
    const s = String(r['表区'] ?? '').trim()
    if (!s) continue // 空表区 = 还没归类,只在下方「检验项目明细」里可见/可改
    if (!map.has(s)) { map.set(s, []); order.push(s) }
    map.get(s).push(r)
  }
  return order.map((s, i) => {
    const quant = isQuant(s)
    const cols = map.get(s).map((r) => ({ row: r, uid: uidOf(r), quant, cells: cellCount(r, quant) }))
    return { sector: s, quant, title: (LETTERS[i] || '') + '.' + tt(s), cols }
  })
})

/** 横表行数 = 所有列里最长的格数(整表共用一行数据,左固定列纵向合并) */
const rowCount = computed(() => {
  let n = 1
  for (const g of groups.value) for (const c of g.cols) n = Math.max(n, c.cells)
  return n
})

/** 第 ri 格占几行:最后一格吞掉余下的行,列与列之间边框才对齐(照纸质表的合并格) */
function cellSpan(c, ri) {
  return ri === c.cells ? rowCount.value - c.cells + 1 : 1
}

/** 单元格值:定量 = 测量值k;定性 = 实测数值 的第 k 段 */
function cellValue(c, ri) {
  if (c.quant) return numText(c.row['测量值' + ri])
  return segsOf(c.row)[ri - 1] || ''
}

/** 单元格录入:定量写 测量值k;定性写回 实测数值(按 "/" 拼,尾部空段不留) */
function setCell(c, ri, v) {
  const val = String(v ?? '')
  if (c.quant) {
    c.row['测量值' + ri] = val.trim() === '' ? null : val
  } else {
    const segs = segsOf(c.row)
    while (segs.length < c.cells) segs.push('')
    segs[ri - 1] = val
    while (segs.length && !String(segs[segs.length - 1]).trim()) segs.pop()
    c.row['实测数值'] = segs.join('/')
  }
  emit('dirty')
}

/** 列头加减格数(减格时把被撤掉的格清干净,免得留下"看不见的旧值"被报表读走) */
function stepCells(c, delta) {
  const next = Math.min(Math.max(c.cells + delta, 1), MAX_CELLS)
  if (next === c.cells) return
  c.row['格数'] = next
  if (next < c.cells) {
    if (c.quant) {
      for (let k = next + 1; k <= MAX_CELLS; k++) c.row['测量值' + k] = null
    } else {
      c.row['实测数值'] = segsOf(c.row).slice(0, next).join('/')
    }
  }
  bump.value++
  emit('dirty')
}

/** 列头 tooltip:检验要求 / 检验方法(横表只放实测值,标准要求在这里看) */
function itemTip(c) {
  const out = []
  const req = String(c.row['检验要求'] ?? '').trim()
  const mtd = String(c.row['检验方法'] ?? '').trim()
  if (req) out.push(tt('检验要求') + '：' + req)
  if (mtd) out.push(tt('检验方法') + '：' + mtd)
  return out.join('\n')
}

function isDateKey(k) {
  const t = fieldMap.value.get(k)?.dataType
  return t === '日期' || t === '日期时间'
}
function isLockedKey(k) {
  const f = fieldMap.value.get(k)
  return !f || f.editable === false || f.editable === 0
}

/** 组内新增一个检验项目(= 该组加一列) */
function addItemInGroup(g) {
  if (!g) return
  ensureItems().push({ 表区: g.sector, 检验项目: '', 检验要求: '', 检验方法: '', 单项判定: '', 格数: g.quant ? DEFAULT_QUANT_CELLS : 1 })
  bump.value++      // 明细非响应式:手动强制刷新
  emit('dirty')
}

/** 删除一个检验项目(= 删掉那一列) */
function removeItem(c) {
  if (!c) return
  const arr = ensureItems()
  const i = arr.indexOf(c.row)
  if (i >= 0) { arr.splice(i, 1); bump.value++; emit('dirty') }
}

/** 新增表区(加一整组列):让用户输入表区名,再建一列挂到该表区 */
async function addGroup() {
  let name = ''
  try {
    const r = await ElMessageBox.prompt(
      tt('请输入表区名称（如：外观 / 尺寸 / 出货重量）'),
      tt('新增表区'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), inputPattern: /\S/, inputErrorMessage: tt('表区名称不能为空') },
    )
    name = String(r.value || '').trim()
  } catch { return }
  if (!name) return
  ensureItems().push({ 表区: name, 检验项目: '', 检验要求: '', 检验方法: '', 单项判定: '', 格数: isQuant(name) ? DEFAULT_QUANT_CELLS : 1 })
  bump.value++
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
/* 分区带右上角动作:新增表区 / 带入检验项目 */
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
/* 列头(一项一列):项目名 + 格数加减 */
.c-item-hd {
  position: relative;
}
.qr-cells {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 400;
  color: #2b6cb0;
}
.qr-cells-btn {
  display: inline-block;
  width: 16px;
  line-height: 14px;
  border: 1px solid #9db8d2;
  border-radius: 2px;
  cursor: pointer;
  user-select: none;
  background: #fff;
}
.qr-cells-btn:hover {
  border-color: #5b9bd5;
  background: #f2f8ff;
}
.qr-cells-btn.off {
  color: #c2cbd6;
  border-color: #dde4ec;
  cursor: default;
}
.qr-cells-btn.off:hover {
  background: #fff;
}
.qr-cells-n {
  display: inline-block;
  min-width: 16px;
  margin: 0 4px;
}
.qr-item-del {
  position: absolute;
  right: 2px;
  top: 0;
  font-weight: 700;
  color: #f56c6c;
  cursor: pointer;
}
.c-op {
  width: 34px;
}
.c-empty {
  color: #8a94a0;
  padding: 12px 0;
}
.qr-grp-add {
  margin-left: 6px;
  cursor: pointer;
  font-weight: 700;
  color: #2b6cb0;
}
.qr-grp-add:hover {
  color: #1f4e79;
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
