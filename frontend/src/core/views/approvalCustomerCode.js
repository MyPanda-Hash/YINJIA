/**
 * 立项申请表「客户编码」解析（纯函数，2026-11-20 从 DocSheet.vue 抽出以便单测）。
 *
 * 【口径来源】用户 2026-11-06 / 2026-11-17 / 2026-11-19：
 *   · 立项编号 = 客户编码 + 日期（YYYYMMDD）；
 *   · 选完客户后，客户名后要显示客户编号（如「A-60 欧科塑胶制品(深圳)有限公司」）。
 *
 * 【为什么不能只取一个键】客户参照（RD_APPROVAL.客户名 → KHDA）的行对象键名随取数路径变化：
 *   · 档案模式按 `yj_field.label` 下发 ⇒ 键是「客户编码 / 客户名称」（KHDA 的 dm 标签有时登记为
 *     「客户代码」）；
 *   · 有的路径按物理列给键 ⇒ `dm` / `mc`；
 *   · 生产实测（2026-11-17）按「客户编码 / dm / 客户名称」逐个取名都落空，但**行里明明有 A-60**。
 *   ⇒ 取数顺序：显式编码列 → 从客户名里抠 → 扫这一行所有值（与键名无关）。
 *
 * 【取不到就返回空串】不拿中文名/手机号硬当编码；调用方据此不显示前缀（不是显示空灰块）。
 */
/** 显式编码列的候选键（按优先级） */
export const CODE_KEYS = ['客户编码', '客户代码', 'dm', '客户编号', '编码']
/** 客户名候选键：编码可能就写在名字里（如「B-85-06 青岛伊可普」） */
export const NAME_KEYS = ['客户名', '客户名称', 'mc']
/**
 * 名字里编码段的形态：字母段(1-4) + 连字符 + 数字开头，后面可继续接字母/数字/连字符。
 *   B-85-06 / A-60 / C-112 都能命中；纯数字手机号 18658439031、纯中文都不会误命中。
 * ⚠ 编码位置不固定（生产实测编码在中文名之后）⇒ 必须全串扫，不能锚定开头。
 */
export const CODE_IN_NAME = /[A-Za-z]{1,4}-[0-9][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*/

export function resolveCustomerCode(source) {
  // ① 先取显式编码列（与键名/取值路径无关）
  for (const k of CODE_KEYS) {
    const v = source?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  // ② 再从客户名里抠（用户口径：客户名里已含编码时也要能用）
  for (const k of NAME_KEYS) {
    const name = source?.[k]
    if (name === undefined || name === null) continue
    const m = String(name).match(CODE_IN_NAME)
    if (m && m[0]) return m[0]
  }
  // ③ 最后兜底：扫这一行的所有值（键名不可靠时唯一可靠的是「值本身长什么样」）
  for (const v of Object.values(source || {})) {
    if (v === null || v === undefined) continue
    const m = String(v).match(CODE_IN_NAME)
    if (m && m[0]) return m[0]
  }
  return ''
}
