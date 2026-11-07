/**
 * puPrintAmount.js — 采购订单打印弹窗「小计」口径(2026-11-07)
 *
 * 用户口径:采购订单两个报表(有金额/无金额)打印时要能勾选行、填本次打印数量;
 * 「像材料码那样」留下打印记录(弹窗里可查、可重打/作废)。
 *
 * 这里只保留**一个纯函数**:弹窗表格里「小计」列的实时预览口径。
 * 服务端落库快照(PuPrintService)按同一口径重算(数量没改 ⇒ 沿用订单原金额;
 * 改了 ⇒ 单价 × 本次数量,4 位小数),两边必须一致,否则"预览与纸面/记录对不上"。
 *
 * 为什么放在 core 层:架构闸门 `tools/verify/architecture-audit.mjs` 明令
 * `core/**` 不得 import `business/**`,而弹窗(core/views)要用它,故纯函数落在 core。
 * 单测见同目录 puPrintAmount.test.js。
 */

/**
 * 采购订单打印行的小计。
 *
 * <p>口径:数量**没改** ⇒ 沿用原「金额」;改了 ⇒ `单价 × 本次数量`,按 4 位小数收一次
 * (与库内 `decimal(18,4)` 同口径)。
 * <p>为什么不总是重算:原「金额」可能带折扣(`折扣%` / `折扣金额`)或整单分摊,
 * `单价 × 数量` 未必等于它 —— 没动过的行必须原样落纸,不能被打印这一步悄悄改掉小计。
 *
 * @param {object} line 明细行(数量/单价/金额;字段名为中文数据键,ADR-0001)
 * @param {number|string} qty 本次打印数量
 * @returns {number|string|null} 落纸小计(取不到单价或数量没变时返回原「金额」,可能是 null/空)
 */
export function puOrderLineAmount(line, qty) {
  const origQty = Number(line?.['数量'])
  // 空值(清空输入框)视为"没改",保持原金额;否则 Number('')=0 会把小计算成 0
  const blank = qty === '' || qty === null || qty === undefined
  const q = Number(qty)
  const price = Number(line?.['单价'])
  const changed = !blank && Number.isFinite(q) && (!Number.isFinite(origQty) || Math.abs(q - origQty) > 1e-9)
  if (!changed || !Number.isFinite(price)) return line?.['金额']
  return Math.round(price * q * 10000) / 10000
}
