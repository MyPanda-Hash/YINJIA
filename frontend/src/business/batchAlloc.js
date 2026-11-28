/**
 * batchAlloc.js — 「扫码出库」批次勾选与按序扣减的纯逻辑(2026-11-28)
 *
 * <h3>用户口径(原话)</h3>
 * 「扫码出库是需要连带出批次号。可勾选,按勾选的批次号再进行自动填入和排序,
 *  自动填入数量,按顺序扣批次号。并且把 PC0000 放在最上面」
 *
 * <h3>落成的规则</h3>
 * <ol>
 *   <li><b>PC0000 永远排第一批</b> —— 金蝶对「不分批商品」统一填默认批号 {@code PC0000},
 *       现场真正的货就压在这一批上;按批号日期排(FIFO)时它取不到日期,会被排到最后,
 *       现场要点到表格最下面才能勾到它。所以排序改成:**PC0000 最前 → 其余按批号日期先进先出**
 *       (顺序仍由 {@code scanPick.fifoSort} 给出,本模块只做稳定的"提到最前"分区)。</li>
 *   <li><b>勾选决定扣哪几批</b> —— 只有勾上的批次参与本次出库;取消勾选的行数量归零。</li>
 *   <li><b>自动填入数量 = 按顺序扣</b> —— 现场只填「本次数量」,由本模块按显示顺序
 *       (PC0000 → 日期在前的 → …)逐批填满,一批不够自动落到下一批;
 *       扫到的码里带了批号时,那一批排在最前(用户扫的就是这一批)。</li>
 *   <li><b>勾选不越过可用量</b> —— 每批最多扣到它的可用量;勾选总量不够本次数量时
 *       返回 {@code shortage},页面提示「还差 X,可再勾选批次」(不硬拦,库存以金蝶为准)。</li>
 * </ol>
 *
 * <p>为什么单独一个模块:四个调用点(生产领料明细页、其他领料、以及两页各自的测试)
 * 必须用**同一套**排序与扣减规则,否则"这边 PC0000 在最上面、那边在最后"这种错位
 * 现场根本发现不了。纯函数,不 import 任何东西(避免与 scanCode/scanPick 形成环)。
 */

/** 金蝶「不分批商品」的默认批号 —— 必须排在最上面 */
export const DEFAULT_LOT = 'PC0000'

/** 四位小数取整(与后端 decimal(18,4) 同口径) */
export function round4(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10000) / 10000
}

/** 是否默认批号(PC0000;大小写/空格不敏感) */
export function isDefaultLot(lot) {
  return String(lot == null ? '' : lot).trim().toUpperCase() === DEFAULT_LOT
}

/**
 * 取一行上的批号 —— 兼容两种行形态:
 *   · 原始库存行(`v_stock_pick` / STOCK_PICK):键是 `批号`;
 *   · 页面批次行(`scanCode.makeBatchRows` 的结果):键是 `lot`。
 */
export function lotOf(row) {
  if (!row) return ''
  if (row.lot !== undefined && row.lot !== null) return String(row.lot).trim()
  return String(row['批号'] == null ? '' : row['批号']).trim()
}

/**
 * 把 PC0000 稳定地提到最前面(其余行保持传入顺序 —— 调用方已经按先进先出排好)。
 *
 * @param {any[]} rows 库存行或批次行
 * @returns {any[]} 新数组
 */
export function defaultLotFirst(rows) {
  const list = Array.isArray(rows) ? rows : []
  const head = []
  const rest = []
  for (const r of list) (isDefaultLot(lotOf(r)) ? head : rest).push(r)
  return head.length ? [...head, ...rest] : list.slice()
}

/**
 * 扣减顺序:扫到的批次(可选)最前,其余按**显示顺序**(即 PC0000 → 日期在前)。
 *
 * @param {any[]} rows 批次行
 * @param {string} [firstLot] 码里带的批号(没有则空)
 * @returns {number[]} 行下标顺序
 */
