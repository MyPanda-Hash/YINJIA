<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       制程检验单(QC_PROC_INSP)—— 纸张式可填写报表 · 图2「分组横表 + 固定列」版

       用户口径(2026-10-17,接着 2026-10-16 的「一个检验项目 = 一列」继续收敛):
         「仿照当前研发处的功能性滤效完成对这个制程检验单的实现能自定义增加表格列,
           然后针对当前制程检验表增加几个固定列,仿照图2的形式实现」
         ① 版式照图2:左侧 6 个单据要素(检验时间|客户名称|产品编码|型号（mm）|批号|抽检总量)
            → 中间按「表区」分组(外观|尺寸|出货重量,组名横跨本组各列)→ 右侧「结果判断」;
         ② **固定列** = 外观组先铺「端盖两头」「管身两侧」两个标准项列,永远渲染、不可删;
         ③ **自定义列** = 仿功能性滤效的动态样品列:表头一个「列数」字段 + **表格外** −/＋ 控件,
            列数决定各表区铺几列自定义列(不足补空列、空列列头可填检验项目名);
            减列 = 清空该列已填数据(确认弹窗,照功能性滤效口径);
         ④ 没有数据的标准表区也照铺 ⇒ 空单打开就是图2 的样子(不再是「暂无检验项」一行)。

       列模型(表区/固定项/列数/减列)全在 core/sheet/procInspCols.js(纯函数 + 单测),
       本组件只负责渲染与落库 —— 别再往组件里手写列清单。

       ⚠ 组类别(定量/定性)由**表区名**判定,不看数据(新建行恒为空,按数据推断会永远判错):
           · 表区名含 尺寸/重量/厚度/直径/长度/宽度/高度 → 定量:第 k 格 = 测量值k(小数列)
           · 其余(外观/性能/卫生安全…)                    → 定性:第 k 格 = 实测数值 按 "/" 拆的第 k 段
         要换判定的关键词只改 QUANT_KEYS。

       ⚠ 空列(还没填项目名的自定义列)是**惰性**的:列头一填项目名 / 格子里一输入,
         才真正建出一行明细(表区=本组、检验项目=填的名字),免得空单保存出一堆空行。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet">
    <!-- ① 标题 + 列数控制(表格外,打印隐藏) -->
    <div class="qr-titlebar">
      <div class="qr-title">{{ tt('制程检验记录表') }}</div>
      <div v-if="editable" class="qr-colbar no-print">
        <span class="qr-colbar-label">{{ tt('列数') }}</span>
        <span
          class="qr-colbar-btn"
          :class="{ dim: cols <= MIN_COLS }"
          :title="tt('减少一列(清空该列已填数据)')"
          @click="stepCols(-1)"
        >－</span>
        <span class="qr-colbar-num" :title="colsTip">{{ cols }}</span>
        <span
          class="qr-colbar-btn"
          :class="{ dim: cols >= MAX_COLS }"
          :title="tt('增加一列')"
          @click="stepCols(1)"
        >＋</span>
      </div>
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
        <span class="qr-band-act2" @click="addSector()">＋ {{ tt('新增表区') }}</span>
        <span class="qr-band-act2" @click="emit('open-items')">⧉ {{ tt('带入检验项目') }}</span>
      </span>
    </div>

    <!-- ④ 分组横表:固定列(单据要素) + 各表区(固定项列 + 自定义列) + 结果判断 -->
    <table class="qr-grid">
      <thead>
        <tr>
          <th v-for="c in fixedCols" :key="c.k" :rowspan="2" class="c-fixed">{{ tt(c.label) }}</th>
          <th
            v-for="g in groups"
            :key="'g' + g.key"
            :colspan="g.fixed.length + g.custom.length"
            class="c-group"
          >{{ tt(g.title) }}</th>
          <th :rowspan="2" class="c-fixed c-verdict-hd">{{ tt('结果判断') }}</th>
          <th v-if="editable" :rowspan="2" class="c-op"></th>
        </tr>
        <tr>
          <template v-for="g in groups" :key="'sub' + g.key">
            <!-- 固定列(端盖两头 / 管身两侧):不可删 -->
            <th
              v-for="f in g.fixed"
              :key="'f' + g.key + f.name"
              class="c-sub c-item-hd c-fixeditem"
              :title="tt('固定列（不可删）')"
            >
              <span class="qr-cell-text">{{ tt(f.name) }}</span>
              <span v-if="editable" class="qr-cells no-print">
                <span
                  class="qr-cells-btn"
                  :class="{ off: cellsOf(g, f) <= 1 }"
                  :title="tt('减一格')"
                  @click.stop="stepCells(g, f, -1)"
                >−</span>
                <span class="qr-cells-n" :title="cellTip(f.row)">{{ cellsOf(g, f) }}</span>
                <span
                  class="qr-cells-btn"
                  :class="{ off: cellsOf(g, f) >= maxCellsOf(f.row) }"
                  :title="cellsAddTip(f.row)"
                  @click.stop="stepCells(g, f, 1)"
                >＋</span>
              </span>
            </th>
            <!-- 自定义列:列头可填检验项目名,空列按「按照XX检验项目填充」提示 -->
            <th
              v-for="c in g.custom"
              :key="'c' + g.key + c.index"
              class="c-sub c-item-hd"
              :title="itemTip(c.row)"
            >
              <el-input
                v-if="editable"
                :model-value="itemNameOf(c)"
                size="small"
                class="qr-cell-input"
                maxlength="100"
                :placeholder="fillHint(g)"
                @input="setItemName(g, c, $event)"
              />
              <span v-else-if="itemNameOf(c)" class="qr-cell-text">{{ itemNameOf(c) }}</span>
              <span v-else class="qr-cell-hint">{{ fillHint(g) }}</span>
              <span v-if="editable" class="qr-cells no-print">
                <span
                  class="qr-cells-btn"
                  :class="{ off: cellsOf(g, c) <= 1 }"
                  :title="tt('减一格')"
                  @click.stop="stepCells(g, c, -1)"
                >−</span>
                <span class="qr-cells-n" :title="cellTip(c.row)">{{ cellsOf(g, c) }}</span>
                <span
                  class="qr-cells-btn"
                  :class="{ off: cellsOf(g, c) >= maxCellsOf(c.row) }"
                  :title="cellsAddTip(c.row)"
                  @click.stop="stepCells(g, c, 1)"
                >＋</span>
              </span>
              <span
                v-if="editable && c.row"
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
            <td v-for="c in fixedCols" :key="'fx' + c.k" class="c-fixed" :rowspan="rowCount">
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
          <template v-for="g in groups" :key="'b' + g.key + ri">
            <template v-for="f in g.fixed" :key="'bf' + g.key + f.name + ri">
              <td v-if="ri <= cellsOf(g, f)" class="c-val" :rowspan="spanOf(cellsOf(g, f), ri)">
                <el-input
                  v-if="editable"
                  :model-value="cellValue(g, f, ri)"
                  size="small"
                  class="qr-cell-input qr-cell-wrap"
                  @input="setCell(g, f, ri, $event)"
                />
                <span v-else class="qr-cell-text">{{ cellValue(g, f, ri) }}</span>
              </td>
            </template>
            <template v-for="c in g.custom" :key="'bc' + g.key + c.index + ri">
              <td v-if="ri <= cellsOf(g, c)" class="c-val" :rowspan="spanOf(cellsOf(g, c), ri)">
                <el-input
                  v-if="editable && c.row"
                  :model-value="cellValue(g, c, ri)"
                  size="small"
                  class="qr-cell-input qr-cell-wrap"
                  @input="setCell(g, c, ri, $event)"
                />
                <span v-else-if="c.row" class="qr-cell-text">{{ cellValue(g, c, ri) }}</span>
                <span v-else class="qr-cell-hint no-print">{{ tt('先填列头项目名') }}</span>
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
          <td v-if="editable && ri === 1" class="c-op" :rowspan="rowCount"></td>
        </tr>
        <!-- 未归类行(表区为空):列表/报表里看得见,这里也给一行提示,不静默吞掉 -->
        <tr v-if="orphans.length">
          <td :colspan="totalCols" class="c-orphan">
            {{ tt('有 {n} 行还没归类（表区为空），请在明细列表里补表区').replace('{n}', String(orphans.length)) }}
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
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  MAX_COLS,
  MIN_COLS,
  buildSectors,
  clampCols,
  dropRows,
  effectiveCols,
  removedRowsForCols,
} from '@/core/sheet/procInspCols.js'

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
/** 新建检验项的默认格数(定量项):沿用老口径 5 格;要几格点列头 −/＋ 自己调(1..10)。 */
const DEFAULT_QUANT_CELLS = 5
/** 列头「格数 ≤ N」的判定关键词:与下面 isQuant() 同一套(表区名含这些词 = 定量组) */
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

