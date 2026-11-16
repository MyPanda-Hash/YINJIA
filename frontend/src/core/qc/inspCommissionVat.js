/**
 * inspCommissionVat.js —— 检验委托单「总金额（含增值税6%）」换算(2026-11-16 用户口径)
 *
 * 用户口径:「修改文件的总金额计算方式,将合计收费修改为（总金额（含增值税6%）RMB）。
 *            之后的总金额需要在原基础上增加6%的数值」
 * ⇒ 纸面「合计收费」改名为「总金额（含增值税6%）RMB」,金额 = 行表「收费」合计 × (1 + 6%)。
 *
 * 为什么要单独成模块:金额换算是**纯算术**,放进 .vue 里只能靠"读源码断言"这种弱测试;
 *   外置后可以对真实数字做单测(600→636.00、123.45→130.86 这类四舍五入边界)。
 * 口径:按**分**四舍五入(`Math.round(x*100)/100`),避免 600×1.06 = 636.0000000000001 的浮点尾差。
 */

/** 增值税率:6% */
export const VAT_RATE = 0.06

/** 非数字/空值按 0 处理(不让脏值把纸面算成 NaN) */
function numOf(net) {
  const n = Number(net)
  return Number.isFinite(n) ? n : 0
}

/** 净额 → 含税总额(数值,保留两位小数口径) */
export function withVat(net) {
  return Math.round(numOf(net) * (1 + VAT_RATE) * 100) / 100
}

/** 净额 → 含税总额文本(两位小数;纸面显示与表头「合计收费」同源) */
export function vatTotalText(net) {
  return withVat(net).toFixed(2)
}
