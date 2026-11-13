/**
 * recipeExport.js —— 配方表「设计添加量」的单位口径 + 配方表导出件（纯函数，无 Vue/无 IO）
 *                    2026-11-11
 *
 * 【用户口径（研发管理优化 第 3 条，逐字）】
 *   「① 物料1第一行无带出的设计添加量数据 ② 粉料段和胶粉导出的设计添加量没有百分比号单位
 *     （若为功能料-颗粒属性则单位为 g/支）③ 设计添加量合计 = 非颗粒料比例（%）相加，
 *     颗粒料按 g/支」；追问单位显示时答复「**纸面和导出件都带单位**」；
 *   同一轮追加：「导出数值的时候只需要保留 2 位小数就行，没有数据的行就自动删除」。
 *
 * 【为什么设计添加量必须带单位，而别的列不用】
 *   实际添加比例/单支物料含量是**算出来的**，列头已经写着 `%` / `g`，一格只有一个单位；
 *   设计添加量是**人录的**，同一列里粉料/胶粉是百分数、功能料-颗粒（引擎里的「折算料」位）
 *   是克/支 —— 列头写不下两个单位，只能落到每一格。这也是纸面 `设计添加量` 列头
 *   一直没有单位后缀的原因（对照 screenshot：列头 `设计添加\n量`）。
 *
 * 【合计为什么只加 % 行】
 *   `%` 与 `g/支` 不是同一量纲，相加没有意义。用户口径「这个最终的数值一定是 100%」：
 *   粉料+胶粉（料位 2~7）合计 100%，料位 1 是补差位（1 − Σ料位2~7），所以**合计恒为 100.00%**。
 *   颗粒料那几行的克数不进这个合计。
 *
 * 【跟 core/mold/recipeSheet.js 的分工】
 *   那边是**引擎输入**的口径（parseRatio / parseNumber 要能吃回带单位的文本）；
 *   这边是**落格/出纸/导出**的口径（把数字写成 `50.00%` / `3.00 g/支`）。两边共用
 *   `stripUnit` 一个剥离函数，避免"写进去的读不回来"。
 */

import { groupOfMaterialType, stripUnit, SLOT_GROUPS } from './recipeSheet.js'

/** 配方表里「设计添加量」的数据键（纸面列键，ADR-0001 中文） */
export const DESIGN_KEY = '设计添加量'

/** 设计添加量的单位：折算料位（颗粒/折算物料）按克/支，其余（粉料/胶粉）按百分数 */
export function designUnitOf(kind) {
  return groupOfMaterialType(kind) === SLOT_GROUPS.CONVERTED ? 'g/支' : '%'
}

/** 数值文本 → 2 位小数文本（导出/落格同一口径）；空、非数字给 ''（不猜 0） */
export function fixed2(text) {
  const raw = stripUnit(text)
  if (raw === '') return ''
  const n = Number(raw)
  return Number.isFinite(n) ? n.toFixed(2) : ''
}

/**
 * 一行「设计添加量」该落成什么文本。
 *
 * 口径：数字取 2 位小数，单位按**物料种类**判定（% / g/支）。
 * 已经是带单位文本的行也走同一口径（幂等：`8` → `8.00%`，`8.00%` → `8.00%`，`10 g/支` → `10.00 g/支`）；
 * 解析不出数字（空行、脏值）给 '' —— 不编造。
 *
 * @param {Record<string, any>|null} row 配方表行
 * @returns {string} 例如 `50.00%` / `3.00 g/支` / ''
 */
export function designAmountText(row) {
  const n = fixed2(row?.[DESIGN_KEY])
  if (n === '') return ''
  const unit = designUnitOf(row?.['物料种类'])
  return unit === '%' ? `${n}%` : `${n} g/支`
}

/**
 * 这行算不算「有物料」—— 物料编号或物料名称任一非空。
 *
 * ⚠ 与 recipeRows.js 的 hasMaterial 是**同一个判据**，但这里**故意不吃「物料种类」**：
 *   2026-11-11 用户指着空白行说「没有数据的行就自动删除」，那些行正是只有「物料种类」
 *   （炭粉/胶粉/功能料-颗粒）而编号名称全空 —— 种类是**料位**不是**物料**，只有种类认不出是哪颗料。
 *   判据收紧后：种类单独填的行算空行（导出不导、写回不落库）。
 *
 * @param {Record<string, any>|null} row
 * @returns {boolean}
 */
export function rowHasMaterial(row) {
  return String(row?.['物料编号'] ?? '').trim() !== '' || String(row?.['物料名称'] ?? '').trim() !== ''
}

/** 只留「有物料」的行（导出/写回共用；保序，不改原数组） */
export function materialRowsOf(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => rowHasMaterial(r))
}

