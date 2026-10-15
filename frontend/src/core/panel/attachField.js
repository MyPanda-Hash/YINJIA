/**
 * attachField.js —— 从**面板下发的字段元数据**里发现「附件字段」
 *
 * 附件在本仓库是**元数据驱动**的:yj_field.data_type='附件' ⇒ 下发的 dataSchema.fields 里带 dataType:'附件',
 * 渲染层据此挂 FileAttachCell(见 RecordSheetPanels.vue 的 pair.type==='file' 分支、PanelxList 的 attachFields)。
 * 但**文书式面板(DocSheet)此前整条链没接**:立项申请(RD_APPROVAL)的备注栏因此没有上传入口
 * (2026-10-16 用户报障)。这里把"怎么找附件字段"抽成一个纯函数,给 DocSheet 用,顺带可单测。
 *
 * 键口径必须与渲染层的行模型一致:PanelxList.headerFieldKey = `field.code || field.dataName`
 * (行模型的键是 yj_field.label;下发的 dataSchema 里就是 dataName/code 这一支)。
 * 只有 dataType 没有键的字段**视为没有** —— 拿不到键就写不进行模型,渲染出来也是死的。
 */

/** @returns {{key:string,label:string}|null} 附件字段(取第一个);没有则 null */
export function attachFieldOf(fields) {
  const list = Array.isArray(fields) ? fields : []
  for (const f of list) {
    if (!f || f.dataType !== '附件') continue
    const key = String(f.code || f.dataName || f.label || '')
    if (!key) return null
    return { key, label: String(f.label || f.name || key) }
  }
  return null
}
