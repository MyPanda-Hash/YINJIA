/**
 * materialOptions.js —— X烧结配方表「物料编号」下拉的候选生成  2026-10-30
 *
 * 【用户口径·原话】
 *   「X烧结配方计算物料编号应该是在下拉的时候能够看到名字，但是选择填写进去的时候就显示编号
 *     就行了，因为后面已经有名称了，重复了」
 *   「这两个的物料的筛选效果要优化好」
 *   「如果一个种类的物料超过了一页下拉的长度，可以提供切页选项，通过切页来选择，
 *     就不会出现明明有这个物料但是因为下拉框限制找不到」
 *
 * 【两件事分开做，别混在一起】
 *   · **下拉里**要「编号 + 名称」都看得见：搜编号、搜名字都能命中（用户记的是名字，
 *     单据上要填的是编号，两种都要能找）；
 *   · **选中后**回显**只有编号**：右边紧邻的就是「物料名称」列，两格都带名字等于同一行
 *     写两遍，还把编号挤成省略号。回显由组件用 el-select 的 `#label` 槽覆盖，不在这里管。
 *
 * 【这里**不再封顶**】上一版是"命中超过 N 条就只给前 N 条"，于是第 N+1 条之后的物料
 *   在界面上根本不存在 —— 用户看到的不是"没有了"，而是"这个料没录"。
 *   现在本函数返回**全量**（去重 + 按编号排序），由 `core/ui/selectPage.js` 按页切；
 *   同一时刻只渲染一页，档案几千行也不会一次渲成几千个 el-option。
 *
 * 纯函数，无 i18n、无请求：组件只负责取档案行。
 */

const norm = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * @param {Array<Record<string, any>>|null} rows 档案行（`存货编码` / `存货名称`），可跨多个类别
 * @returns {Array<{value: string, name: string, label: string}>}
 *   value = 存货编码（写进单据的值）；name = 存货名称（选中后回填名称列）；
 *   label = 「编号 名称」（el-select 的 filterable 就是拿 label 做 includes，
 *   所以编号与名称两样都在，两头都能搜到）。数组按编号升序、同编码只留第一条。
 */
export function xsinterMaterialOptions(rows) {
  const list = Array.isArray(rows) ? rows : []
  // 编码才是能录进单据的身份：没有编码的档案行不进候选（同编码只留第一条）
  const byCode = new Map()
  for (const r of list) {
    const code = norm(r?.['存货编码'])
    if (!code || byCode.has(code)) continue
    const name = norm(r?.['存货名称'])
    byCode.set(code, { value: code, name, label: name ? `${code} ${name}` : code })
  }
  return [...byCode.values()].sort((a, b) => {
    const x = a.value.toLowerCase()
    const y = b.value.toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
  })
}
