/**
 * planChainNotice.js — 把 planChain 的「日期自动调平 / 提交硬校验」结果变成用户话术
 * (2026-11-11:单行「工序路线排线」与「批量排产」两个弹窗原各写一遍,收成一份)
 *
 * 两类问题、四个方向,话术整句走语言包(日期用 `{d}` 占位,避免拼接串出全角标点):
 *   · 本道:计划开工不能晚于本道计划完工(2026-11-09 口径);
 *   · 工序顺序:下道工序的日期不能早于上道工序(2026-11-11 口径「下方的工序不能比上方的工序小」)。
 *
 * ⚠ 只依赖 `tt` 与纯逻辑,不含 Vue 状态;供 `ProcessRoutePlanDialog` / `ScheduleBatchDialog` 共用。
 */
import { tt } from '@/i18n'
import { planDateProblems } from './planChain'

const MSG_OWN_START = '计划开工日期不能晚于计划完工日期，已把开工日期调为 {d}'
const MSG_OWN_DUE = '计划开工日期不能晚于计划完工日期，已把完工日期调为 {d}'
const MSG_ORDER_START = '下道工序的计划开工日期不能早于上道工序的计划完工日期，已把开工日期调为 {d}'
const MSG_ORDER_DUE = '下道工序的计划完工日期不能早于上道工序的计划完工日期，已把完工日期调为 {d}'
const MSG_PROBLEM_INVERTED = '计划开工日期不能晚于计划完工日期'
const MSG_PROBLEM_ORDER = '下道工序的计划开工日期不能早于上道工序的计划完工日期'

const fill = (key, date) => tt(key).replace('{d}', date)

/**
 * 改完日期后的「已自动调平」提示(空数组 ⇒ 没调平,不用弹)。
 * @param {{start:(string|null), due:(string|null)}} fixed planChain 的 cascade* 返回值
 * @param {'start'|'due'} direction 本次改的是哪个字段
 * @returns {string[]} 一条或多条提示(调用方 join 后弹)
 */
export function planFixMessages(fixed, direction) {
  const f = fixed || {}
  const out = []
  if (direction === 'due') {
    if (f.due) out.push(fill(MSG_ORDER_DUE, f.due))   // 完工被上道完工夹住
    if (f.start) out.push(fill(MSG_OWN_START, f.start)) // 开工被本道完工拉回
  } else {
    if (f.start) out.push(fill(MSG_ORDER_START, f.start)) // 开工被上道完工夹住
    if (f.due) out.push(fill(MSG_OWN_DUE, f.due))        // 完工被本道开工顺延
  }
  return out
}

/**
 * 提交前硬校验(空串 ⇒ 通过)。两类问题一次列全:
 * 本道日期倒挂 + 下道工序早于上道工序。
 * @param {Array<object>} rows 工序行(按工序顺序,数据键中文)
 * @returns {string} 可直接 `ElMessage.warning(msg)` 的提示;无问题 ⇒ ''
 */
export function planProblemMessages(rows) {
  const probs = planDateProblems(rows)
  if (!probs.length) return ''
  const inv = probs.filter((p) => p.kind === 'inverted')
  const order = probs.filter((p) => p.kind === 'order')
  const out = []
  if (inv.length) {
    out.push(`${tt(MSG_PROBLEM_INVERTED)}: ${inv
      .map((p) => `${p.row['工序'] || ''} ${p.row['计划开工日期']} → ${p.row['计划完工日期']}`.trim())
      .join('; ')}`)
  }
  if (order.length) {
    out.push(`${tt(MSG_PROBLEM_ORDER)}: ${order
      .map((p) => `${p.row['工序'] || ''} ${p.row['计划开工日期']} < ${(p.prevRow && p.prevRow['工序']) || ''} ${p.prevDue}`.trim())
      .join('; ')}`)
  }
  return out.join('; ')
}
