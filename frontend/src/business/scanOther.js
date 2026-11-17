/**
 * scanOther.js — 「手机扫码 · 其他领料 / 其他退料」的纯逻辑(2026-11-16)
 *
 * <h3>用户口径(原话)</h3>
 * 「手机端再做一个其他领料和其他退料,其他领料关联其他入库单,其他退料就还是按生产退料来。
 *  其他领料和退料都是直接扫物料二维码进行的。扫完几个二维码后,可以点提交。
 *  就生成了,之后重新扫就是另一个单据了」
 *
 * 三问确认(2026-11-16):
 *  ① **其他领料 = 其他出库单 OTHER_OUT**(用户勾的是「其他出库单(OO-,扣库存)」——
 *     原话里的「其他入库单」是口误:领料是把料领出仓库,方向必须扣库存);
 *  ② **其他退料 = 生产退料单 MATERIAL_RET**,业务类型照旧写「生产退料」;
 *  ③ 页面只要「扫码 + 提交」,**不要已提交单据列表** —— 提交后清空清单,接着扫就是另一张单。
 *
 * <h3>与「扫码领料」(views/scm/ScanPick.vue)的关系</h3>
 * 同一套骨架(扫标签 → 按批号查可用量 → 加入清单 → 生单),差别只有三点:
 *   <ul>
 *   <li>落哪张单:{@code ScanPick} 固定 MATERIAL_OUT(生产领料),本模块按 side 选 OTHER_OUT / MATERIAL_RET;</li>
 *   <li>**不绑工单**:这两页是「随手领/随手退」,物料码扫到什么就记什么,没有 BOM 约束、没有工单号;</li>
 *   <li>退料不查上限:退的是「手上这批货」,没有"已领多少"可比(与生产退料不同 ——
 *       那边能退多少 = 该领料单已领 − 已退)。</li>
 *   </ul>
 *
 * <h3>⚠ 单据键名一律用**面板标签**(不是物理列名)</h3>
 * {@code ButtonService.save} 是按 {@code labelToCol} 取值({@code String col = f != null ? f.col() : label}),
 * 所以写表单必须用 yj_field.label:
 *   <ul>
 *   <li>OTHER_OUT 明细:存货编码 / 存货名称 / 规格型号 / 计量单位 / 仓库 / 仓库编码 /
 *       **批次号**(物理列叫 批号)/ 数量 / 单价 / 金额 / 明细备注;</li>
 *   <li>MATERIAL_RET 明细:材料编码 / 材料名称 / 规格型号 / 计量单位 / 仓库 / 仓库编码 /
 *       **批次号**(物理列 批号)/ 数量 / 单价 / 金额 / 明细备注。</li>
 *   </ul>
 * 头必填(两边都只有这三个):单据日期 / 单据编号(留空由 FormNoService 生成)/ 业务类型。
 */

/** 其他领料:其他出库单(扣库存) */
export const SIDE_PICK = 'pick'
/** 其他退料:生产退料单(加库存,业务类型「生产退料」) */
export const SIDE_RET = 'ret'

/** side → 落库面板码 */
export const PANEL_OF_SIDE = { pick: 'OTHER_OUT', ret: 'MATERIAL_RET' }

/**
 * side → 业务类型(**数据键,永不翻译**)。
 * ⚠ OTHER_OUT 的「业务类型」是带字典的必填键(yj_field.dict_sql 只给了一个值「其他出库」),
 *   写别的值会落在下拉之外的脏数据里,故这里钉死「其他出库」;
 *   MATERIAL_RET 按用户口径「其他退料就还是按生产退料来」⇒ 仍写「生产退料」。
 */
export const BIZ_OF_SIDE = { pick: '其他出库', ret: '生产退料' }

/** side → 页面标题(显示层,走 tt()) */
export const TITLE_OF_SIDE = { pick: '其他领料', ret: '其他退料' }

/** side 归一:除 'ret' 外一律按领料处理(与后端 scanMaterial 的 side 口径一致) */
export function normalizeSide(side) {
  return side === SIDE_RET ? SIDE_RET : SIDE_PICK
}

export function panelOfSide(side) {
  return PANEL_OF_SIDE[normalizeSide(side)]
}

