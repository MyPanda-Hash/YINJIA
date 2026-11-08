// 检验标准库「适用单据」——方案按单据分套(2026-10-21 用户口径:
// 「当前组装检验单的各个单据的检验项目高度雷同需要对这个进行差异化修改」)。
//
// 存储形状:`bs_qc_plan.适用单据` = 逗号分隔的**面板代号**(不是中文名 —— 面板名可改,
// 代号是稳定键):QC_FIRST_INSP / QC_PROC_INSP / QC_ASM_INSP;空 = 未归档。
// 后端 /qc/inspPlan/plans 用同样一份代号做 CHARINDEX 精确匹配;这个模块只管前端
// 「显示中文名 / 表单多选 / 提交前拼串」三件事,避免组件里散落 split/join。
export const QC_PLAN_DOC_OPTIONS = [
  { value: 'QC_FIRST_INSP', label: '首件检验单' },
  { value: 'QC_PROC_INSP', label: '出货检验单功能' },
  { value: 'QC_ASM_INSP', label: '组装成品检验单' },
]

const LABEL_OF = new Map(QC_PLAN_DOC_OPTIONS.map((d) => [d.value, d.label]))

/** 任意入参(数组 / 逗号串 / 空) → 去重后的代号数组 */
export function docCodesOf(v) {
  const raw = Array.isArray(v) ? v : String(v ?? '').split(/[,，;；]/)
  const out = []
  for (const x of raw) {
    const code = String(x ?? '').trim().replace(/\s+/g, '')
    if (code && !out.includes(code)) out.push(code)
  }
  return out
}

/** 表单多选数组 → 提交给后端的逗号串(空数组 = 未归档) */
export function docCodesToText(v) {
  return docCodesOf(v).join(',')
}

/** 代号串 → 中文名(未知代号原样显示),多选用「、」连接;空 = 未归档。
 *  t 传 tt 时按当前语言显示(测试/纯逻辑默认原样返回)。 */
export function docLabelsOf(v, t = (x) => x) {
  return docCodesOf(v).map((c) => t(LABEL_OF.get(c) || c)).join('、')
}
