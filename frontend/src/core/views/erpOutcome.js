/**
 * erpOutcome.js —— 「转ERP」按钮的结果提示口径(纯函数,可 node --test 断言)
 *
 * 背景(2026-11-09 用户报障):
 *   「转erp按钮,已转erp的要弃审后,重新审核后才可以转erp,但是现在可以直接转erp
 *     会一直显示转erp执行成功,应该需要已转的有已经转的提示。」
 *
 * 真实行为(服务端 `KingdeePushService.pushDocument` ①):
 *   已转的单据再点「转ERP」**不会重复推送** —— 命中 `是否已转ERP = 是` 守卫后直接返回
 *   `{是否已转ERP:'是', ERP单号, message:'该单据已转入ERP，不可重复转入'}`(HTTP 200,data 里没有错误)。
 *   前端 `ElMessage.success('「转ERP」执行成功')` 无条件弹成功 ⇒ 用户以为"没弃审也能再转、而且转成功了"。
 *
 * 口径(**只认服务端说的"已转",不按"有没有报错"推断**):
 *   · 已转 ⇒ warning + 「已转过」提示(带 ERP单号 + 要重转请先弃审再审核);
 *   · 未转 ⇒ success(维持原提示不变);
 *   · 判定优先级:服务端显式 `already=true` 标记 > 老 jar 的 message 文案
 *     (部署时新旧版本同时存在,老 jar 没这个标记,只能认文案)。
 *
 * ⚠ 不要用响应里的 `是否已转ERP === '是'` 判"已转" —— 推送**成功**时服务端同样回写'是'
 *   (`pushDocument` ⑥),拿它当判据会把每一次成功推送都误报成"已转过"。
 */

/** 已转提示的中文键(含 {no} 占位符,由 erpOutcomeText 填入 ERP 单号;译名见 i18n/locales/*.js biz) */
export const ERP_ALREADY_KEY = '该单据已转入ERP（{no}），不可重复转入；如需重新转ERP，请先「弃审」再「审核」'

/**
 * 判定一次「转ERP」调用的结果。
 * @param {any} res 服务端 `callButton` 返回的 data(可能为 null:老 jar / 异常路径)
 * @returns {{already:boolean, level:'success'|'warning', erpNo:string, key:string}}
 *   already —— 是否"这单早就转过了,本次没有推送"
 *   level   —— ElMessage 的等级
 *   erpNo   —— 已有的 ERP 单号(可能为空串)
 *   key     —— 走 tt() 的中文键;未转时为空串(调用方沿用原来的成功文案)
 */
export function erpOutcome(res) {
  const erpNo = String(res?.['ERP单号'] ?? '').trim()
  const msg = String(res?.message ?? '')
  const already = res?.already === true || msg.includes('已转入ERP')
  if (already) return { already: true, level: 'warning', erpNo, key: ERP_ALREADY_KEY }
  return { already: false, level: 'success', erpNo, key: '' }
}

/**
 * 把 erpOutcome() 的结果拼成可直接弹的文案(翻译 + {no} 替换只在这一处做)。
 * @param {{already:boolean, key:string, erpNo:string}} o erpOutcome 的返回
 * @param {(s:string)=>string} translate 传 `tt`
 * @returns {string} 未转时返回空串(调用方走原来的成功文案)
 */
export function erpOutcomeText(o, translate) {
  if (!o?.already) return ''
  const t = typeof translate === 'function' ? translate : (s) => s
  return t(o.key).replace('{no}', o.erpNo || '—')
}