export function bizOfSide(side) {
  return BIZ_OF_SIDE[normalizeSide(side)]
}

export function isRet(side) {
  return normalizeSide(side) === SIDE_RET
}

/** side → 页面标题中文原文(显示层再走 tt()) */
export function titleOfSide(side) {
  return TITLE_OF_SIDE[normalizeSide(side)]
}

/**
 * 清单行的合并键:(存货编码, 批号, 仓库编码) 三者相同即视为同一行,数量相加。
 *
 * <p>为什么带仓库:同一物料可能来自两个仓,退料时甚至要指定退到哪个仓 ——
 * 合并成一行的后果是"账记在 A 仓、货在 B 仓",对不上。
 */
export function lineKey(l) {
  return [l?.code, l?.batch, l?.warehouseCode || l?.warehouse]
    .map((x) => String(x == null ? '' : x).trim())
    .join('|')
}

/**
 * 数量校验。领料受库存约束,退料只要求 > 0。
 *
 * @param {string} side pick|ret
 * @param {number} qty 本次数量
 * @param {number} available 该(物料,仓库,批号)的现存量(退料时无意义,传 0 即可)
 * @returns {{ ok: boolean, reason?: 'no-qty'|'no-stock'|'exceed' }}
 */
export function checkQty(side, qty, available) {
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: 'no-qty' }
  if (isRet(side)) return { ok: true }
  const stock = Number(available)
  if (!Number.isFinite(stock) || stock <= 0) return { ok: false, reason: 'no-stock' }
  // 允许小数(kg/米):按 4 位比较,避开 0.1+0.2 的浮点尾差
  if (Math.round(n * 10000) > Math.round(stock * 10000)) return { ok: false, reason: 'exceed' }
  return { ok: true }
}

/**
 * 把一次扫码结果并进清单(同键累加,不新增行)。
 *
 * <p>**纯函数**:返回新的 lines 数组,不改入参 —— 页面里因为并发扫码/重复点提交
 * 出过"清单被就地改坏一半"的问题,这里一律走不可变写法。
 *
 * @param {any[]} lines 现有清单
 * @param {object} cand 本次扫到的候选行(STOCK_PICK 行,或退料时由档案补出来的行)
 * @param {number} qty 本次数量
 * @param {string} side pick|ret
 * @returns {{ ok: boolean, reason?: string, lines: any[] }}
 */
export function mergeLine(lines, cand, qty, side) {
  const list = Array.isArray(lines) ? lines : []
  if (!cand) return { ok: false, reason: 'no-cand', lines: list }
  const available = Number(cand['现存量']) || 0
  const check = checkQty(side, qty, available)
  if (!check.ok) return { ok: false, reason: check.reason, lines: list }

  const line = {
    key: lineKey({
      code: cand['存货编码'],
      batch: cand['批号'],
      warehouseCode: cand['仓库编码'],
      warehouse: cand['仓库'],
    }),
    code: String(cand['存货编码'] || '').trim(),
    name: String(cand['存货名称'] || '').trim(),
    spec: String(cand['规格型号'] || '').trim(),
    uom: String(cand['计量单位'] || '').trim(),
    batch: String(cand['批号'] || '').trim(),
    warehouse: String(cand['仓库'] || cand['仓库编码'] || '').trim(),
    warehouseCode: String(cand['仓库编码'] || '').trim(),
    price: Number(cand['结存单价']) || 0,
    qty: Number(qty),
  }

  const idx = list.findIndex((l) => l.key === line.key)
  if (idx < 0) return { ok: true, lines: [...list, line] }

  const merged = Math.round((Number(list[idx].qty) + Number(line.qty)) * 10000) / 10000
  // 领料:累加后仍不得超过现存量(同批号扫两次也要守住)
  if (!isRet(side)) {
    const up = checkQty(side, merged, available)
    if (!up.ok) return { ok: false, reason: up.reason, lines: list }
  }
  const next = list.slice()
  next[idx] = { ...list[idx], qty: merged }
  return { ok: true, lines: next }
}

const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000

