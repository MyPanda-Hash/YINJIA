/**
 * procInspCols.js — 制程检验单(QC_PROC_INSP)纸张横表的**列模型单一真源**。
 *
 * 用户口径(2026-10-17,逐轮拍板):
 *   ① 面板纸张表按纸质《制程检验记录表》图2 的横表形式实现:
 *      左侧 6 个单据要素(检验时间|客户名称|产品编码|型号（mm）|批号|抽检总量) 固定列
 *      → 中间按「表区」分组(外观|尺寸|出货重量,组名横跨本组各列)
 *      → 右侧「结果判断」固定列;
 *   ② **固定列**:外观组先铺「端盖两头」「管身两侧」两个标准项列,**不可删**;
 *   ③ **自定义列**:仿照研发「功能性滤效」的动态样品列 ——
 *      单据表头一个「列数」字段 + 表格外 −/＋ 控件,列数决定横表铺几列自定义列
 *      (**所有表区统一铺**,减列即清空该列数据,照功能性滤效的确认弹窗口径);
 *   ④ 没有数据的标准表区也照铺(空单也能看到纸张结构)。
 *
 * 【为什么集中在纯模块里】列模型一旦散在组件里就会出现"加列时某一处不跟着动、
 *   减列时某一处不清空"的老毛病(2026-09-30 功能性滤效「样品配方列数不同步」就是这类)。
 *   这里只放纯函数,由 procInspCols.test.js 钉死;组件只负责渲染与落库。
 */

/** 纸面标准表区(图2 的三个区块;顺序 = 纸面顺序)。
 *  `fixed` = 该区块的固定列(standard item,永远渲染、不可删)。 */
export const STD_SECTORS = [
  { key: '外观', title: '外观', fixed: ['端盖两头', '管身两侧'] },
  { key: '尺寸', title: '尺寸', fixed: [] },
  { key: '重量', title: '出货重量', fixed: [] },
]

/** 表区别名 → 标准表区键(历史计划/带入把同一纸面区块叫成别的名字时归到同一列组)。
 *  只影响**渲染分组**,不改存量行里的「表区」值;新建行才用标准键。 */
export const SECTOR_ALIAS = {
  重要尺寸: '尺寸',
  主要尺寸: '尺寸',
  关键尺寸: '尺寸',
  出货重量: '重量',
}

/** 自定义列数下限/上限(上限=功能性滤效同款:表格再宽也得能看) */
export const MIN_COLS = 1
export const MAX_COLS = 10

/** 表区名 → 标准表区键(不认识的原样返回;空值返回 '') */
export function canonicalSector(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return SECTOR_ALIAS[s] || s
}

/** 表区键 → 组标题(标准表区用纸面名字,例:键 重量 → 标题 出货重量) */
export function sectorTitle(key) {
  const std = STD_SECTORS.find((s) => s.key === key)
  return std ? std.title : key
}

/** 该表区的固定项名清单(非标准表区 = 空) */
export function fixedItemsOfSector(key) {
  const std = STD_SECTORS.find((s) => s.key === key)
  return std ? std.fixed.slice() : []
}

/**
 * 检验项目名 → 去掉「表区-」前缀后的裸名。
 * 例:'外观-端盖两头'(按计划带入的写法) → '端盖两头';'端盖两头' 原样。
 * 前缀判定用**本行自己的表区**与**标准表区名**两种写法,避免把 '尺寸-外径' 这类名字误剥。
 */
export function bareItemName(itemName, sectorRaw) {
  let s = String(itemName ?? '').trim()
  if (!s) return ''
  for (const p of [String(sectorRaw ?? '').trim(), canonicalSector(sectorRaw)]) {
    if (p && s.startsWith(p + '-')) { s = s.slice(p.length + 1).trim(); break }
  }
  return s
}

/** 本行是不是该表区的固定列(按裸名精确比) */
export function isFixedItem(sectorKey, itemName, sectorRaw) {
  const bare = bareItemName(itemName, sectorRaw ?? sectorKey)
  return !!bare && fixedItemsOfSector(sectorKey).includes(bare)
}

