/**
 * scheduleBatch.js — 生产工单「批量排产」纯逻辑(2026-10-30 用户口径)
 *
 * 用户口径:「排产数量按各行根据各行的算,这样各个工单排产的产线都是相同的 ——
 * 本身当前作为排产的就是实现将多个工单排入相同产线的操作」。
 * 所以本模块只做三件**纯**事(可被 node --test 钉住),请求/渲染留给组件:
 *   ① 按「工序链」(工序名称 + 顺序)把勾选的工单行分组 —— 不同工序的批次不能共用一套线;
 *   ② 选出本批那一组、其余行带原因排除(界面照此点名:「这个工单号不是同一个工序」);
 *   ③ 每行计划量 = 本行排产数量 × 本行该道换算率(各道分开算,不累乘),以及本批每道合计。
 *
 * 数据键中文,与后端 `/px/scheduleBoard/routeSteps` 返回一致:
 *   row = { 加工单号, 行id, 工单行号, 需求数量, 排产数量,
 *           工序步骤: [{ 工序, 生产车间, 限定车间, 换算率, 工序序, 计划完工日期 }] }
 *
 * ⚠ 换算率是**工艺路线明细**上的字段(bs_route.换算率),不是工单字段:同一路线编码各行率必然相同,
 *   因此「工序链相同但率不同」= 两条同链不同率的路线 —— 本模块按行各自取率,互不影响
 *   (与后端 preplanManual「计划数量 = 本次排产数量 × 该工序自己的换算率」同口径)。
 */

const norm = (v) => String(v ?? '').trim()

/** 数字兜底(空/非数 ⇒ 0) */
export function num(v) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** 换算率(空/<=0 视为 1,与后端 `if (rate <= 0) rate = 1` 同口径) */
function rateOf(step) {
  const r = num(step && step['换算率'])
  return r > 0 ? r : 1
}

function round(v) {
  return Math.round(num(v) * 10000) / 10000
}

/** 工序链:按顺序拼工序名称(trim 后),`>` 分隔;无工序 ⇒ '' */
export function chainOf(steps) {
  return (Array.isArray(steps) ? steps : [])
    .map((s) => norm(s && s['工序']))
    .filter(Boolean)
    .join('>')
}

/** 某行的换算率链(与工序步骤同序) */
export function rateChainOf(row) {
  const steps = (row && row['工序步骤']) || []
  return steps.map((s) => round(rateOf(s)))
}

/**
 * 按工序链分组。
 *
 * 组按**行数降序**排(同数保持出现顺序 ⇒ 默认取到「勾选里第一行所在的那组」),
 * 界面默认排行数最多的那组,并允许切换。无工序步骤的行(未绑路线/路线无明细)单列,
 * 由界面点名排除 —— 不参与任何分组。
 *
 * @param {Array<object>} rows
 * @returns {{groups: Array<{chain: string, rows: Array<object>, count: number}>,
 *            singles: Array<{row: object, reason: 'noroute'}>}}
 */
export function groupByChain(rows) {
  const map = new Map()
  const singles = []
  for (const row of rows || []) {
    if (row == null || typeof row !== 'object') continue
    const chain = chainOf(row['工序步骤'])
    if (!chain) {
      singles.push({ row, reason: 'noroute' })
      continue
    }
    if (!map.has(chain)) map.set(chain, { chain, rows: [] })
    map.get(chain).rows.push(row)
  }
  const groups = [...map.values()].map((g) => ({ chain: g.chain, rows: g.rows, count: g.rows.length }))
  groups.sort((a, b) => b.count - a.count)
  return { groups, singles }
}

/**
 * 选出本批(默认行数最多的组),其余行带原因排除。
 *
 * @param {Array<object>} rows 勾选的全部工单行
 * @param {string} [chosenChain] 指定要排的那条工序链;缺省/不存在 ⇒ 取最大组
 * @returns {{included: Array<object>,
 *            excluded: Array<{row: object, reason: 'chain'|'noroute', chain: string}>,
 *            groups: Array<object>, chosen: object|null}}
 */
