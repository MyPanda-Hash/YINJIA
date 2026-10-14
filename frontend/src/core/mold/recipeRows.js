/**
 * 配方计算弹窗的「物料行」编辑接线(纯函数,不碰 Vue;单测 recipeRows.test.js)。
 *
 * 用户口径变更(2026-10-15,原话):
 *   「成型工艺清单的配方表的数据是在**配方计算器里面填写数据然后填入单据**的,
 *     而不是带入的规格书的」;追问确认选择 = **弹窗里录物料行**。
 * 于是配方表的真源从"页 2 手填 / 规格书带出"变成"配方计算弹窗里这份行":
 *   · 弹窗打开时把页 2 已有的行**带进来接着编**(页 2 空就从零加)—— 见 editRowsFrom;
 *   · 算完点「填入单据」时把这份行**整表写回**页 2 配方表 —— 见 buildRecipeRows;
 *   · 两道输入闸(NO_RECIPE_ROWS 阻断 / 未填设计添加量告警)的判据跟着**这份行**走
 *     (它们本来就只看传进去的数组,见 recipeSheet.js)。
 *
 * 键一律用单据页 2 配方表的**原始中文数据键**:一行数据两种视图,不另立一套键 ——
 * 另立一套就要在两边翻译,漏一个键就是静默丢值。
 */
import { MATERIAL_KINDS } from './materialKinds.js'

/** 弹窗里可录入的四个输入格(其余列:序号自动编,实际添加比例/单支物料含量是算出来的) */
export const RECIPE_INPUT_KEYS = ['物料种类', '物料编号', '物料名称', '设计添加量']

/** 一行空白编辑行(「加一行」用) */
export function blankRecipeRow() {
  return Object.fromEntries(RECIPE_INPUT_KEYS.map((k) => [k, '']))
}

/**
 * 页 2 配方表的行 → 弹窗编辑行(**拷贝**)。
 *
 * 为什么必须拷贝:弹窗里改的是"待写入的草稿",点「填入单据」才写回单据;
 * 直接引用单据行的话,用户点「取消」也改掉了单据(而且不触发 dirty)。
 * 行上的其它键(表区/序号/上一轮算出的两列)一并带过来 —— 写回时原样保留,
 * 「旧值 → 新值」的回填预览也才有旧值可显示。
 *
 * @param {Array<Record<string, any>>|null} rows 页 2 配方表的行(可为空 = 从零开始)
 * @returns {Array<Record<string, any>>} 编辑行(保序、键逐字相同)
 */
export function editRowsFrom(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({ ...blankRecipeRow(), ...(r || {}) }))
}

/** 这行算不算"有物料":物料种类/编号/名称任一非空(与 recipeSheet.materialRowCount 同一口径) */
function hasMaterial(row) {
  return RECIPE_INPUT_KEYS.slice(0, 3).some((k) => String(row?.[k] ?? '').trim() !== '')
}

/**
 * 弹窗里这份编辑行 + 引擎算出的两列 → **整表写回**页 2 配方表的行。
 *
 * 口径:
 *   · **整行空白**的行不写回(明细表天生会留空行;用户删剩的空行不该落库);
 *   · `序号` 按写回后的次序重排 1..N —— 与面板「加一行」的 autoSeqBar 口径一致
 *     (弹窗里能删行,沿用旧号会留断号);
 *   · 引擎算出的 `实际添加比例` / `单支物料含量` 按**行号**并回对应行
 *     (行号口径 = slotsFromRows 给 slot 的 rowIndex,就是这份编辑行的下标);
 *   · **没参与计算的行**(如超出料位容量被忽略)保留行上原来的两列值:行是用户录的数据,
 *     不是这次算出来的,宁可留上一次的值,也不写空/undefined;
 *   · 行上其它键(表区…)原样保留 —— 少了 `表区` 这行就不属于配方表了。
 *
 * @param {Array<Record<string, any>>|null} editRows 弹窗里的编辑行
 * @param {Array<{rowIndex: number, [k: string]: any}>|null} patchRows buildPatch(...).rows
 * @returns {Array<Record<string, any>>} 写回页 2 的行(可直接整表替换本表区)
 */
export function buildRecipeRows(editRows, patchRows) {
  const byIndex = new Map()
  for (const p of (Array.isArray(patchRows) ? patchRows : [])) {
    if (p && Number.isInteger(p.rowIndex)) byIndex.set(p.rowIndex, p)
  }
  const out = []
  ;(Array.isArray(editRows) ? editRows : []).forEach((r, i) => {
    const src = r || {}
    if (!hasMaterial(src)) return
    const row = { ...src, 序号: String(out.length + 1) }
    const hit = byIndex.get(i)
    if (hit) {
      row['实际添加比例'] = hit['实际添加比例']
      row['单支物料含量'] = hit['单支物料含量']
    }
    out.push(row)
  })
  return out
}

/**
 * 商品档案行 → 这行**还能补上**的格(填「物料编号」带出名称/种类;只补空格)。
 *
 * 数据源 = 既有档案查询(商品档案 INV,列 `存货编码`/`存货名称`/`所属类别`),
 * 不新开后端接口。两条硬规矩:
 *   · 已有值的格一律不动(人手填的优先);
 *   · `所属类别` 必须正好是引擎认的那四个词(MATERIAL_KINDS)才补 —— 档案里别的词
 *     填进「物料种类」会让 groupOfMaterialType 认不出来(静默按粉料算),不如不补。
 *
 * @param {Record<string, any>|null} row 弹窗里的编辑行
 * @param {Record<string, any>|null} inv 商品档案行(取不到传 null)
 * @returns {Record<string, string>} 要写进该行的格(取不到任何值给 {})
 */
export function invFillFor(row, inv) {
  const out = {}
  const name = String(inv?.['存货名称'] ?? '').trim()
  if (name && !String(row?.['物料名称'] ?? '').trim()) out['物料名称'] = name
  const kind = String(inv?.['所属类别'] ?? '').trim()
  if (kind && MATERIAL_KINDS.includes(kind) && !String(row?.['物料种类'] ?? '').trim()) out['物料种类'] = kind
  return out
}
