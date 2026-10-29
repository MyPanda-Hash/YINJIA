/**
 * scanCode.js — 现场标签码的解析与「批次勾选 + 先进先出」判定(2026-10-21)
 *
 * 为什么单独一个模块:解析和 FIFO 判定都是纯函数,能被 `node --test` 钉死边界;
 * 页面(MobilePick.vue)只负责交互。
 *
 * 现场实际码型(用户 2026-10-21 给的真实样例):
 *   工单码      `0@GD-2026-10-0221@1001`
 *                └ 首段 0 是占位、无业务含义;第 2 段 = 工单号;
 *                  第 3 段 = **1000 + 工单行号**(1000 是固定尾数前缀,只有后面的数字是行号)
 *                  ⇒ 1001 → 行号 1
 *   商品码      `0@YJ-ZZ-001`             → 物料编码,不带批次
 *   采购标识码  `0@YJ-ZZ-001@20261021`    → 物料编码 + 批次号
 *
 * ⚠ 解析**必须由调用方声明目标**(扫给工单 / 扫给物料),不能靠猜:
 *   第 3 段 `1001`(1000+行号)与 `20261021`(批次日期)都是纯数字,
 *   单看字符串无法区分。页面里哪个输入框触发的扫码,就是哪个目标。
 */

import { fifoSort, batchDate } from './scanPick.js'

/** 四位小数取整(与后端 decimal(18,4) 同口径) */
function round4(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10000) / 10000
}

/**
 * 把原始码切成「有效段」——丢掉首段占位。
 *
 * 分隔符按现场:`@` 为主;历史标签有 `|`(见 scanPick.parseBarcode),一并兼容。
 * 首段判定:纯数字且 ≤ 3 位(典型就是 `0`)视为占位丢弃;
 * 其它情况(如首段就是物料编码)原样保留,避免把 `062` 这类真编码吃掉。
 *
 * @param {string} raw 扫码/手输原串
 * @returns {string[]} 有效段
 */
export function splitScan(raw) {
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return []
  const sep = text.includes('@') ? '@' : (text.includes('|') ? '|' : '')
  let segs = (sep ? text.split(sep) : [text]).map((s) => s.trim()).filter((s) => s !== '')
  if (segs.length > 1 && /^\d{1,3}$/.test(segs[0])) segs = segs.slice(1)
  return segs
}

/**
 * 解析工单码。
 *
 * @param {string} raw `0@GD-2026-10-0221@1001`
 * @returns {{ ok: boolean, wo: string, line: number, reason?: 'empty'|'no-wo' }}
 *          line=0 表示码里没带行号(只有两段)
 */
export function parseWorkOrderCode(raw) {
  const segs = splitScan(raw)
  if (!segs.length) return { ok: false, wo: '', line: 0, reason: 'empty' }
  const wo = segs[0]
  if (!wo) return { ok: false, wo: '', line: 0, reason: 'no-wo' }
  let line = 0
  const tail = segs[1]
  if (tail && /^\d+$/.test(tail)) {
    const n = Number(tail)
    // 1000+行号:减去固定前缀;万一厂商换了前缀,退化为「原样当行号」也不会崩
    line = n >= 1000 ? n - 1000 : n
  }
  return { ok: true, wo, line }
}

/**
 * 解析物料码(商品码 / 采购标识码)。
 *
 * @param {string} raw `0@YJ-ZZ-001` 或 `0@YJ-ZZ-001@20261021`
 * @returns {{ ok: boolean, code: string, batch: string, reason?: 'empty'|'no-code' }}
 */
export function parseMaterialCode(raw) {
  const segs = splitScan(raw)
  if (!segs.length) return { ok: false, code: '', batch: '', reason: 'empty' }
  const code = segs[0]
  if (!code) return { ok: false, code: '', batch: '', reason: 'no-code' }
  const batch = segs.length > 1 ? segs[1] : ''
  return { ok: true, code, batch }
}

