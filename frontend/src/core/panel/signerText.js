/**
 * signerText.js — 会签人「账号串 ⇄ 人员姓名」的纯函数（2026-11-11）
 *
 * 【用户口径】「会签人字段改为下拉勾选对应的账号，就是人员姓名」
 *   ⇒ 界面看到的是**人员姓名**，而落库必须是**账号**。
 *
 * 【为什么落库必须是账号】`ButtonService.signersOf` 按 `[,，、;；\s]+` 切分后，
 *   逐账号 `isEnabledUser(...)` 校验启用状态、`messageService.send(...)` 发会签通知、
 *   并写 `yj_form_approval.operator`（会签通过/驳回都按 operator 匹配本人）。
 *   若把姓名存进去，会签人将"账号不存在或已停用"，整条会签流程走不通。
 *
 * 【为什么单独成模块】这段逻辑原来只能靠跑界面验证，而 RD_CHANGE 的纸面在列表页
 *   恒为只读（无单据载入时不进编辑态），活体验证成本极高。抽成纯函数后可被 node --test
 *   直接覆盖：切分口径与后端对齐、查不到账号时回落显示账号、空值不炸。
 */

/** 与 ButtonService.signersOf 完全一致的分隔符集合（多一个都不能少，否则两端对不上） */
const SEP = /[,，、;；\s]+/

/** 账号串 → 数组（去空、去重保序） */
export function splitSigners(v) {
  const out = []
  const seen = new Set()
  for (const s of String(v == null ? '' : v).split(SEP)) {
    const t = s.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** 数组 → 账号串（顿号分隔：与现有单据里肉眼可读的格式一致，后端也认） */
export function joinSigners(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => String(x == null ? '' : x).trim())
    .filter(Boolean)
    .join('、')
}

/**
 * 账号串 → 显示用姓名串。
 * @param {string} value 库里的账号串
 * @param {Array<{username:string, realName:string}>} users 启用账号清单
 * @returns {string} 姓名串；**查不到的账号回落显示账号本身**（不让格子莫名空掉，
 *                   也让"账号被停用后老单据仍看得见是谁"这条成立）
 */
export function signerNames(value, users) {
  const list = splitSigners(value)
  if (!list.length) return ''
  const nameOf = new Map()
  for (const u of users || []) {
    if (!u || u.username == null) continue
    nameOf.set(String(u.username), String(u.realName || u.username))
  }
  return list.map((a) => nameOf.get(a) || a).join('、')
}
