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

/**
 * 该面板纸张右上角那格**该绑哪个键**:配置声明优先,没声明才自动推断。
 *
 * 2026-10-29 引入。用户口径「产品文件内的面板的右上角的编号应该改为单据编号,所有的都是」——
 * 只改标识文案不够:同一句「编号」在不同面板指向两种号,而自动推断只看「head 里有没有 文档编号」,
 * 撞上**文档编号是隐藏物理列但仍在 head 里**的面板(出货检验计划表 RD_INSP_PLAN)就把 YJ-RD001
 * 印到右上角,那张单自己的 IP-2026-10-00xx 反而一个字看不到(2026-10-29 探针实测)。
 *
 * @param {Record<string, unknown>|null|undefined} head 单据表头
 * @param {Record<string, unknown>|null|undefined} effHead 生效的报告头配置(可能含 docNoKey)
 * @returns {string} 数据键名
 */
export function docNoKeyFor(head, effHead) {
  const declared = String((effHead && effHead.docNoKey) || '')
  return declared || docNoKeyOf(head)
}

/**
 * 纸张右上角那格的**标识文案**(带全角冒号,直接喂 tt())。'' = 不印标识。
 *
 * 三种取值(未声明的面板逐字不变 —— 几十张面板依赖这个缺省):
 *   · `docnoPrefix === false`  ⇒ ''(7 张数据记录表设计原值就是裸编号,无「编号：」);
 *   · `docnoPrefix` 是**字符串** ⇒ 文案本身,补全角冒号('单据编号' → '单据编号：');
 *   · 其余(undefined / true)  ⇒ 缺省「编号：」。
 *
 * ⚠ 与 docNoKeyFor 必须成对使用:只改文案会印出「单据编号：YJ-RD001」这种张冠李戴的字。
 *
 * @param {unknown} v 配置里的 head.docnoPrefix
 * @returns {string} 带冒号的标识;'' = 不印
 */
export function docnoPrefixOf(v) {
  if (v === false) return ''
  if (typeof v === 'string') return v.endsWith('：') ? v : v + '：'
  return '编号：'
}
