/**
 * 出货检验（功能/表观）纸面「检验项目 × 内部批次」矩阵 —— 行分组纯函数（唯一真源）。
 *
 * 背景（2026-11-23 用户报障「新增批次后填写内容跑到下面去了」）：
 *   一行 = (检验项目 × 内部批次)，同一检验项目的多个批次行**必须归在一个项目组里**，
 *   纸面才能把每个批次的「实测值 / 本批结果判断」渲染在同一个项目行内。
 *   原来组件按「数组里**连续的**同名行」分组：只要数据顺序变成
 *   `项目1-批1, 项目2-批1, 项目1-批2, 项目2-批2`（批量新增/复制/历史数据很常见），
 *   同一个项目就被拆成两组 ⇒ 纸面出现"同一个项目两行"，用户看到刚填的值掉到了下面一块。
 *   ⇒ 分组口径改成**按身份全局归并**（首次出现顺序），并给 `normalizeRows` 提供重排依据。
 *
 * ⚠ 身份键口径：
 *   · 本组件手工「＋新增检验项」造的行带内存 Symbol token（不写进行、不进 JSON、不落库），
 *     连点两次产生的两个空名字行才不会塌成一组；
 *   · 库里读出来的行没有 token ⇒ 按「检验项目」文本分组（同名 = 同一项目，数据模型如此）。
 *   ⚠ token 用 Symbol 直接挂在行上：经 reactive 代理读照样拿得到；Object.keys/展开/JSON.stringify
 *     都带不走它 ⇒ 不会进"未保存修改"快照、也不会随明细提交给后端。
 */

/** 行身份 token（Symbol 键，只存在内存） */
export const ROW_TOKEN = Symbol('qcProcInspRowToken')

/** 取行的内存 token（非对象/没有则 undefined） */
export function tokenOf(row) {
  return row && typeof row === 'object' ? row[ROW_TOKEN] : undefined
}

/** 给行挂内存 token */
export function setToken(row, token) {
  if (row && typeof row === 'object' && token) row[ROW_TOKEN] = token
}

/** 行 → 分组身份：有 token 用 token（手工新增的空名字行），否则按检验项目文本 */
export function groupKeyOf(row) {
  const token = tokenOf(row)
  if (token) return 't:' + token
  return 'n:' + String(row?.['检验项目'] ?? '')
}

/**
 * 把明细行按「检验项目身份」**全局归并**成组（不是只并连续行）。
 *
 * @param {Array<object>} rows 明细行数组（顺序 = 数据顺序）
 * @returns {Array<{key:string,name:string,rows:Array<object>}>} 组数组，顺序 = 身份首次出现顺序
 */
export function buildGroups(rows) {
  const out = []
  const byKey = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue
    const key = groupKeyOf(row)
    let g = byKey.get(key)
    if (!g) {
      g = { key, name: String(row['检验项目'] ?? ''), rows: [] }
      byKey.set(key, g)
      out.push(g)
    }
    g.rows.push(row)
  }
  // 名字取「首个有值的行」：手工新增的空名字组填了字要立刻显示
  for (const g of out) {
    const named = g.rows.find((r) => String(r?.['检验项目'] ?? '').trim())
    if (named) g.name = String(named['检验项目'])
  }
  return out
}

/**
 * 行数组里同一个身份的组是否**连续**（用于判断要不要重排成项目优先顺序）。
 * 非对象行忽略；空数组视为连续。
 */
export function isContiguouslyGrouped(rows) {
  const seen = new Set()
  let prev = null
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue
    const key = groupKeyOf(row)
    if (key === prev) continue
    if (seen.has(key)) return false
    seen.add(key)
    prev = key
  }
  return true
}