const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))
/** 抬头排除:固定列已显示 + 系统/审计 + 已在表体/结论区出现 */
const HEAD_SKIP = new Set([
  ...fixedCols.map((c) => c.key),
  '单据状态', '处理方式', '表区', '行号', '检验项目', '检验要求',
  '检验方法', '检查频率', '检验仪器', '抽检量', '实测数值', ...MEASURE, '单项判定',
  '不合格应对措施', '不良数量',
  '结果判断', '备注2', '备注', '总结论', '检验员', '审核人', '审核时间', '格数', '格数上限', '列数',
])
const headRows = computed(() => {
  const names = (props.fields || [])
    .filter((f) => f && !f.hidden && f.dataName && !HEAD_SKIP.has(f.dataName))
    .map((f) => f.dataName)
  const rows = []
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2))
  return rows
})

/** 表区名 → 定量组? */
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
  const raw = String(row?.['实测数值'] ?? '').trim()
  return raw ? raw.split('/').map((s) => s.trim()) : []
}

/** 本行的格数上限(2026-10-16):来自检验方案的「检验数量」,带入时落到本行的 `格数上限`;
 *  空 = 不设上限(存量单与手工新增的列照旧自由加减,兼容老行为)。物理列只有 10 个测量值,故再封一次顶。 */
