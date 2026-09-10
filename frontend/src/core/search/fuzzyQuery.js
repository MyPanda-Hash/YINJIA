/**
 * 文书侧栏「模糊搜索」条件构建(纯函数,无 Vue 依赖)。
 * 把「字段 + 内容」条件行翻译成后端 queryFormDataList 的入参:
 *  - 具体字段 → condition[字段] = 内容,后端按 LIKE '%内容%' 匹配
 *    (表头字段打到单头表;明细字段走 EXISTS 行匹配,任一明细行命中即算命中该单据)
 *  - 「全部字段」→ keyword,后端在表头+明细全部字段上 OR 模糊
 *  - 多条件由后端自动 AND(即"精准搜索")
 *  - 空行忽略;同一字段填多行时后一行覆盖前一行(条件表是 key-value,同字段无法并存两条)
 */

/** 字段下拉里的「全部字段」选项值(与真实字段名不会冲突) */
export const ALL_FIELDS = '__all__'

/**
 * @param {{field:string, value:string}[]} rows 条件行
 * @returns {{condition:Object, keyword:string, valid:boolean}}
 */
export function buildFuzzyQuery(rows = []) {
  const condition = {}
  let keyword = ''
  for (const row of rows || []) {
    const field = row && row.field ? String(row.field).trim() : ''
    const value = row && row.value !== null && row.value !== undefined ? String(row.value).trim() : ''
    if (!field || !value) continue
    if (field === ALL_FIELDS) {
      keyword = value
      continue
    }
    condition[field] = value
  }
  return { condition, keyword, valid: !!keyword || Object.keys(condition).length > 0 }
}
