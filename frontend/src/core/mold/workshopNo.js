/**
 * workshopNo.js — 「车间」两套写法的归一(纯函数,可 node --test 断言)
 *
 * 背景(2026-11-04 用户查烧结工艺清单录单流程时确认的口径 A):
 *   系统里同一个车间有两套写法,而且**两边都不许改**:
 *     · 单据侧 `生产车间` 参照部门档案(bs_dept):值 = `1#车间` / `2#车间` / …(原先取 部门编码 `D05`)。
 *       部门是既有基础档案,别的模块也在用。
 *     · 生产模具表 `rd_sinter_tolerance.车间`:值 = `1` / `2` / `3` / `4`,还有 `1/3` 表示两个车间共用。
 *       60 行标准库数据,改它影响面更大。
 *   ⇒ 唯一可行的是**在代码里归一**:两边都只取"开头的车间号"再比,谁也不动。
 *
 * 口径
 *   · `1` / `1#车间` / `1车间` / ` 1 ` ⇒ `'1'`;
 *   · `1/3` 这类共用写法由调用方按 `/` 拆开,**逐段**归一后比较(见 workshopMatches);
 *   · 前置字母的(`D05` 部门编码、`W1`)一律**不猜** ⇒ 返回 `''`(宁可筛不到,也不能把 D05 当成 5 号车间);
 *   · `01` 与 `1` 视为同一车间(去掉前导 0)。
 */

/**
 * 取"车间号":字符串开头的纯数字(允许前后空白),其它情况返回空串。
 * @param {any} v
 * @returns {string} `'1'` / `'3'` … 或 `''`
 */
export function workshopNo(v) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  const m = s.match(/^[0-9]+/)
  if (!m) return ''
  return String(Number(m[0]))
}

/**
 * 模具表某一行的 `车间` 值 与 单据的 `生产车间` 值是否同一车间。
 *
 * @param {any} rowValue  模具表 `车间`(可能是 `1`、`1/3`)
 * @param {any} headValue 单据 `生产车间`(可能是 `1#车间`、`D05`、`1`)
 * @returns {boolean} 任一段车间号相等即命中;单据侧取不到车间号 ⇒ false(不猜)
 */
export function workshopMatches(rowValue, headValue) {
  const want = workshopNo(headValue)
  if (!want) return false
  return String(rowValue ?? '')
    .split('/')
    .some((seg) => workshopNo(seg) === want)
}