export function allocOrder(rows, firstLot = '') {
  const list = Array.isArray(rows) ? rows : []
  const want = String(firstLot || '').trim()
  const order = []
  if (want) {
    list.forEach((b, i) => {
      if (String(b?.lot == null ? '' : b.lot).trim() === want) order.push(i)
    })
  }
  list.forEach((_, i) => {
    if (!order.includes(i)) order.push(i)
  })
  return order
}

/**
 * 默认勾选:按扣减顺序勾到「够本次数量」为止;不够就把有货的全勾上。
 *
 * <p>现场口径是"勾选决定扣哪几批",但又不能逼人每次手勾 —— 扫完物料先按规则勾好,
 * 想换批再手动改。need ≤ 0 时一批都不勾(与旧行为一致:没填数量就不预选)。
 *
 * @param {any[]} rows 批次行
 * @param {number} need 本次数量
 * @param {{ firstLot?: string }} [opts]
 * @returns {any[]} 新数组(checked 已置好,qty 归零,由 {@link allocateChecked} 再填)
 */
export function checkByNeed(rows, need, opts = {}) {
  const list = Array.isArray(rows) ? rows : []
  const want = round4(Math.max(0, Number(need) || 0))
  const out = list.map((b) => ({ ...b, checked: false, qty: 0 }))
  if (want <= 0) return out
  let left = want
  for (const i of allocOrder(out, opts.firstLot)) {
    if (left <= 0) break
    const avail = round4(Number(out[i]?.avail) || 0)
    if (avail <= 0) continue
    out[i].checked = true
    left = round4(left - avail)
  }
  return out
}

/**
 * 按勾选把「本次数量」自动填到各批次上(**按顺序扣**)。
 *
 * <p>只动 checked=true 的行;没勾的行 qty 归零。
 * 不预占、不互斥:同一批号可被多张草稿重复领(跨单占用量由后端算可用量时扣)。
 *
 * @param {any[]} rows 批次行(checked 已经由页面维护)
 * @param {number} need 本次出库数量
 * @param {{ firstLot?: string }} [opts] 码里带的批号(那一批优先扣)
 * @returns {{ rows: any[], allocated: number, shortage: number }}
 */
export function allocateChecked(rows, need, opts = {}) {
  const list = Array.isArray(rows) ? rows : []
  const want = round4(Math.max(0, Number(need) || 0))
  const out = list.map((b) => ({ ...b, qty: 0 }))
  let left = want
  if (left > 0) {
    for (const i of allocOrder(out, opts.firstLot)) {
      if (left <= 0) break
      const b = out[i]
      if (!b || !b.checked) continue
      const avail = round4(Number(b.avail) || 0)
      if (avail <= 0) continue
      const take = round4(Math.min(avail, left))
      b.qty = take
      left = round4(left - take)
    }
  }
  const allocated = round4(out.reduce((s, b) => s + round4(b.qty), 0))
  return { rows: out, allocated, shortage: round4(Math.max(0, want - allocated)) }
}

/**
 * 全选 / 全不选(表头那颗勾):只改 checked,数量由页面随后重算。
 *
 * @param {any[]} rows 批次行
 * @param {boolean} on 勾上 / 取消
 */
export function checkAll(rows, on = true) {
  return (Array.isArray(rows) ? rows : []).map((b) => ({ ...b, checked: !!on, qty: !!on ? round4(b.qty) : 0 }))
}

/**
 * 勾选状态汇总(表头全选框用):全勾 = true,全不勾 = false,一半 = 'indeterminate'。
 *
 * @param {any[]} rows 批次行
 * @returns {boolean|'indeterminate'}
 */
export function allCheckedState(rows) {
  const list = Array.isArray(rows) ? rows : []
  const usable = list.filter((b) => round4(Number(b?.avail) || 0) > 0)
  const on = usable.filter((b) => b.checked).length
  if (on === 0) return false
  if (on === usable.length) return true
  return 'indeterminate'
}
