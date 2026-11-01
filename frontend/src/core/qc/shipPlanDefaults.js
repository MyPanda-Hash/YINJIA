/*
 * shipPlanDefaults.js — 《出货检验计划》→ 检验单「默认勾选哪些检验项」的纯函数(2026-10-30)
 *
 * 用户口径:
 *   · 组装成品检验单(QC_ASM_INSP):「取出货检验计划只带 外观/尺寸/重量 三项,其余默认不勾选」
 *     ⇒ 默认勾选 = 三类;其余照常列在弹窗里,要带再手动勾(不再像早先那样整张计划全量带入)。
 *   · 制程检验单(QC_PROC_INSP):「默认不带这三项、其他都默认勾选」
 *     ⇒ 默认勾选 = 三类以外的全部(性能/功能性测试/跌落强度/卫生安全…)。
 *   两个入口共用同一条规则:工具栏「取出货检验计划」按默认勾选的行带入;
 *   弹窗「出货检验计划」页签打开时把这几行打上勾(用户可改),点「带入明细」只带勾选的。
 *
 * 类别怎么判:
 *   ① 优先计划明细的「检验内容」——fromShipPlan 里同值下发为 表区 / 检验类型(PanelxList.areaKeyOf);
 *   ② 该列为空时回退按「控制项目」名称关键词判(2026-10-30 实测:库里两张计划(IP-…-0008/0011)
 *      的 检验内容 全为 NULL,不兜底就一条都选不上)。
 *   规则与 AsmInspItems.typeOf / PanelxList.normInspType 同一套词表(外观/尺寸/重量);
 *   含「重量」一律归 出货重量(重量/净重/干重都算)。
 */

/** 三个「实物类」检验类别(固定组名 = 成品检验检验类型词汇表) */
export const SHIP_PHYSICAL_TYPES = ['外观', '尺寸', '出货重量']

/** 单段文本 → 三类之一;归不上返回空串 */
export function shipTypeOfText(text) {
  const s = String(text ?? '').trim()
  if (!s) return ''
  if (s.includes('外观')) return '外观'
  if (s.includes('尺寸')) return '尺寸'
  if (s.includes('重量')) return '出货重量'
  return ''
}

/**
 * 计划行 → 三类之一(归不上为空串)。
 * 「检验内容」有值就以它为准(它写着性能/材质时,项目名里再出现「尺寸」也不能改判);
 * 该列为空才回退项目名关键词。
 */
export function shipRowType(row) {
  const cat = String(row?.['表区'] ?? row?.['检验类型'] ?? '').trim()
  if (cat) return shipTypeOfText(cat)
  return shipTypeOfText(row?.['检验项目'])
}

/** 该面板的默认勾选规则:成品=三类;制程=三类以外的全部;其它面板(没开这个来源)=维持全量 */
export function defaultShipRows(panelCode, rows) {
  const list = Array.isArray(rows) ? rows : []
  if (panelCode === 'QC_ASM_INSP') {
    return sortAsPhysical(list.filter((r) => SHIP_PHYSICAL_TYPES.includes(shipRowType(r))))
  }
  if (panelCode === 'QC_PROC_INSP') {
    return list.filter((r) => !SHIP_PHYSICAL_TYPES.includes(shipRowType(r)))
  }
  return list.slice()
}

/**
 * 成品检验的带入顺序 = 外观 → 尺寸 → 出货重量(用户 2026-10-30 口径「从上到下分别为外观,尺寸,重量」)。
 * 同类内保持计划原序(Array#sort 稳定);制程保持计划原序,不重排。
 */
export function sortAsPhysical(rows) {
  const order = new Map(SHIP_PHYSICAL_TYPES.map((t, i) => [t, i]))
  return (Array.isArray(rows) ? rows : []).slice().sort(
    (a, b) => (order.get(shipRowType(a)) ?? 99) - (order.get(shipRowType(b)) ?? 99),
  )
}
