/**
 * shipInspNg.js —— 出货检验「判定不合格 → 去开不合格品处理单(制程)」的**显隐契约**(2026-11-20)。
 *
 * 用户口径:「品质相关所有检验记录选择不合格都需要跳转至相关流程单据，当前出货检验（功能）就是转到
 * 不合格处理（制程）」。追问后确认范围 = 出货检验（功能）QC_PROC_INSP + 出货检验（表观）QC_ASM_INSP;
 * 交互 = 纸面上判定不合格时出「去开不合格处理单」按钮(见 QcProcInspSheet.vue 的 qr-band),
 * 点了由 PanelxList.openNgDisposition → POST /api/qc/shipInsp/ng 取/建处理单草稿后跳过去。
 *
 * 为什么单独抽成模块:这两张单共用同一个纸面组件(QcProcInspSheet),而「哪张面板 + 什么结论才算不合格」
 * 是**业务判据**,不是渲染细节 —— 抽成纯函数后单测能直接钉住,不必去解析 .vue 模板。
 *
 * ⚠ 「不合格」是**存储数据键**(ADR-0001:数据键永远中文、不随语言变),显示层翻译由 tt() 负责;
 *   这里比对的就是库里的原值,不要换成译名。
 */

/** 有「不合格 → 开处理单」入口的面板(纸面共用 QcProcInspSheet 的两张) */
export const SHIP_INSP_PANELS = ['QC_PROC_INSP', 'QC_ASM_INSP']

/** 目标单据:不合格品处理单(制程) */
export const NG_DISPOSITION_PANEL = 'QC_BHC'

/** 检验结论的不合格数据键 */
export const NG_VERDICT = '不合格'

/** 纸面按钮文字(渲染时走 tt) */
export const NG_DISPOSITION_ACTION = '去开不合格处理单'

/** 本单检验结论是否判了不合格(空/历史自由文本一律不算) */
export function isNgVerdict(head) {
  return String(head?.['总结论'] ?? '').trim() === NG_VERDICT
}

/** 是否在纸面上给「去开不合格处理单」按钮 = 面板命中 + 结论不合格 */
export function canOpenNgDisposition(panelCode, head) {
  return SHIP_INSP_PANELS.includes(String(panelCode || '')) && isNgVerdict(head)
}
