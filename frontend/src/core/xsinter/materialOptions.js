/**
 * materialOptions.js —— X烧结配方表「物料编号」下拉的候选生成  2026-10-30
 *
 * 【用户口径·原话】
 *   「X烧结配方计算物料编号应该是在下拉的时候能够看到名字，但是选择填写进去的时候就显示编号
 *     就行了，因为后面已经有名称了，重复了」
 *   「这两个的物料的筛选效果要优化好」
 *
 * 【两件事分开做，别混在一起】
 *   · **下拉里**要「编号 + 名称」都看得见：搜编号、搜名字都能命中（用户记的是名字，
 *     单据上要填的是编号，两种都要能找）；
 *   · **选中后**回显**只有编号**：右边紧邻的就是「物料名称」列，两格都带名字等于同一行
 *     写两遍，还把编号挤成省略号。回显由组件用 el-select 的 `#label` 槽覆盖，不在这里管。
 *
 * 【为什么要封顶】生产商品档案是几千行（`QueryService` 注释记的 3850 行）。el-option 是
 *   真渲染出来的：一次塞几千个，下拉一打开就卡住。这里按编号升序截前 N 条，
 *   同时把**命中总数**如实报出去，组件据此提示"继续输入缩小范围" ——
 *   否则截断在用户眼里就是"搜不到"。
 *
 * 纯函数，无 i18n、无请求：组件只负责取档案行。
 */

/** 下拉最多渲染多少条候选（够滑两屏；再多就靠打字缩小） */
export const XSINTER_OPTION_CAP = 200

const norm = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * @param {Array<Record<string, any>>|null} rows 档案行（`存货编码` / `存货名称`），可跨多个类别
 * @param {number} [cap=XSINTER_OPTION_CAP] 最多返回几项
 * @returns {{options: Array<{value: string, name: string, label: string}>, matched: number}}
 *   value = 存货编码（写进单据的值）；name = 存货名称（选中后回填名称列）；
 *   label = 「编号 名称」（el-select 的 filterable 就是拿 label 做 includes，
 *   所以编号与名称两样都在，两头都能搜到）；matched = 截断前的命中总数
 */
export function xsinterMaterialOptions(rows, cap = XSINTER_OPTION_CAP) {
  const list = Array.isArray(rows) ? rows : []
  const limit = Number.isInteger(cap) && cap > 0 ? cap : XSINTER_OPTION_CAP
  // 编码才是能录进单据的身份：没有编码的档案行不进候选（同编码只留第一条）
  const byCode = new Map()
  for (const r of list) {
    const code = norm(r?.['存货编码'])
    if (!code || byCode.has(code)) continue
    const name = norm(r?.['存货名称'])
    byCode.set(code, { value: code, name, label: name ? `${code} ${name}` : code })
  }
  const all = [...byCode.values()].sort((a, b) => {
    const x = a.value.toLowerCase()
    const y = b.value.toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
  })
  return { options: all.slice(0, limit), matched: all.length }
}
