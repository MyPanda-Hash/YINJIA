/**
 * puPrintRows.js — 采购订单「打印时编辑」的落纸行(2026-11-07)
 *
 * 用户口径:「采购订单的打印(两个报表一个有金额,一个没有金额),需要能够在打印报表的时候编辑
 * (像打印材料码的编辑一样),要可以勾选打印和填写数量」。
 *
 * 为什么放在 core 层而不是 `business/print-formats.js`:
 *   · 纸面 HTML 版式是业务适配层的事(print-formats),而"勾哪些行 / 填多少数量"是**面板弹窗的
 *     通用能力**,core/views 的弹窗要用它;
 *   · 架构闸门 `tools/verify/architecture-audit.mjs` 明令 `core/**` 不得 import `business/**`,
 *     故纯函数只能落在 core —— 版式那边(print-formats)并不需要它,不构成重复实现。
 *
 * 两个函数都是**纯函数**(不改入参),单测见同目录 puPrintRows.test.js。
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
  const q = Number(qty)
  const price = Number(line?.['单价'])
  const changed = Number.isFinite(q) && (!Number.isFinite(origQty) || Math.abs(q - origQty) > 1e-9)
  if (!changed || !Number.isFinite(price)) return line?.['金额']
  return Math.round(price * q * 10000) / 10000
}

/**
 * 采购订单/无金额版打印:「勾选的行 + 本次打印数量」落成待打印行。
 *
 * <p>弹窗只改**这一张报表**,不写回订单 ⇒ 返回新数组,原始明细行一个键都不改。
 *
 * <p>两条口径:
 * <ol>
 *   <li>`picks` 里**没有**的行 = 不打印(勾选是权威);</li>
 *   <li>改了数量的行,小计按 {@link puOrderLineAmount} 重算;没改的行沿用原金额。</li>
 * </ol>
 *
 * @param {Array<object>} lines 明细行(getFormDescriptor 的 detailData 行)
 * @param {Object<string, number|{数量:number}>} picks 要打印的行(`key → 本次数量`);
 *        传 `{}`/不传 ⇒ 一行都不打印(调用方负责"至少勾一行"的提示)
 * @param {(row:object, index:number)=>string} [keyOf] 行键(默认 id → 行号 → 下标;与弹窗勾选键同源)
 * @returns {Array<object>} 待打印行(新对象,`数量`/`金额` 已按本次输入覆盖)
 */
export function puOrderPrintRows(lines, picks, keyOf) {
  const list = (Array.isArray(lines) ? lines : []).filter((l) => l && (l['物料编码'] || l['物料名称']))
  if (!picks) return []
  const keyOfRow = typeof keyOf === 'function'
    ? keyOf
    : (row, i) => String(row?.id ?? row?.['行号'] ?? i)
  const out = []
  list.forEach((line, i) => {
    const key = String(keyOfRow(line, i))
    if (!Object.prototype.hasOwnProperty.call(picks, key)) return
    const raw = picks[key]
    const picked = raw && typeof raw === 'object' ? raw['数量'] : raw
    const row = { ...line }
    const qty = Number(picked)
    // 空值不覆盖(保持原数量);填了数就按它落纸并重算小计
    if (picked !== '' && picked != null && Number.isFinite(qty)) {
      row['数量'] = qty
      row['金额'] = puOrderLineAmount(line, qty)
    }
    out.push(row)
  })
  return out
}
