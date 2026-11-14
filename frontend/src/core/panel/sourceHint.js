/**
 * 单据表头的「来源」提示(2026-11-11 用户口径,第三版)。
 *
 * <p>口径演进:
 * <ol>
 *   <li>第一版:「表头最末尾加一个来源…和显示对应的单据编号」→ 做成两个表头格子;</li>
 *   <li>第二版:「**不要做成字段,做成个按钮或者是提示就行**」→ 移到单据号旁的可点提示;</li>
 *   <li>第三版(本文件):「跳转到的是什么面板的界面,**不需要跳转**」→ **只显示、不跳转**;
 *       并且「为什么之前的单据就没有来源了」⇒ 没有上游单据的单据显示「无上游单据」,
 *       把"没有"讲明白,而不是留空让人以为坏了。</li>
 * </ol>
 *
 * <p>数据来自表头两条隐藏列(`来源` = 来源面板名,`来源单号` = 那张单的编号):
 * <ul>
 *   <li>送料暂收单免检直达 → 来源 = 送料暂收单 / SL-…</li>
 *   <li>来料检验单审核入库 → 来源 = 来料检验单 / IJ-…</li>
 *   <li>特采单审批通过入库 → 来源 = 特采单 / TC-…</li>
 *   <li>早期直接录入 / ERP 单号形态的老单 → 两列为空 ⇒ 提示显示「无上游单据」</li>
 * </ul>
 *
 * <p>本文件**不 import 菜单/别名资源**(纯函数,`node --test` 直接跑),
 * 文案在这里拼好、在视图里 `tt()` 翻译,两边共用同一份,不会漂移。
 */

/**
 * 这个面板是不是「把 `来源` 当隐藏列」的那种(采购入库单就是:来源列 hidden,信息由本提示显示)。
 *
 * <p>为什么要判:别的面板也有叫 `来源` 的**可见**字段(如 ASM_BOM),那些面板本来就把值摆在表头上,
 * 再挂一条同样的提示就是重复噪音 —— 只在「来源是隐藏列」的面板上挂。
 *
 * @param {Array<object>} fields 面板字段元数据(列表页 dataSchema.fields / 表单页 meta,键是 dataName|code)
 */
export function hasHiddenSourceColumn(fields) {
  return (fields || []).some((f) => {
    const key = String((f && (f.code || f.dataName)) || '').trim()
    return key === '来源' && f.hidden === true
  })
}

/**
 * 从单据表头取出「来源」两列。
 *
 * @param {object} doc 单据表头(键是中文数据键)
 * @returns {{type: string, docNo: string, empty: boolean}}
 *   `empty=true` ⇒ 这条单据没有上游单据(早期直接录入 / ERP 单号形态),界面显示「无上游单据」。
 */
export function sourceHintOf(doc) {
  const head = doc || {}
  const type = String(head['来源'] || '').trim()
  const docNo = String(head['来源单号'] || '').trim()
  return { type, docNo, empty: !type && !docNo }
}

/**
 * 提示正文:`来源: 来料检验单 IJ-…`;没有上游单据时 `来源: 无上游单据`。
 *
 * @param {{type: string, docNo: string, empty: boolean}} hint {@link sourceHintOf} 的结果
 * @param {(s: string) => string} [t] 显示层翻译(界面上传 tt)
 */
export function sourceHintText(hint, t = (s) => s) {
  const h = hint || { type: '', docNo: '', empty: true }
  if (h.empty) return t('来源') + ': ' + t('无上游单据')
  const parts = [h.type ? t(h.type) : '', h.docNo].filter(Boolean)
  return t('来源') + ': ' + parts.join(' ')
}

/**
 * 悬停说明(不跳转,只解释这条提示的含义)。
 *
 * @param {{type: string, docNo: string, empty: boolean}} hint
 * @param {(s: string) => string} [t]
 */
export function sourceHintTitle(hint, t = (s) => s) {
  const h = hint || { type: '', docNo: '', empty: true }
  if (h.empty) return t('没有暂收/检验/特采上游单据(早期直接录入或 ERP 单号形态的老单)')
  if (h.type && h.docNo) return t(h.type) + ': ' + h.docNo
  return h.docNo || t(h.type)
}
