/**
 * extCols.js — 数据记录表「自定义列」并入纸面列定义（纯函数，可单测）
 *
 * 【用户口径 2026-11-11】
 *   「数据记录表的所有单据的测试数据字段要能新增列功能，自定义列数，最多插入 8 个列，
 *    列还可以设计分叉，可以参考加标水配置记录表的列分叉设计」
 *   追问确认：**可以自己新建一个分组**；范围 = **8 张数据记录表**。
 *
 * 【为什么要这一层】
 *   8 张数据记录表的纸面列是**静态配置**（recordSheetConfigs 的 dataTables[].cols），
 *   而自定义字段是运行时往 yj_field 插的行（绑定备用列）。两者不合并，
 *   「加了字段」在列表/导出里有、**纸面上看不到** —— 用户报的就是这个缺口。
 *   本模块负责把「静态列 + 动态字段」拼成一份最终列定义，并把分组（分叉）算出来。
 *
 * 【分叉怎么来的】8 张表的表头分叉不是逐列 `group`，而是 `subHeads: [{label, span}]`
 *   （见 RD_ALKALINE 的「浸泡24H口感测试(…) span:9 / 离子分析 span:4」）。
 *   所以自定义列进来后要同步扩 subHeads：
 *     · 有 colGroup ⇒ 用它的分组名（同名相邻自动合并成一格）；
 *     · 没 colGroup ⇒ 自己单占一格（label = 列名）；
 *     · 原表**本来没有** subHeads 且自定义列带分组 ⇒ 补一格**覆盖全部原有列**的占位
 *       （label 留空），否则表头行会短一截、格子对不齐。
 *
 * 形态约定：输入输出都用「瘦对象」，不引用 Vue / DOM，便于 node --test 直接跑。
 */

/** 自定义列默认列宽（px）：与 FieldManagerDialog 的 width 默认值一致 */
export const EXT_COL_DEFAULT_W = 120

/**
 * 把动态明细字段并进纸面列定义。
 *
 * @param {object} p
 * @param {Array}  p.cols         静态列 [{key,label,w,...}]
 * @param {Array}  p.subHeads     静态分叉表头 [{label,span}]
 * @param {Array}  p.detailFields 元数据下发的明细字段（fieldSpec：dataName/displayName/width/hidden/place/colGroup）
 * @returns {{cols: Array, subHeads: Array, addedCount: number, addedLabels: string[]}}
 */
export function mergeExtCols({ cols = [], subHeads = [], detailFields = [] } = {}) {
  const base = (cols || []).map((c) => ({ ...c }))
  const baseKeys = new Set(base.map((c) => String(c.key ?? c.label ?? '').trim()))
  const added = []
  for (const f of detailFields || []) {
    if (!f || typeof f !== 'object') continue
    const key = String(f.dataName ?? f.label ?? '').trim()
    if (!key) continue
    if (baseKeys.has(key)) continue          // 已经在静态列里 ⇒ 不是自定义列
    if (f.hidden === true) continue           // 隐藏字段不上纸
    if (f.place && !String(f.place).includes('detail')) continue  // 只要明细侧字段
    const w = Number(f.width)
    added.push({
      key,
      label: key,                             // 数据键=label（ADR-0001），别名由 effColLabel 兜
      w: Number.isFinite(w) && w > 0 ? w : EXT_COL_DEFAULT_W,
      _group: String(f.colGroup || '').trim(),
    })
  }
  if (!added.length) {
    return { cols: base, subHeads: (subHeads || []).map((s) => ({ ...s })), addedCount: 0, addedLabels: [] }
  }

  const outCols = base.concat(added.map(({ _group, ...c }) => c))

  // ── 分叉表头 ──────────────────────────────────────────────
  const outSub = (subHeads || []).map((s) => ({ ...s, span: Number(s.span) || 1 }))
  const anyGroup = added.some((c) => c._group)
  if (outSub.length === 0) {
    if (!anyGroup) {
      // 原表没有分叉、自定义列也都不分组 ⇒ 保持单行表头（不硬造一条只有列名的分叉行）
      return { cols: outCols, subHeads: [], addedCount: added.length, addedLabels: added.map((c) => c.key) }
    }
    // 要出分叉行，且原有列必须被覆盖，否则表头短一截、格子对不齐
    outSub.push({ label: '', span: base.length })
  }
  // 未声明分组的自定义列 ⇒ 分组格留空(相邻空白会合并成一格)。
  // ⚠ 不能填列名:那样分叉格与下面的列名重复，看起来像两行同名列(实测截图确认很别扭)。
  for (const c of added) outSub.push({ label: c._group || '', span: 1 })

  // 相邻同名合并（自定义列选同一个分组名时自然合成一格）
  const merged = []
  for (const s of outSub) {
    const last = merged[merged.length - 1]
    if (last && last.label === s.label) last.span += s.span
    else merged.push({ ...s })
  }
  return { cols: outCols, subHeads: merged, addedCount: added.length, addedLabels: added.map((c) => c.key) }
}