function maxCellsOf(row) {
  const n = Number(row?.['格数上限'])
  if (!Number.isFinite(n) || n <= 0) return MAX_CELLS
  return Math.min(Math.max(Math.round(n), 1), MAX_CELLS)
}

/** 列头格数 tooltip:有检验数量上限时报清楚「格数 ≤ N」,免得用户以为点了没反应 */
function cellTip(row) {
  const cap = maxCellsOf(row)
  return cap < MAX_CELLS ? `${tt('格数')} ≤ ${cap}（${tt('检验数量')}）` : tt('格数')
}
function cellsAddTip(row) {
  const cap = maxCellsOf(row)
  return cap < MAX_CELLS ? tt('检验数量就这么几格，加不了了') : tt('加一格')
}

/** 本行的格数:优先读落库的「格数」;取不到按老口径推(定量=已填到第几格或默认 5 格,定性=段数或 1) */
function cellCount(row, quant) {
  const n = Number(row['格数'])
  if (Number.isFinite(n) && n > 0) return Math.min(Math.max(Math.round(n), 1), maxCellsOf(row))
  if (quant) {
    let last = 0
    MEASURE.forEach((m, i) => { if (numText(row[m])) last = i + 1 })
    return Math.min(last || DEFAULT_QUANT_CELLS, maxCellsOf(row))
  }
  return Math.min(Math.max(segsOf(row).length, 1), maxCellsOf(row))
}

/** ── 列模型(表区/固定项/列数)全部来自 core/sheet/procInspCols.js ── */
/** 本单实际铺几列自定义列 = max(存库「列数」, 各表区已有自定义行数) —— 绝不藏已有数据 */
const cols = computed(() => {
  bump.value
  return effectiveCols(props.head?.['列数'], items.value)
})
const groups = computed(() => {
  bump.value
  return buildSectors(items.value, cols.value)
})
/** 表区为空的未归类行(不参与列组,单独提示) */
const orphans = computed(() => items.value.filter((r) => r && !String(r['表区'] ?? '').trim()))

/** 列头空列的提示:图2 的「按照外观检验项目填充」*/
function fillHint(g) {
  return tt('按照{sec}检验项目填充').replace('{sec}', tt(g.title))
}
function colTip() {
  const stored = clampCols(props.head?.['列数'])
  const real = cols.value
  return real > stored
    ? tt('本单已有 {n} 列（按存量数据），点 － 可减列并清空该列数据').replace('{n}', String(real))
    : tt('列数')
}
const colsTip = computed(() => colTip())

