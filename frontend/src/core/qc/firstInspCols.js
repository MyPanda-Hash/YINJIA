/**
 * firstInspCols.js — 首件检验单(QC_FIRST_INSP)「测试项目 = 一列」的**列模型单一真源**。
 *
 * 用户口径(2026-10-15 第二轮):
 *   「修改当前页面为如图所示,测试项目需要可新增,也就是新增列即可」。
 * 即纸张是图片那种「样品序号 × 测试项目」矩阵:每个测试项目一列,列上是它的名称/单位与标准行,
 * 列下是 1#..8# 八个样品的实测格。**新增一个测试项目 = 新增一列**,不用改表结构:
 * 明细本来就是长表(一行 = 一个「行类型 × 样品 × 检验列」),加列只是多写「1 行标准 + 8 行样品」。
 *
 * 【为什么独立成纯模块】列的去重、序号分配、单位推导、列的删除与重命名都必须在
 * **纯函数**上可测(组件里做就只能靠点界面验证)。列键(key)是数据键,列名(label)只是显示,
 * 两者分开:改列名不该让历史数据丢列,故 rename 只改 label、key 一律不动。
 */

/** 纸张固定 8 个样品行(图片:1#..8#) */
export const SAMPLE_COUNT = 8

/** 图片上的四个分组(新增列落到最后那组;组的先后 = 纸张上的先后) */
export const GROUP_ORDER = ['表观及脱粉', '尺寸及重量', '强度', '浊度及压降']

/** 明细行类型:标准行 / 样品行 */
export const ROW_STANDARD = '标准'
export const ROW_SAMPLE = '样品'

export const SHEET_SECTION = '首件检验'

/**
 * 图片《炭棒成型车间首件检验记录表》上的 **10 个测试项目**(分组 · 列名 · 数据键 · 单位)。
 * 用户口径(2026-10-15 第三轮):「当前测试项目把这些先填充进去就可以了,不需要空着什么都没有」
 * ⇒ 新建的首件检验单要**一打开就带着这 10 列**,不能是一张空表。
 *
 * ⚠ 与后端 `FirstInspItems.DEFS` **必须一致**(同一张图纸;后端负责按《成型工艺清单》把"标准"填上,
 *   前端这份只兜"列本身要先有" —— 新建草稿还没选产品、也就还没有工艺清单可查那一刻)。
 *   两处顺序/键/分组/单位任一改动都要同步,否则会出现"纸面列序与落库列序不一致"。
 * 标准(row.standard)由后端给;前端兜底时留空(表观/脱粉/浊度三项图纸上就是「/」)。
 */
export const DEFAULT_TEST_ITEMS = [
  { key: 'appearance', label: '炭棒表观状态', group: '表观及脱粉', unit: '', standard: '/' },
  { key: 'depowder', label: '炭棒脱粉情况', group: '表观及脱粉', unit: '', standard: '/' },
  { key: 'outer', label: '炭棒外径', group: '尺寸及重量', unit: 'mm', standard: '' },
  { key: 'inner', label: '炭棒内径', group: '尺寸及重量', unit: 'mm', standard: '' },
  { key: 'length', label: '炭棒长度', group: '尺寸及重量', unit: 'mm', standard: '' },
  { key: 'weight', label: '炭棒重量', group: '尺寸及重量', unit: 'g', standard: '' },
  { key: 'drop', label: '跌落', group: '强度', unit: '', standard: '' },
  { key: 'compress', label: '挤压强度', group: '强度', unit: 'kgf', standard: '' },
  { key: 'turbidity', label: '浊度NTU', group: '浊度及压降', unit: 'NTU', standard: '/' },
  { key: 'pressure', label: '压降kPa', group: '浊度及压降', unit: 'kPa', standard: '' },
]

/**
 * 明细里一列都没有时,把图片上的 10 个测试项目先铺进去(幂等:已有列就原样返回 0)。
 * 只在**可编辑的新草稿**上调用 —— 历史单据(哪怕明细为空)不该被前端擅自灌数据。
 * @param {object} head 单据表头(含 detail.items)
 * @returns {number} 本次铺了几列(0 = 本来就有列,没动)
 */
