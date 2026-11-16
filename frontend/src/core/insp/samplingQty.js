/**
 * samplingQty.js —— 「取样要求」自由文本 → 「抽检量」数值的唯一解析口径。
 *
 * 【为什么需要】(2026-11-13 用户报障:「使用出货检验单功能的保存按钮后会出错」,
 *   报错 `PreparedStatementCallback; SQL state [S0005], error code [8114];
 *   Error converting data type nvarchar to numeric`)
 *   检验项目标准库(bs_qc_item)的「取样要求」是**自由文本**(如「称取100g」「每批5件」「全检」),
 *   而出货检验单明细的「抽检量」是 **decimal 数值列**。原实现直接把取样要求原文写进抽检量,
 *   一旦用户用「带入检验项目」带入标准库条目再保存,后端 INSERT/UPDATE 就会 8114,整张单保存失败。
 *
 * 【口径】只认「能明确表示一个数量的写法」,其余一律返回 null(不写这一格,保存不受影响):
 *   · 纯数字:`5` / `5.5` / ` 5 ` → 5 / 5.5
 *   · 数字 + 常见计量单位:`5PCS` / `5 pcs` / `5件` / `10个` / `2支` → 数字部分
 *   (历史迁移就是按「nPCS → n」回填的,见 migrate-insp-req-align / 抽检量存量回填注释)
 *   · 其余(「称取100g」「每批5件」「全检」「按GB2828」…)→ null,**不猜**(猜错会造假数据)
 *
 * 纯函数、无副作用,单测见 samplingQty.test.js。
 */

/** 可跟在数字后面的计量单位(大小写不敏感) */
const UNITS = ['pcs', 'PC', '件', '个', '只', '支', '根', '条', '片']

/**
 * @param {*} raw 取样要求原文(可能是 undefined/null/数字)
 * @returns {number|null} 抽检量;解析不出来返回 null
 */
export function parseSamplingQty(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const s = String(raw).trim()
  if (!s) return null
  // 1) 纯数字(可带正负/小数)
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  // 2) 数字 + 计量单位(单位表外的写法一律不认)
  const unitAlt = UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const m = s.match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*(?:' + unitAlt + ')$', 'i'))
  if (m) {
    const n = Number(m[1])
    return Number.isFinite(n) ? n : null
  }
  return null
}
