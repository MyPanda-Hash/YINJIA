/*
 * shipPlanDefaults.js — 《出货检验计划》→ 检验单「默认勾选/预铺哪些检验项」的纯函数
 *
 * 用户口径(2026-11-22 修订,**取代** 2026-10-30 的「外观/尺寸/重量 三类」口径):
 *   「表观抓取 1%/一个生产批次,功能是抓取 1PCS 字眼来区分」
 *   · 出货检验（表观）QC_ASM_INSP:默认勾选 = **检查频率含「1%」** 的行;
 *   · 出货检验（功能）QC_PROC_INSP:默认勾选 = **检查频率含「1PCS」** 的行;
 *   · 两个入口(弹窗「出货检验计划」页签的默认勾选 / 工具栏「取出货检验计划」)共用这一条规则,
 *     后端生单预铺(AsmInspItems)按同一口径只预铺「1%」行;
 *   · 两类都不命中的行(「型式检验…」「型式检验半年一次」、频率为空)两边都**不默认带**,
 *     但仍列在弹窗里,要带就手动勾。
 *
 * 判据来源:fromShipPlan 下发的「检查频率」(= 计划表的 检测频率)。
 * 字典里是「1%/一个生产批次」「1PCS/一个生产批次」「1PCS/一个工单」,历史单据里还有「生产量*1%」,
 * 故**按包含判**(contains),不按全等判;1PCS 大小写不敏感(实测库里都是大写,防手输小写)。
 *
 * ⚠ shipRowType(行 → 外观/尺寸/出货重量) **不再参与取数**,只留作显示层的分组兜底:
 *   组装成品检验单明细第一列「检验类型」是报表分组键(QcAsmInspReportSupport 按它归组),
 *   而计划表的「检验内容」列实测全空 ⇒ 带入/预铺时用它的项目名兜底判一下,免得整列落成占位值。
 */

/** 表观口径的检查频率(字典原值;判定用 contains「1%」,见 isAppearanceRow) */
export const SHIP_APPEARANCE_FREQ = '1%/一个生产批次'

/** 功能口径的检查频率前缀(判定用 /1pcs/i,见 isFunctionalRow) */
export const SHIP_FUNCTION_FREQ = '1PCS'

/** 计划行的检查频率:接口下发键是「检查频率」;兼容老形状「检测频率」 */
export function shipFreqOf(row) {
  const v = row?.['检查频率'] ?? row?.['检测频率'] ?? ''
  return String(v ?? '').trim()
}

/** 表观单默认要带的行:检查频率含「1%」 */
export function isAppearanceRow(row) {
  return shipFreqOf(row).includes('1%')
}

/** 功能单默认要带的行:检查频率含「1PCS」(大小写不敏感) */
export function isFunctionalRow(row) {
  return /1pcs/i.test(shipFreqOf(row))
}

/**
 * 该面板的默认勾选规则:**表观取 1%、功能取 1PCS**;
 * 其它面板(没开这个来源)维持全量 —— 与改造前的兜底一致。
 *
 * 行序 = 计划原序(接口已按 序号 → id 排好),不再按类别重排:
 * 判据换成频率后,「外观在前」已没有依据,重排只会让纸面顺序与计划对不上。
 */
export function defaultShipRows(panelCode, rows) {
  const list = Array.isArray(rows) ? rows : []
  if (panelCode === 'QC_ASM_INSP') return list.filter(isAppearanceRow)
  if (panelCode === 'QC_PROC_INSP') return list.filter(isFunctionalRow)
  return list.slice()
}

/** 单段文本 → 三类之一;归不上返回空串(仅用于显示层的类别兜底,不参与取数) */
export function shipTypeOfText(text) {
  const s = String(text ?? '').trim()
  if (!s) return ''
  if (s.includes('外观')) return '外观'
  if (s.includes('尺寸')) return '尺寸'
  if (s.includes('重量')) return '出货重量'
  return ''
}

/**
 * 计划行 → 外观/尺寸/出货重量(归不上为空串)。**仅给「检验类型/表区」兜分组值用**。
 * 「检验内容」有值就以它为准(它写着性能/材质时,项目名里再出现「尺寸」也不能改判);
 * 该列为空才回退项目名关键词。
 */
export function shipRowType(row) {
  const cat = String(row?.['表区'] ?? row?.['检验类型'] ?? '').trim()
  if (cat) return shipTypeOfText(cat)
  return shipTypeOfText(row?.['检验项目'])
}
