/**
 * mobilePick.js — 「手机扫码 · 生产领料」的纯逻辑(2026-10-30 重写)
 *
 * 为什么单独一个模块:领料完成判定、BOM 用量解析、批次拆批上限这些规则要能被
 * `node --test` 钉死边界;页面(MobilePickList.vue / MobilePickDoc.vue)只负责交互与请求。
 *
 * 用户口径(2026-10-30):
 *   「然后进入到那个单据……可以扫码(扫的是物料码,如果对应的物料码存在,就可以填写领料数量
 *    (数量可以随意填写,只要仓库数量足够,多少都可以),批次处理也保留之前的)……
 *    全部领料完成后才可以提交转成材料出库单」
 *   二次确认:① 领料数量上限 = 该物料库存总量(跨批次合计),超出自动拆到下一批;
 *            ② 「全部领料完成」= 每行都有领料数量(>0),不要求等于 BOM 用量。
 *
 * ⚠ 批次处理**沿用**已有实现(`scanCode.js` 的 makeBatchRows / autoAllocateFifo / isNonFifo),
 *   本文件不重复实现,只做"按上限夹住 + 拆到下一批"的编排。
 */

import {
  makeBatchRows, autoAllocateFifo, isNonFifo, selectedBatchRows,
} from './scanCode.js'

/** 四位小数取整(与后端 decimal(18,4) 同口径) */
export function round4(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10000) / 10000
}

/**
 * 解析 BOM「用量」列。
 *
 * 组装BOM表的 `用量` 是 nvarchar(60)(见 `migrate-rd-asm-bom-*` / 表结构),现场可能写成
 * `1` / `2.5` / `1/支` / `1PCS` / `0.5 kg`。规则:
 *   · 取**第一个数字**(含小数)作为用量;
 *   · 完全取不到数字 ⇒ 返回 0(页面显示「—」,**不猜**)。
 *
 * ⚠ 不在这里做"每单位用量 × 排产数量"的换算:用户口径是「按 BOM 展开用料,数量现场扫了再填」,
 *   自动乘出来的数字反而容易被误当成实际领用量。
 *
 * @param {any} raw 单元格原值
 * @returns {number} 用量(解析不出 = 0)
 */
export function parseUsage(raw) {
  const s = String(raw == null ? '' : raw).trim()
  if (!s) return 0
  const m = s.match(/-?\d+(?:\.\d+)?/)
  if (!m) return 0
  return round4(Number(m[0]))
}

/**
 * 后端明细行 → 页面行模型。
 *
 * @param {any[]} lines 后端 `/mobilePick/doc` 返回的 领料明细 / 退料明细
 * @param {'pick'|'back'} side
 * @returns {any[]} 每行 { 行号, 编码, 名称, 规格, 单位, 仓库, 数量, 批号, BOM用量, 已扫 }
 */
export function toRows(lines, side = 'pick') {
  return (Array.isArray(lines) ? lines : []).map((l) => ({
    行号: String(l?.行号 ?? ''),
    编码: String(l?.编码 ?? '').trim(),
    名称: String(l?.名称 ?? '').trim(),
    规格: String(l?.规格 ?? '').trim(),
    单位: String(l?.单位 ?? '').trim(),
    仓库: String(l?.仓库 ?? '').trim(),
    仓库编码: String(l?.仓库编码 ?? '').trim(),
    数量: round4(l?.数量),
    批号: String(l?.批号 ?? '').trim(),
    明细备注: String(l?.明细备注 ?? '').trim(),
    BOM用量: parseUsage(l?.BOM用量),
    // 退料默认 0 且**不算已扫**(用户口径「退料默认数量为0。可以不进行退料操作」);
    // 领料侧"有数量"即视为已领(用户口径「每行都有领料数量(>0)就算完成」)
    已扫: side === 'pick' ? round4(l?.数量) > 0 : round4(l?.数量) > 0,
  }))
}

/**
 * 该物料的**允许填多少**(用户口径:库存总量,跨批次合计)。
 *
 * @param {any[]} batchRows `scanCode.makeBatchRows` 的结果
 * @param {'pick'|'back'} side 领料看库存;退料看这单已领多少
 * @param {number} [picked] 退料侧:该物料已领数量
 * @returns {number}
 */
export function maxQtyOf(batchRows, side = 'pick', picked = 0) {
  if (side === 'back') return round4(Math.max(0, Number(picked) || 0))
  const total = (Array.isArray(batchRows) ? batchRows : [])
    .reduce((s, b) => s + round4(b?.avail), 0)
  return round4(total)
}