export function splitBatch(rows, chosenChain) {
  const { groups, singles } = groupByChain(rows)
  const chosen = groups.find((g) => g.chain === chosenChain) || groups[0] || null
  const included = chosen ? chosen.rows.slice() : []
  const excluded = []
  for (const g of groups) {
    if (chosen && g.chain === chosen.chain) continue
    for (const row of g.rows) excluded.push({ row, reason: 'chain', chain: g.chain })
  }
  for (const s of singles) excluded.push({ row: s.row, reason: 'noroute', chain: '' })
  return { included, excluded, groups, chosen }
}

/** 行标识(界面/提示统一用「工单号#行号」,2026-10-15 用户口径) */
export function rowKeyOf(row) {
  const no = norm(row && row['加工单号'])
  const xc = row && row['工单行号']
  return xc === null || xc === undefined || xc === '' ? no : `${no}#${xc}`
}

/** 该行的默认排产数量 = 当前排产数量(>0)否则需求数量(与单行弹窗同口径) */
export function defaultQty(row) {
  const cur = num(row && row['排产数量'])
  return cur > 0 ? cur : num(row && row['需求数量'])
}

/** 本行第 i 道工序的计划量 = 本行排产数量 × 该道换算率(各道分开算,不累乘) */
export function planQtyOf(row, i) {
  const steps = (row && row['工序步骤']) || []
  const step = Array.isArray(steps) ? steps[i] : null
  return round(num(row && row['排产数量']) * rateOf(step))
}

/** 本行每道工序的计划量数组 */
export function planChainOf(row) {
  const steps = (row && row['工序步骤']) || []
  return steps.map((_, i) => planQtyOf(row, i))
}

/** 本批第 i 道的计划量合计(**逐行按各自换算率算**,不是「合计数量 × 某个率」) */
export function stepTotal(rows, i) {
  return round((rows || []).reduce((acc, row) => acc + planQtyOf(row, i), 0))
}

/**
 * 本批第 i 道换算率是否各行一致:一致 ⇒ null;不一致 ⇒ 去重后的率数组(升序)。
 * 界面据此把「有差异」的工序标出来(用户口径:率不同也可以一起排,但要让人看见)。
 */
export function ratesOf(rows, i) {
  const set = new Set()
  for (const row of rows || []) {
    const steps = (row && row['工序步骤']) || []
    const step = Array.isArray(steps) ? steps[i] : null
    set.add(round(rateOf(step)))
  }
  if (set.size <= 1) return null
  return [...set].sort((a, b) => a - b)
}

/**
 * 提交前的逐行数量校验(后端 `preplanManual` 有同一套守卫,这里只做可读的前置提示):
 *   reason='qty'  数量必须 > 0
 *   reason='over' 超过该行需求数量
 *
 * @returns {Array<{row: object, reason: 'qty'|'over'}>}
 */
export function validateQty(rows) {
  const bad = []
  for (const row of rows || []) {
    const qty = num(row && row['排产数量'])
    const demand = num(row && row['需求数量'])
    if (!(qty > 0)) bad.push({ row, reason: 'qty' })
    else if (demand > 0 && qty > demand + 0.0001) bad.push({ row, reason: 'over' })
  }
  return bad
}

/**
 * 某一行的换算率链是否与「首行」不同(界面给差异行打标用)。
 * 同链意味着道数相同;率链不同 ⇒ 这条工单用的是另一条同链不同率的路线。
 */
export function rateDiffFromFirst(rows, row) {
  const first = (rows || [])[0]
  if (!first || !row) return false
  const a = rateChainOf(first)
  const b = rateChainOf(row)
  if (a.length !== b.length) return true
  return a.some((v, i) => v !== b[i])
}