/** 列数取值:非数字/越界一律夹到 [MIN_COLS, MAX_COLS];空值 = 未设过 → MIN_COLS */
export function clampCols(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v) || v <= 0) return MIN_COLS
  return Math.min(Math.max(v, MIN_COLS), MAX_COLS)
}

/** 按表区分组(保序:标准表区在前,其余按数据出现次序) */
function groupRows(items) {
  const order = []
  const byKey = new Map()
  for (const row of items || []) {
    if (!row) continue
    const key = canonicalSector(row['表区'])
    if (!key) continue                       // 未归类:不参与列组(组件另行处理)
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key) }
    byKey.get(key).push(row)
  }
  return { order, byKey }
}

/** 某表区的**自定义**(非固定项)行 */
export function customRowsOf(key, items) {
  const { byKey } = groupRows(items)
  return (byKey.get(key) || []).filter((r) => !isFixedItem(key, r['检验项目'], r['表区']))
}

/** 某表区的固定项行(每项取第一条;没有 = null) */
export function fixedRowOf(key, name, items) {
  const { byKey } = groupRows(items)
  return (byKey.get(key) || []).find((r) => isFixedItem(key, r['检验项目'], r['表区'])
    && bareItemName(r['检验项目'], r['表区']) === name) || null
}

/**
 * 本单**实际要铺**的自定义列数。
 *  = max(存库的「列数」, 各表区已有的自定义行数) —— 存量单/带入后的行数可能比列数多,
 *    此时按多的来:**绝不把已有数据藏起来**;用户点 − 才会真删那一列。
 */
export function effectiveCols(stored, items) {
  let n = clampCols(stored)
  const { byKey } = groupRows(items)
  for (const key of byKey.keys()) n = Math.max(n, customRowsOf(key, items).length)
  return Math.min(Math.max(n, MIN_COLS), MAX_COLS)
}

/**
 * 列模型:每个表区一组列。
 *  - std 表区恒在(没有数据也铺,空单也看得见纸张结构),其余表区只在有行时出现;
 *  - `fixed` = 固定列(standard item,不可删);
 *  - `custom` = 自定义列,**恰好 cols 列**:先放本表区已有的自定义行,不足的补空列(row=null)。
 * @param {Array} items 明细行
 * @param {number} cols 自定义列数(= effectiveCols 的结果)
 */
export function buildSectors(items, cols) {
  const n = clampCols(cols)
  const { order, byKey } = groupRows(items)
  const keys = [...STD_SECTORS.map((s) => s.key), ...order.filter((k) => !STD_SECTORS.some((s) => s.key === k))]
  const seen = new Set()
  const out = []
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    const rows = byKey.get(key) || []
    if (!rows.length && !STD_SECTORS.some((s) => s.key === key)) continue   // 非标准表区:无行不铺
    const fixed = fixedItemsOfSector(key).map((name) => ({ name, row: fixedRowOf(key, name, items) }))
    const mine = rows.filter((r) => !isFixedItem(key, r['检验项目'], r['表区']))
    const custom = []
    for (let i = 0; i < n; i++) custom.push({ index: i, row: mine[i] || null })
    out.push({ key, title: sectorTitle(key), fixed, custom })
  }
  return out
}

/**
 * 减列:删掉各表区第 keep+1 列起的自定义行(含数据),返回被删的行清单。
 * 固定列与其余表区一概不碰;keep < MIN_COLS 时按 MIN_COLS 处理。
 */
export function removedRowsForCols(items, keep) {
  const k = Math.max(clampCols(keep), MIN_COLS)
  const { byKey } = groupRows(items)
  const removed = []
  for (const key of byKey.keys()) {
    const mine = customRowsOf(key, items)
    for (let i = k; i < mine.length; i++) removed.push(mine[i])
  }
  return removed
}

/** 行数组里剔除这些行(就地,返回值=真删掉的条数) */
export function dropRows(items, rows) {
  if (!Array.isArray(items) || !rows || !rows.length) return 0
  let n = 0
  for (const row of rows) {
    const i = items.indexOf(row)
    if (i >= 0) { items.splice(i, 1); n++ }
  }
  return n
}
