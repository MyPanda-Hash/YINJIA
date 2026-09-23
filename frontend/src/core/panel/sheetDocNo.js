/**
 * 纸张右上角「编号：」格该绑哪个数据键。
 *
 * 面板两种命名口径并存(见 CONTEXT.md「数据键」):
 *   · 文档/规格书类面板(RD_SPEC_DOC、数据记录表系列……)编号字段叫「文档编号」;
 *   · 单据类面板(成型工艺清单 RD_MOLD_PROC、组装工艺 RD_ASM_PROC……)编号字段叫「单据编号」。
 *
 * 渲染器(RecordSheetPanels.vue)原来的可编辑分支写死 `head['文档编号']` ⇒ 单据类面板
 * **编辑期间那格永远空白**(库里/提示里都有号,就是纸上看不见);只读分支因为写了
 * `head['文档编号'] || head['单据编号']` 兜底才正常 —— 所以这个缺陷只在"填单子的时候"出现,
 * 2026-09-21 由真人流程 e2e 探针(_probe-moldproc-e2e.cjs ①-2b/⑨-1b)抓到。
 *
 * @param {Record<string, unknown>|null|undefined} head 单据表头(键为该面板的字段名)
 * @returns {'文档编号'|'单据编号'} 该面板实际使用的编号键
 */
export function docNoKeyOf(head) {
  return head && Object.prototype.hasOwnProperty.call(head, '文档编号') ? '文档编号' : '单据编号'
}