function today() {
  // 用本地日期,不用 toISOString(UTC) —— 早上 8 点前会变成前一天(单据日期错一天)
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 其他领料 ⇒ **其他出库单**(OTHER_OUT)的 formData。
 *
 * @param {any[]} lines 清单行(mergeLine 产出的形态)
 * @param {{ date?: string, operator?: string, note?: string }} [head]
 */
export function buildOtherOutForm(lines, head = {}) {
  const items = (Array.isArray(lines) ? lines : []).map((l, i) => ({
    行号: String(i + 1),
    存货编码: String(l.code || '').trim(),
    存货名称: String(l.name || '').trim(),
    规格型号: String(l.spec || '').trim(),
    计量单位: String(l.uom || '').trim(),
    仓库: String(l.warehouse || '').trim(),
    仓库编码: String(l.warehouseCode || '').trim(),
    批次号: String(l.batch || '').trim(),
    数量: Number(l.qty) || 0,
    单价: Number(l.price) || 0,
    金额: round4((Number(l.qty) || 0) * (Number(l.price) || 0)),
    明细备注: String(l.note || '').trim() || '扫码其他领料',
  }))
  const form = {
    单据日期: head.date || today(),
    单据编号: '',                                  // 后端 FormNoService 生成
    业务类型: bizOfSide(SIDE_PICK),                // 其他出库(字典唯一值)
    单据状态: '草稿',
    备注: String(head.note || '').trim() || '扫码其他领料(移动端)',
    detail: { items },
  }
  if (String(head.operator || '').trim()) {
    form.经手人 = String(head.operator).trim()
    form.经手人编码 = String(head.operator).trim()
  }
  return form
}

/**
 * 其他退料 ⇒ **生产退料单**(MATERIAL_RET)的 formData。
 *
 * <p>业务类型按用户口径写「生产退料」;**不写工单号/工单行号** —— 这两页不绑工单,
 * 写空比写错好(写了假工单号,生产退料明细表按工单号一筛就是脏数据)。
 *
 * @param {any[]} lines 清单行
 * @param {{ date?: string, operator?: string, note?: string }} [head]
 */
export function buildMaterialRetForm(lines, head = {}) {
  const items = (Array.isArray(lines) ? lines : []).map((l, i) => ({
    行号: String(i + 1),
    材料编码: String(l.code || '').trim(),
    材料名称: String(l.name || '').trim(),
    规格型号: String(l.spec || '').trim(),
    计量单位: String(l.uom || '').trim(),
    仓库: String(l.warehouse || '').trim(),
    仓库编码: String(l.warehouseCode || '').trim(),
    批次号: String(l.batch || '').trim(),          // ⚠ 标签是「批次号」,物理列是 批号
    数量: Number(l.qty) || 0,
    单价: Number(l.price) || 0,
    金额: round4((Number(l.qty) || 0) * (Number(l.price) || 0)),
    明细备注: String(l.note || '').trim() || '扫码其他退料',
  }))
  const form = {
    单据日期: head.date || today(),
    单据编号: '',
    业务类型: bizOfSide(SIDE_RET),                 // 生产退料
    单据状态: '草稿',
    备注: String(head.note || '').trim() || '扫码其他退料(移动端)',
    detail: { items },
  }
  if (String(head.operator || '').trim()) {
    form.领用人 = String(head.operator).trim()
    form.经手人编码 = String(head.operator).trim()
  }
  return form
}

/**
 * 按 side 出 formData(页面只调这一个,免得每处都写 if/else 走错单据)。
 */
export function buildForm(side, lines, head = {}) {
  return isRet(side) ? buildMaterialRetForm(lines, head) : buildOtherOutForm(lines, head)
}

/**
 * 提交成功后的提示语**键**(交给 tt() 翻译;单号另行拼接)。
 *
 * <p>为什么要拆成「键 + 单号」而不是一整句:tt() 是按**原文全等**查译名的,
 * 带单号的动态串永远查不到 —— 英文界面下会直接漏出中文。
 */
export function doneMessageKey(side) {
  return isRet(side)
    ? '已生成生产退料单，请到生产退料单里审核'
    : '已生成其他出库单，请到其他出库单里审核'
}

/** 提交成功后的完整提示(键 + 单号);给日志/测试用,界面请用 {@link doneMessageKey} 再拼单号 */
export function doneMessage(side, docNo) {
  const no = String(docNo == null ? '' : docNo).trim()
  return doneMessageKey(side) + (no ? '：' + no : '')
}
