/**
 * 统一生单对话框(勾选明细行 + 本次数量)的纯函数 —— 便于 `node --test` 直接单测,不需要浏览器。
 *
 * 背景(2026-10-31 用户口径):
 *   「**生单**也要变成可以勾选的和选择数量的(现在只有采购订单的生单做了特殊处理),
 *    非定制化的生单只要可以勾选和选择数量就可以」;并新增「**批量生单**」——
 *   在左侧单据选择栏勾多张来源单 → 打开一个界面列出这些单据的明细行 → 再勾行/填量 → 转单。
 *
 * 后端(/px/push/lines)对**分批链路**与**普通推式生单**下发同一份行契约:
 *   { lineKey, rowKind:'order'|'printed', 数量, 已送数量, 已退回数量, 剩余数量, 可送上限, 批次号? }
 * 所以这里一套函数同时服务两条链路 —— 两套算法迟早会漂(与 batchSendLines.js 同一教训)。
 *
 * 口径要点:
 *   · **勾选是权威**:未勾选的行即使填了数量也不提交(2026-09-21 事故:只勾一行却全送);
 *   · 默认只勾「有剩余的**订单行**」;已打印隔离行(rowKind='printed')必须由用户**显式勾选**
 *     (用户口径:打印后的那一行在作废之前不会与生单有关联);
 *   · 可生单上限:订单行 = 数量×(1+超送比例)−已送+已退回(与后端 BatchService.overAllowance 同公式),
 *     隔离行 = 服务端给的可送上限(= 未生单量,印在标签上的量不可超);
 *   · 分批链路的**一张单只能一个批次号**:勾到多个已打印批次就按号拆成多张单(与原分批对话框同款)。
 */
import { buildBatchSendLines, overAllowance } from './batchSendLines.js'

/** 已打印的隔离行(材料码打印出去的那部分量,自带批次号) */
export function isPrintedRow(row) {
  return row?.rowKind === 'printed'
}

/** 勾选集合的归一(组件里存数组,纯函数既收 Set 也收数组) */
export function picksOf(picked) {
  if (picked instanceof Set) return picked
  return new Set((picked || []).filter(Boolean))
}

/**
 * 行的「本次可生单上限」。
 * @param {object} row  /px/push/lines 下发的行
 * @param {number} ratioPct 超送比例百分数(0~50);普通链路传 0
 */
export function capOf(row, ratioPct = 0) {
  if (!row) return 0
  if (isPrintedRow(row)) return Math.max(0, Number(row.可送上限 ?? row.剩余数量 ?? 0))
  return overAllowance(row.数量, row.已送数量, row.已退回数量, ratioPct)
}

/** 该行能不能勾(还有可生单量) */
export function rowSelectable(row, ratioPct = 0) {
  return capOf(row, ratioPct) > 0.000001
}

/**
 * 默认勾选:有剩余的**订单行**(lineKey 顺序 = 表格顺序)。
 * 隔离行**不在**默认勾选里 —— 见文件头口径。
 */
export function defaultPickKeys(rows = []) {
  return (rows || [])
    .filter((r) => !isPrintedRow(r) && Number(r?.剩余数量 || 0) > 0)
    .map((r) => r.lineKey)
}

/** 一张来源单在单据头显示的一行摘要(日期 · 往来单位/归属),纯展示 */
export function docSummary(header = {}) {
  const parts = []
  const date = header['单据日期'] || header['日期']
  if (date) parts.push(String(date).slice(0, 10))
  for (const k of ['供应商', '客户', '客户名称', '部门', '生产线']) {
    if (header[k] !== undefined && header[k] !== null && String(header[k]).trim() !== '') {
      parts.push(String(header[k]))
      break
    }
  }
  return parts.join(' · ')
}