/** 本列用到的格数(空列恒 1 格:还没建行) */
function cellsOf(g, col) {
  if (!col.row) return 1
  return cellCount(col.row, isQuant(col.row['表区'] || g.key))
}
/** 第 ri 格占几行:最后一格吞掉余下的行,列与列之间边框才对齐(照纸质表的合并格) */
function spanOf(cells, ri) {
  return ri === cells ? rowCount.value - cells + 1 : 1
}
/** 横表行数 = 所有列里最长的格数(整表共用一行数据,左固定列纵向合并) */
const rowCount = computed(() => {
  let n = 1
  for (const g of groups.value) {
    for (const f of g.fixed) n = Math.max(n, cellsOf(g, f))
    for (const c of g.custom) n = Math.max(n, cellsOf(g, c))
  }
  return n
})
/** 横表总列数(未归类提示行 colspan 用) */
const totalCols = computed(() => {
  let n = fixedCols.length + 1 + (props.editable ? 1 : 0)   // 固定列 + 结果判断 + 操作列
  for (const g of groups.value) n += g.fixed.length + g.custom.length
  return n
})

/** 列头项目名(空列 = 没行 = 空串) */
function itemNameOf(col) {
  return col.row ? String(col.row['检验项目'] || '') : ''
}

/** 得到一个真实明细行:空列第一次被填时**惰性建行**(表区=本组、检验项目=列头名/固定项名) */
function ensureRow(col, sectorKey, fixedName) {
  if (col.row) return col.row
  const nextNo = items.value.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0) + 1
  const row = {
    表区: sectorKey,
    检验项目: fixedName || '',
    行号: nextNo,
    检验要求: '',
    检验方法: '',
    单项判定: '',
    格数: 1,
  }
  ensureItems().push(row)
  col.row = row          // 同一事件里再用到 col 时不必重建
  bump.value++
  return row
}

/** 列头填检验项目名(第一次填就建行) */
function setItemName(g, col, v) {
  const row = ensureRow(col, g.key, '')
  row['检验项目'] = String(v ?? '')
  bump.value++
  emit('dirty')
}

/** 单元格值:定量 = 测量值k;定性 = 实测数值 的第 k 段(空列 = 空) */
function cellValue(g, col, ri) {
  if (!col.row) return ''
  return isQuant(col.row['表区'] || g.key)
    ? numText(col.row['测量值' + ri])
    : (segsOf(col.row)[ri - 1] || '')
}

/** 单元格录入:定量写 测量值k;定性写回 实测数值(按 "/" 拼,尾部空段不留) */
function setCell(g, col, ri, v) {
  const row = ensureRow(col, g.key, col.name || '')
  const val = String(v ?? '')
  if (isQuant(row['表区'] || g.key)) {
    row['测量值' + ri] = val.trim() === '' ? null : val
  } else {
    const segs = segsOf(row)
    while (segs.length < Math.max(cellsOf(g, col), 1)) segs.push('')
    segs[ri - 1] = val
    while (segs.length && !String(segs[segs.length - 1]).trim()) segs.pop()
    row['实测数值'] = segs.join('/')
  }
  bump.value++
  emit('dirty')
}

/** 列头加减格数(减格时把被撤掉的格清干净,免得留下"看不见的旧值"被报表读走)。
 *  上限 = min(方案的检验数量, 10) —— 用户 2026-10-16 口径「列头 ＋ 加不过这个数」。 */
function stepCells(g, col, delta) {
  const row = ensureRow(col, g.key, col.name || '')
  const quant = isQuant(row['表区'] || g.key)
  const cur = cellsOf(g, col)
  const next = Math.min(Math.max(cur + delta, 1), maxCellsOf(row))
  if (next === cur) return
  row['格数'] = next
  if (next < cur) {
    if (quant) {
      for (let k = next + 1; k <= MAX_CELLS; k++) row['测量值' + k] = null
    } else {
      row['实测数值'] = segsOf(row).slice(0, next).join('/')
    }
  }
  bump.value++
  emit('dirty')
}