/**
 * 把「本次要填的数量」拆到批次上 —— **沿用既有先进先出**,并处理"超出自动拆到下一批"。
 *
 * 用户 2026-10-30 二次确认:「该物料库存总量(跨批次合计),超出自动拆到下一批」。
 * 即:用户填的数 > 当前勾选那一批的数量时,不是报错,而是按日期在前的批次依次补满。
 *
 * @param {any[]} batchRows makeBatchRows 结果(已按 FIFO 排序)
 * @param {number} need 本次要填的总量
 * @returns {{rows: any[], allocated: number, shortage: number, nonFifo: boolean}}
 */
export function allocateForQty(batchRows, need) {
  const want = round4(Math.max(0, Number(need) || 0))
  const rows = autoAllocateFifo(batchRows, want)
  const allocated = round4(rows.reduce((s, b) => s + round4(b.qty), 0))
  return {
    rows,
    allocated,
    shortage: round4(Math.max(0, want - allocated)),
    nonFifo: isNonFifo(rows),
  }
}

/**
 * 扫到物料码后,把「扫到的那一批」优先填满(其余按先进先出补)。
 *
 * 口径与 2026-10-21 版一致(用户口径「批次处理也保留之前的」):
 *   · 码里带了批次 ⇒ 先填那一批(最多填到它的可用量),不够再按 FIFO 往后面的批补;
 *   · 码里没带批次 ⇒ 纯先进先出。
 *
 * @param {any[]} batchRows makeBatchRows 结果(scanned 标记已由 makeBatchRows 置好)
 * @param {number} need 本次要填的量
 */
export function allocateScannedFirst(batchRows, need) {
  let left = round4(Math.max(0, Number(need) || 0))
  if (left <= 0) return { rows: (batchRows || []).map((b) => ({ ...b, qty: 0, checked: false })), allocated: 0, shortage: 0, nonFifo: false }
  const out = (batchRows || []).map((b) => ({ ...b }))
  // ① 先扫到的那一批
  const hit = out.find((b) => b.scanned && b.avail > 0)
  if (hit) {
    const take = round4(Math.min(hit.avail, left))
    hit.qty = take
    hit.checked = take > 0
    left = round4(left - take)
  }
  // ② 剩余按先进先出补(跳过已填的批)
  if (left > 0) {
    for (const b of out) {
      if (left <= 0) break
      if (b === hit) continue
      if (b.avail <= 0) continue
      const take = round4(Math.min(b.avail, left))
      const base = round4(b.qty || 0)
      b.qty = round4(base + take)
      b.checked = b.qty > 0
      left = round4(left - take)
    }
  }
  const allocated = round4(out.reduce((s, b) => s + round4(b.qty), 0))
  return { rows: out, allocated, shortage: round4(left), nonFifo: isNonFifo(out) }
}

/**
 * 「全部领料完成」判定 —— 提交闸门的唯一判据。
 *
 * 用户口径:二次确认「每行都有领料数量(>0)就算完成」。
 * 注意:是**领料侧**每行都有数量;退料侧全是 0 完全正常(不做退料)。
 *
 * @param {any[]} pickRows `toRows(pick明细,'pick')` 的结果
 * @returns {{ok: boolean, total: number, done: number, missing: string[]}}
 */
export function pickProgress(pickRows) {
  const rows = Array.isArray(pickRows) ? pickRows : []
  const total = rows.length
  const missing = rows.filter((r) => round4(r?.数量) <= 0).map((r) => String(r?.编码 || r?.名称 || ''))
  const done = total - missing.length
  return { ok: total > 0 && missing.length === 0, total, done, missing }
}

/**
 * 全部明细是否都退料 0(即"这次不做退料")。
 *
 * 用途:提交领料时,若退料全 0 就提示"这张退料单会一起作废,不产生其他入库单"。
 *
 * @param {any[]} backRows
 */
export function backIsEmpty(backRows) {
  return (Array.isArray(backRows) ? backRows : []).every((r) => round4(r?.数量) <= 0)
}

/** 数量展示:整数不带小数点,小数原样(最多 4 位) */
export function fmtQty(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(round4(v))
}

/** 已勾选批次合计(透传 scanCode 的同名实现,免得两个页面各算一遍) */
export function selectedQty(batchRows) {
  return round4(selectedBatchRows(batchRows).reduce((s, b) => s + round4(b.qty), 0))
}

export { makeBatchRows, autoAllocateFifo, isNonFifo, selectedBatchRows }