/**
 * 把 v_stock_pick 的行整理成「可勾选的批次行」,按先进先出排好。
 *
 * 每行结构:`{ row, lot, warehouse, avail, qty, checked, scanned }`
 *   avail   该(物料,仓库,批号)的现存量
 *   qty     本次从这一批领多少(用户可直接改)
 *   checked qty > 0
 *   scanned 是否就是扫到的那一批(页面标亮)
 *
 * @param {any[]} rows v_stock_pick 行
 * @param {string} [scannedBatch] 码里带的批次号(没有则空)
 */
export function makeBatchRows(rows, scannedBatch = '') {
  const want = String(scannedBatch || '').trim()
  return fifoSort(rows).map((row) => {
    const lot = String(row['批号'] || '').trim()
    const avail = round4(Number(row['现存量']) || 0)
    return {
      row,
      lot,
      lotDate: batchDate(lot),
      warehouse: String(row['仓库'] || row['仓库编码'] || '').trim(),
      warehouseCode: String(row['仓库编码'] || '').trim(),
      avail,
      qty: 0,
      checked: false,
      scanned: !!want && lot === want,
    }
  })
}

/**
 * 按先进先出自动分配这次要领的数量(默认勾选)。
 *
 * 口径(用户 2026-10-20/10-21):日期在前的先扣,不够就扣下一批次,一次领用可拆成多条明细。
 * 纯函数:返回**新的数组**,不改入参,便于「用户手改后还能一键恢复先进先出」。
 *
 * @param {any[]} batchRows makeBatchRows 的结果
 * @param {number} need 本次领用总量
 * @returns {any[]} 新的 batchRows
 */
export function autoAllocateFifo(batchRows, need) {
  let left = round4(Number(need) || 0)
  return (Array.isArray(batchRows) ? batchRows : []).map((b) => {
    if (left <= 0 || b.avail <= 0) return { ...b, qty: 0, checked: false }
    const take = round4(Math.min(b.avail, left))
    left = round4(left - take)
    return { ...b, qty: take, checked: take > 0 }
  })
}

/**
 * 当前勾选是否**违反**先进先出。
 *
 * 判据:按 FIFO 顺序扫一遍,一旦某行「有货却没领完」(qty < avail)或「完全没领」(qty=0),
 * 后面还有行被领了 ⇒ 就是跳批,属于违反。
 * 全部只领最前面的一/几批、且最后一批是部分领取 ⇒ 合规。
 *
 * @param {any[]} batchRows 已按 FIFO 排序的行
 * @returns {boolean} true = 违反(需要在备注里写明)
 */
export function isNonFifo(batchRows) {
  let skipped = false
  for (const b of (Array.isArray(batchRows) ? batchRows : [])) {
    const qty = round4(b.qty)
    if (qty > 0) {
      if (skipped) return true
      // 只领了一部分 ⇒ 后面的批次不许再动
      if (qty < b.avail) skipped = true
    } else if (b.avail > 0) {
      skipped = true
    }
  }
  return false
}

/**
 * 已勾选的行(按 FIFO 顺序),给页面拼明细用。
 * @param {any[]} batchRows
 */
export function selectedBatchRows(batchRows) {
  return (Array.isArray(batchRows) ? batchRows : []).filter((b) => round4(b.qty) > 0)
}

/** 已勾选数量合计 */
export function selectedTotal(batchRows) {
  return round4(selectedBatchRows(batchRows).reduce((s, b) => s + round4(b.qty), 0))
}

/**
 * 超领校验:勾选合计 vs 该物料可用量合计。
 * @returns {{ ok: boolean, over: number }}
 */
export function checkSelection(batchRows, need) {
  const total = selectedTotal(batchRows)
  const want = round4(Number(need) || 0)
  const avail = round4((Array.isArray(batchRows) ? batchRows : []).reduce((s, b) => s + b.avail, 0))
  if (total > avail) return { ok: false, over: round4(total - avail) }
  if (want > 0 && total > want) return { ok: false, over: round4(total - want) }
  return { ok: true, over: 0 }
}