/** 列头 tooltip:检验要求 / 检验方法(横表只放实测值,标准要求在这里看) */
function itemTip(row) {
  if (!row) return ''
  const out = []
  const req = String(row['检验要求'] ?? '').trim()
  const mtd = String(row['检验方法'] ?? '').trim()
  if (req) out.push(tt('检验要求') + '：' + req)
  if (mtd) out.push(tt('检验方法') + '：' + mtd)
  return out.join('\n')
}

/** 删除一个自定义检验项(= 删掉那一列) */
function removeItem(col) {
  if (!col || !col.row) return
  const arr = ensureItems()
  const i = arr.indexOf(col.row)
  if (i >= 0) { arr.splice(i, 1); bump.value++; emit('dirty') }
}

/** 列数 −/＋:加列只抬列数;减列**清空该列已填数据**(删掉各表区第 n+1 列起的自定义行,确认弹窗) */
async function stepCols(delta) {
  if (!props.editable) return
  const cur = cols.value
  const next = cur + delta
  if (next < MIN_COLS) return ElMessage.warning(tt('已是最少列数'))
  if (next > MAX_COLS) return ElMessage.warning(tt('已是最大列数'))
  if (delta < 0) {
    const victims = removedRowsForCols(items.value, next)
    if (victims.length) {
      try {
        await ElMessageBox.confirm(
          tt('减少列将清空该列已填数据，确定减少吗？'), tt('减少列'),
          { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
        )
      } catch { return /* 取消 */ }
      dropRows(ensureItems(), victims)
    }
  }
  props.head['列数'] = String(next)
  bump.value++
  emit('dirty')
}

/** 新增表区(加一整组列):让用户输入表区名,再建一列挂到该表区 */
async function addSector() {
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
  ensureItems().push({ 表区: name, 检验项目: '', 检验要求: '', 检验方法: '', 单项判定: '', 格数: 1 })
  bump.value++
  emit('dirty')
}

function isDateKey(k) {
  const t = fieldMap.value.get(k)?.dataType
  return t === '日期' || t === '日期时间'
}
/** 只读判定:**登记过**且明确 editable=false 才算锁定(未登记 ≠ 锁定 ——
 *  固定列里的 检验时间/批号 等是 hidden 字段,不进 fields,但纸面照样要能填) */
function isLockedKey(k) {
  const f = fieldMap.value.get(k)
  return !!f && (f.editable === false || f.editable === 0)
}
</script>

<style scoped>
.qr-sheet {
  background: #fff;
  border: 1px solid #d7dce5;
  padding: 10px 12px 14px;
  margin: 0 6px 8px;
}
.qr-titlebar {
  position: relative;
  text-align: center;
  margin-bottom: 10px;
  min-height: 26px;
}
.qr-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #1f4e79;
}
/* 列数控制(表格外,右对齐;打印隐藏) */
.qr-colbar {
  position: absolute;
  right: 0;
  top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.qr-colbar-label {
  font-size: 12.5px;
  color: #1c4f8a;
}
.qr-colbar-btn {
  width: 20px;
  height: 20px;
  line-height: 18px;
  text-align: center;
  border: 1px solid #8fb4e0;
  border-radius: 3px;
  color: #0d5bd3;
  background: #f4f9ff;
  cursor: pointer;
  font-size: 13px;
}
.qr-colbar-btn:hover {
  background: #e8f2ff;
}
.qr-colbar-btn.dim {
  color: #b6c2d0;
  border-color: #d4dde6;
  background: #f7fafc;
  cursor: not-allowed;
}
.qr-colbar-num {
  min-width: 16px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #333;
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
/* 固定列(端盖两头/管身两侧):浅底 + 左侧竖线,示意"不可删" */
.qr-grid th.c-fixeditem {
  background: #eef5fc;
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
.c-empty,
.c-orphan {
  color: #8a94a0;
  padding: 8px 0;
}
.c-orphan {
  background: #fffbf0;
  color: #b8860b;
}
/* 空列占位提示(图2 的「按照XX检验项目填充」) */
.qr-cell-hint {
  display: inline-block;
  min-height: 18px;
  color: #9aa7b4;
  font-size: 11px;
  line-height: 15px;
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
@media print {
  .qr-colbar,
  .no-print {
    display: none !important;
  }
}
</style>
