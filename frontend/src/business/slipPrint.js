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
 * 所以 kind 必须跟着二维码一起走(见 {@link slipQrText}),不能事后从单据上猜。
 *
 * <h3>二维码 = 单据与纸面的「对应关系」</h3>
 * 内容形如 `YJSLIP:OTHER_PICK:OO-2026-11-0005` —— 扫一下就知道**这张纸是哪张单、哪种报表**,
 * 手机端据此直接补打印同一张(不用再让人凭记忆输单号)。
 * 与工单二维码(`0@工单号@1001`)刻意用不同的前缀:两者的解析分支完全不同,
 * 混在一起迟早会把工单码当单号去查库。
 *
 * <p>本文件**没有任何 import** —— 全是可单测的纯函数;真正取数/入队/调打印层在 slipPrintFlow.js。
 */

/** 二维码前缀(改它 = 已印出去的纸全部扫不出来,别改) */
export const SLIP_QR_PREFIX = 'YJSLIP'

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
 * 二维码内容。
 *
 * @param {string} kind OTHER_PICK|OTHER_RET|MAT_RET
 * @param {string} docNo 单号
 * @returns {string} `YJSLIP:KIND:DOCNO`;参数不全返回空串(宁可不出码,也不要出一个扫了没用的码)
 */
export function slipQrText(kind, docNo) {
  const k = String(kind || '').trim()
  const no = String(docNo || '').trim()
  if (!isSlipKind(k) || !no) return ''
  return `${SLIP_QR_PREFIX}:${k}:${no}`
}

/**
 * 解析扫到的码。
 *
 * <p>只认 {@link SLIP_QR_PREFIX} 开头、且 kind 合法的串;单号本身可能带 `:`?
 * 不会(号池格式为 `前缀-年月-流水`),但仍按**第一个冒号后整段**取,避免以后号里出现冒号被截断。
 *
 * @param {string} raw 扫码枪/手工输入的原串
 * @returns {{ kind: string, docNo: string } | null}
 */
export function parseSlipQr(raw) {
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return null
  const idx = text.indexOf(':')
  if (idx < 0) return null
  if (text.slice(0, idx).trim().toUpperCase() !== SLIP_QR_PREFIX) return null
  const rest = text.slice(idx + 1)
  const sep = rest.indexOf(':')
  if (sep < 0) return null
  const kind = rest.slice(0, sep).trim().toUpperCase()
  const docNo = rest.slice(sep + 1).trim()
  if (!isSlipKind(kind) || !docNo) return null
  return { kind, docNo }
}

/**
 * 把后端 `/px/slip/rows` 的返回拼成打印载荷(给 queueToPrintStation / 本机打印层共用)。
 *
 * <p>明细**原样透传**:后端已按代理要的键({材料名称/规格/单位/请领数量/实发数量/备注})返回,
 * 前端再翻译一遍只会多一处口径分叉。
 *
 * @param {{ kind:string, docNo:string, data?:object, today?:string }} p
 * @returns {object} { 标题, 领料单号, 领料部门, 打印日期, 二维码内容, 明细 }
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
    二维码内容: slipQrText(k, no),
    明细: Array.isArray(d['明细']) ? d['明细'] : [],
  }
}