export function seedDefaultColumns(head) {
  const items = ensureItems(head)
  if (items.length) return 0
  for (const d of DEFAULT_TEST_ITEMS) {
    const maxNo = items.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0)
    items.push(...rowsForColumn({ key: d.key, label: d.label, group: d.group, standard: d.standard }, maxNo))
  }
  return DEFAULT_TEST_ITEMS.length
}

/**
 * 从明细行折出列清单(按首次出现的先后;同一 key 只认第一行 —— 它是该列的"定义行")。
 * @param {Array<object>} items 明细行
 * @returns {Array<{key:string,label:string,group:string,standard:string,unit:string}>}
 */
export function columnsOf(items) {
  const map = new Map()
  for (const r of items || []) {
    if (!r) continue
    const key = String(r['检验列'] || r['检验项目'] || '').trim()
    if (!key || map.has(key)) continue
    const label = String(r['检验项目'] || key)
    const declared = String(DEFAULT_TEST_ITEMS.find((d) => d.key === key)?.unit || '')
    map.set(key, {
      key,
      label,
      group: String(r['项目分组'] || GROUP_ORDER[GROUP_ORDER.length - 1]),
      standard: String(r['标准'] || r['检验要求'] || ''),
      // 单位优先取**图纸声明**(DEFAULT_TEST_ITEMS 里写死的),再回落"从列名猜"。
      // ⚠ 只靠猜不行:「炭棒外径」列名里没有 mm(图片上那个 mm 是列头单位的小字),
      //   兜底铺列时就会把单位丢掉(单测抓到过)。
      unit: declared || unitOfLabel(label),
    })
  }
  return [...map.values()]
}

/**
 * 按分组把列排好(组的先后按 {@link GROUP_ORDER};组内保持录入先后)。
 * 未知分组(用户自己填的)排在最后,不丢列。
 * @param {Array<object>} cols {@link columnsOf} 的结果
 */
export function groupsOf(cols) {
  const known = GROUP_ORDER.filter((g) => cols.some((c) => c.group === g))
  const extra = [...new Set(cols.filter((c) => !GROUP_ORDER.includes(c.group)).map((c) => c.group))]
  return [...known, ...extra]
}

/** 列头单位:能一眼从列名看出来的就写出来(图片上「炭棒外径mm」「浊度NTU」「压降kPa」就是这个意思) */
export function unitOfLabel(label) {
  const s = String(label || '')
  if (/kPa/i.test(s)) return 'kPa'
  if (/NTU/i.test(s)) return 'NTU'
  if (/kgf/i.test(s)) return 'kgf'
  if (/mm/.test(s)) return 'mm'
  if (/cm/.test(s)) return 'cm'
  if (/(^|[^a-z])g($|[^a-z])/i.test(s) || /重量|克重/.test(s)) return 'g'
  return ''
}

/**
 * 新列的数据键:测试项目名(用户填什么就是什么,便于列表页看懂)。
 * 同名时补 -2/-3…(不改已存在的列)。
 * @param {Array<object>} cols 现有列
 * @param {string} label 新列名
 */
export function nextColumnKey(cols, label) {
  const base = String(label || '').trim() || '新测试项目'
  const used = new Set((cols || []).map((c) => String(c.key)))
  if (!used.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const k = `${base}-${i}`
    if (!used.has(k)) return k
  }
  return `${base}-${Date.now()}`
}

/** 新列名(空名给个可改的占位) */
export function nextColumnLabel(cols) {
  const used = new Set((cols || []).map((c) => String(c.label)))
  for (let i = 1; i < 1000; i++) {
    const n = `测试项目${i}`
    if (!used.has(n)) return n
  }
  return `测试项目${Date.now()}`
}

/**
 * 造一列的明细行:1 行「标准」+ 8 行「样品」。
 * 与后端 FirstInspItems 落库的行键完全一致(表区/行类型/样品序号/检验列/检验项目/项目分组/标准/实测数值/结果判断/行号/备注)。
 * @param {{key:string,label:string,group:string,standard?:string}} col
 * @param {number} [lastNo] 当前明细里**已有**的最大行号(新列从它 +1 开始;缺省 0 ⇒ 从 1 开始)
 */