/**
 * 「设计添加量」合计 —— 只加 `%` 行（用户口径：这个数一定是 100%）。
 *
 * 位数跟明细走（复用 sumKeepScale 的口径：明细 2 位 ⇒ 合计 2 位），末尾补 `%`。
 * 没有任何 `%` 行时给 ''（不写 0 —— 空表不该出现一个 0.00%）。
 *
 * @param {Array<Record<string, any>>|null} rows 配方表行
 * @returns {string} `100.00%` / ''
 */
export function designTotalText(rows) {
  const pcts = []
  for (const r of (Array.isArray(rows) ? rows : [])) {
    if (!r || !rowHasMaterial(r)) continue
    // 单位以**物料种类**为准（比"文本里有没有 %"可靠：人手可能漏写单位）
    if (designUnitOf(r['物料种类']) !== '%') continue
    const n = Number(stripUnit(r[DESIGN_KEY]))
    if (Number.isFinite(n) && String(r[DESIGN_KEY] ?? '').trim() !== '') pcts.push(n)
  }
  if (!pcts.length) return ''
  // 最多 2 位（设计添加量落格就是 2 位）；先按明细位数收敛，再统一成 2 位显示
  const scale = Math.min(2, Math.max(...pcts.map((n) => (String(n).split('.')[1] || '').length)))
  const sum = pcts.reduce((a, b) => a + b, 0)
  return `${sum.toFixed(Math.max(scale, 2))}%`
}

/* ── 导出件：配方表 → 二维数组 ───────────────────────────────────────────────── */

/** 列键 → 导出时的取值口径（只列**需要规整**的列，其余原样） */
const COL_FORMATTERS = {
  序号: 'seq',
  实际添加比例: 'percent',
  添加比例: 'percent',
  单支物料含量: 'amount',
  单支含量g: 'amount',
  [DESIGN_KEY]: 'design',
}

/**
 * 一格的值（导出件口径）。
 * @param {Record<string, any>} row 行
 * @param {string} key 列键
 * @param {number} seq 该行在导出件里的序号（1 起；序号列用）
 */
export function cellTextOf(row, key, seq) {
  const kind = COL_FORMATTERS[key]
  if (kind === 'seq') return String(seq)
  if (kind === 'design') return designAmountText(row)
  if (kind === 'percent' || kind === 'amount') {
    const n = fixed2(row?.[key])
    return kind === 'percent' ? (n === '' ? '' : `${n}%`) : n
  }
  return String(row?.[key] ?? '')
}

/**
 * 配方表导出件的二维数组：`表头 + 有物料的行 + 合计行`。
 *
 * 口径（用户 2026-11-11）：
 *   · **只导有数据的物料行**（`rowHasMaterial`）—— 空白行/只有物料种类的行不导；
 *   · 所有数值**保留 2 位小数**；比例列补 `%`、设计添加量按物料种类补 `%` / `g/支`；
 *   · 末行合计：`序号` 格写「合计」，比例列与设计添加量给合计（设计添加量**只加 % 行**），
 *     单支含量列求和；其余列留空。
 *
 * @param {{cols: Array<{key: string, label?: string}>, rows: Array<Record<string, any>>, totalLabel?: string}} p
 * @returns {string[][]} 可直接 aoa_to_sheet 的二维数组
 */
export function buildRecipeAoa({ cols, rows, totalLabel = '合计' }) {
  const list = (Array.isArray(cols) ? cols : []).filter((c) => c && c.key && !c.hiddenCol)
  const body = materialRowsOf(rows)
  const header = list.map((c) => String(c.label ?? c.key).replace(/\s+/g, ''))
  const out = [header]
  body.forEach((r, i) => out.push(list.map((c) => cellTextOf(r, c.key, i + 1))))

  // 合计行：只对"能加"的列给值
  const total = list.map((c) => {
    if (c.key === '序号') return totalLabel
    if (c.key === DESIGN_KEY) return designTotalText(body)
    if (COL_FORMATTERS[c.key] === 'percent') return sumTextOf(body, c.key, '%')
    if (COL_FORMATTERS[c.key] === 'amount') return sumTextOf(body, c.key, '')
    return ''
  })
  if (body.length) out.push(total)
  return out
}

/** 某列求和（只加能解析成数字的格），按 2 位小数给文本；没有可加项给 '' */
function sumTextOf(rows, key, unit) {
  const nums = []
  for (const r of rows) {
    const n = Number(stripUnit(r?.[key]))
    if (Number.isFinite(n) && String(r?.[key] ?? '').trim() !== '') nums.push(n)
  }
  if (!nums.length) return ''
  const sum = nums.reduce((a, b) => a + b, 0)
  return `${sum.toFixed(2)}${unit}`
}
