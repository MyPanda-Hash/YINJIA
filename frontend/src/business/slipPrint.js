/**
 * slipPrint.js — 三张「扫码单」的纸面报表口径(纯逻辑,2026-11-16)
 *
 * <h3>用户口径(原话)</h3>
 * 「其他领料,其他退料和生产退料。都要可以打印报表。(这3个都是在提交的时候打印的,可以补打印。
 *  其他领料和其他退料要有对应关系的二维码,方便手机扫码后补打印,或查询补打印)。
 *  打印格式和生产领料一样,只是名称不同」
 *
 * <h3>三种报表 → 单据面板 / 打印类型 / 纸面标题</h3>
 * <table>
 *   <tr><th>kind</th><th>落库面板</th><th>打印类型(派单键)</th><th>纸面标题</th></tr>
 *   <tr><td>OTHER_PICK</td><td>OTHER_OUT 其他出库单</td><td>OTHER_PICK_SLIP</td><td>其他领料单</td></tr>
 *   <tr><td>OTHER_RET</td><td>MATERIAL_RET 生产退料单</td><td>OTHER_RET_SLIP</td><td>其他退料单</td></tr>
 *   <tr><td>MAT_RET</td><td>MATERIAL_RET 生产退料单</td><td>MAT_RET_SLIP</td><td>生产退料单</td></tr>
 * </table>
 * ⚠ 其他退料 与 生产退料 **落的是同一张面板**(MATERIAL_RET),只能靠 kind 区分标题与打印类型 ——
 * 所以 kind 必须跟到位,不能事后从单据上猜。
 *
 * <h3>纸面不打二维码(2026-11-16 第三轮)</h3>
 * 用户口径:「二维码也不用打了」。这几张单的码原本只用来"扫一下补打印",
 * 而补打印已改成**查单号** ⇒ 纸上的码没了用处,留着只是占位置。
 * 生产领料单(PICK_SLIP)的码是**工单码**,现场还要继续扫,不受影响。
 *
 * <p>本文件**没有任何 import** —— 全是可单测的纯函数;真正取数/入队/调打印层在 slipPrintFlow.js。
 */

/** kind → 口径(面板 / 打印类型 / 标题) */
export const SLIP_KINDS = {
  OTHER_PICK: { panel: 'OTHER_OUT', type: 'OTHER_PICK_SLIP', title: '其他领料单' },
  OTHER_RET: { panel: 'MATERIAL_RET', type: 'OTHER_RET_SLIP', title: '其他退料单' },
  MAT_RET: { panel: 'MATERIAL_RET', type: 'MAT_RET_SLIP', title: '生产退料单' },
}

/** 该 kind 是否存在 */
export function isSlipKind(kind) {
  return Object.prototype.hasOwnProperty.call(SLIP_KINDS, kind)
}

/** kind → 落库面板码(非法 kind 返回空串,调用方据此报错而不是瞎查) */
export function panelOfKind(kind) {
  return SLIP_KINDS[kind]?.panel || ''
}

/** kind → 打印类型 code(必须与后端 PRINT_TYPES 的键一致) */
export function typeOfKind(kind) {
  return SLIP_KINDS[kind]?.type || ''
}

/** kind → 纸面标题 */
export function titleOfKind(kind) {
  return SLIP_KINDS[kind]?.title || ''
}

/**
 * 把后端 `/px/slip/rows` 的返回拼成打印载荷(给 queueToPrintStation / 本机打印层共用)。
 *
 * <p>明细**原样透传**:后端已按代理要的键({材料名称/规格/单位/请领数量/实发数量/备注})返回,
 * 前端再翻译一遍只会多一处口径分叉。
 *
 * <p>⚠ **不带 {@code 二维码内容}**:这三张单纸上不打码(2026-11-16 用户口径),
 * 载荷里不给码 ⇒ 代理不贴码、浏览器打印层也不画二维码框。
 *
 * @param {{ kind:string, docNo:string, data?:object, today?:string }} p
 * @returns {object} { 标题, 领料单号, 领料部门, 打印日期, 明细 }
 */
export function buildSlipPayload({ kind, docNo, data, today } = {}) {
  const d = data || {}
  const no = String(docNo || d['单据编号'] || '').trim()
  const k = String(kind || '').trim()
  return {
    标题: titleOfKind(k),
    领料单号: no,
    // 纸面「领料部门」:其他出库看「部门」、生产退料看「领用人」,后端已归一到 部门 字段
    领料部门: String(d['部门'] || '').trim(),
    // 纸面「日期」用**单据日期**(补打印常常隔天才打,印成打印当天会让人以为单据日期错了)
    打印日期: String(d['单据日期'] || today || '').trim(),
    明细: Array.isArray(d['明细']) ? d['明细'] : [],
  }
}