/** 行集合里出现的已打印批次号(去重、保序) */
export function printedBatchesOf(doc, lines = []) {
  const rowOf = new Map((doc?.lines || []).map((r) => [r.lineKey, r]))
  const out = []
  for (const l of lines || []) {
    const row = rowOf.get(l.lineKey)
    if (!isPrintedRow(row)) continue
    const batch = String(row?.['批次号'] || '').trim()
    if (batch && !out.includes(batch)) out.push(batch)
  }
  return out
}

/**
 * 组装提交体:`[{ sourceNo, batchNo?, lines:[{lineKey, qty}] }]`
 *
 * · 未勾选 / 数量为 0 的行不提交(勾选是权威);
 * · **分批链路**按"目标批次号"分组:隔离行取**它自己的号**,订单行取该单的批次号输入框 ——
 *   勾到多个已打印批次号时同一张来源单会拆成多条(后端每批生一张单,与旧分批对话框一致);
 * · 普通链路每张来源单一条。
 *
 * @param {Array} docs           /px/push/lines 的 docs(每条含 sourceNo/lines/batchFlow/batchNo)
 * @param {object} pickedByDoc   { [sourceNo]: Set|Array } 勾选行键
 * @param {object} qtyOf         { [lineKey]: number } 本次数量
 */
export function buildDocsPayload(docs = [], pickedByDoc = {}, qtyOf = {}) {
  const out = []
  for (const doc of docs || []) {
    const lines = buildBatchSendLines(doc?.lines || [], pickedByDoc?.[doc.sourceNo] || [], qtyOf)
    if (!lines.length) continue
    if (!doc.batchFlow) {
      out.push({ sourceNo: doc.sourceNo, lines })
      continue
    }
    const rowOf = new Map((doc.lines || []).map((r) => [r.lineKey, r]))
    const groups = new Map()
    for (const l of lines) {
      const row = rowOf.get(l.lineKey)
      const target = (isPrintedRow(row) ? String(row?.['批次号'] || '').trim() : '') || String(doc.batchNo || '').trim()
      if (!groups.has(target)) groups.set(target, [])
      groups.get(target).push(l)
    }
    for (const [batchNo, groupLines] of groups) {
      const item = { sourceNo: doc.sourceNo, lines: groupLines }
      if (batchNo) item.batchNo = batchNo
      out.push(item)
    }
  }
  return out
}

/** 本次合计(只算已勾选的行) */
export function sumPicked(docs = [], pickedByDoc = {}, qtyOf = {}) {
  let sum = 0
  for (const doc of docs || []) {
    const lines = buildBatchSendLines(doc?.lines || [], pickedByDoc?.[doc.sourceNo] || [], qtyOf)
    for (const l of lines) sum += Number(l.qty) || 0
  }
  return Math.round(sum * 100) / 100
}

/** 已勾选行数(未填数量也算勾了 —— 底部计数用) */
export function pickedCount(docs = [], pickedByDoc = {}) {
  let n = 0
  for (const doc of docs || []) {
    const keys = pickedByDoc?.[doc.sourceNo]
    const size = keys instanceof Set ? keys.size : (keys || []).length
    n += size
  }
  return n
}

/**
 * 提交前的分批闸门:勾了**多个已打印批次号**又同时勾了未打印量 ⇒ 不能混在一张单里
 * (一张单只能一个批次号;原分批对话框同一句提示)。
 * @returns {string} 需要拦截时返回提示文案键,通过返回空串
 */
export function mixedBatchBlocked(docs = [], pickedByDoc = {}, qtyOf = {}) {
  for (const doc of docs || []) {
    if (!doc.batchFlow) continue
    const lines = buildBatchSendLines(doc?.lines || [], pickedByDoc?.[doc.sourceNo] || [], qtyOf)
    const batches = printedBatchesOf(doc, lines)
    if (batches.length <= 1) continue
    const rowOf = new Map((doc.lines || []).map((r) => [r.lineKey, r]))
    if (lines.some((l) => !isPrintedRow(rowOf.get(l.lineKey)))) return '勾选了多个已打印批次号时不能同时送未打印量：请先按已打印行生单，或把未打印量分开操作'
  }
  return ''
}