export function rowsForColumn(col, startNo = 0) {
  const rows = [rowOf(ROW_STANDARD, '标准', 0, col)]
  for (let i = 1; i <= SAMPLE_COUNT; i++) rows.push(rowOf(ROW_SAMPLE, `${i}#`, i, col))
  // 行号 = 起始号 + 本行序号:第一行是 startNo+1 —— 传进来的 startNo 是"当前**最后**一个行号",
  // 若直接当起点会让新列的标准行与上一列的末行撞号(单测「加第二列行号不撞」抓到过)。
  rows.forEach((r, i) => { r['行号'] = startNo + i + 1 })
  return rows
}

function rowOf(type, sample, sampleNo, col) {
  return {
    表区: SHEET_SECTION,
    行类型: type,
    样品序号: sample,
    检验列: col.key,
    检验项目: col.label,
    项目分组: col.group,
    标准: type === ROW_STANDARD ? String(col.standard || '') : '',
    实测数值: '',
    结果判断: '',
    行号: sampleNo,
    备注: '',
  }
}

/**
 * 在明细末尾追加一列(改动就地生效,返回新列的 key)。
 * @param {object} head 单据表头(含 detail.items)
 * @param {{label:string,group?:string,standard?:string}} spec
 * @returns {{key:string,label:string,group:string,standard:string,rows:number}}
 */
export function addColumn(head, spec = {}) {
  const items = ensureItems(head)
  const cols = columnsOf(items)
  const label = String(spec.label || '').trim() || nextColumnLabel(cols)
  const col = {
    key: nextColumnKey(cols, label),
    label,
    group: GROUP_ORDER.includes(spec.group) ? spec.group : GROUP_ORDER[GROUP_ORDER.length - 1],
    standard: String(spec.standard || ''),
  }
  const maxNo = items.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0)
  const rows = rowsForColumn(col, maxNo)
  items.push(...rows)
  return { ...col, rows: rows.length }
}

/**
 * 删除一整列(连同它的标准行与 8 个样品行),返回删掉的行数。
 * 按「检验列」键删 —— 列名改过也不影响(改名不动 key)。
 * @param {object} head
 * @param {string} key
 */
export function removeColumn(head, key) {
  const items = head?.detail?.items
  if (!Array.isArray(items)) return 0
  const k = String(key || '')
  const before = items.length
  for (let i = items.length - 1; i >= 0; i--) {
    if (String(items[i]?.['检验列'] || items[i]?.['检验项目'] || '') === k) items.splice(i, 1)
  }
  return before - items.length
}

/**
 * 改列(列名/分组/标准):**明细里该列的所有行一起改**,标准行只改「标准」。
 * key 一律不动(改 key 等于换列,历史数据会丢)。
 * @param {object} head
 * @param {string} key
 * @param {{label?:string,group?:string,standard?:string}} patch
 */
export function updateColumn(head, key, patch = {}) {
  const items = head?.detail?.items
  if (!Array.isArray(items)) return 0
  const k = String(key || '')
  let n = 0
  for (const r of items) {
    if (!r || String(r['检验列'] || r['检验项目'] || '') !== k) continue
    if (patch.label !== undefined) r['检验项目'] = String(patch.label)
    if (patch.group !== undefined) r['项目分组'] = String(patch.group)
    if (patch.standard !== undefined && String(r['行类型']) === ROW_STANDARD) r['标准'] = String(patch.standard)
    n++
  }
  return n
}

/** 这一列填过东西没有(删列要不要弹确认看它) */
export function columnHasContent(items, key) {
  const k = String(key || '')
  return (items || []).some((r) => r
    && String(r['检验列'] || r['检验项目'] || '') === k
    && (String(r['实测数值'] ?? '').trim() || String(r['结果判断'] ?? '').trim()))
}

/** 取(必要时创建)明细数组 */
export function ensureItems(head) {
  const d = head.detail || (head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}
