/**
 * planChainNotice.js — 把 planChain 的「日期自动调平 / 提交硬校验」结果变成用户话术
 * (2026-11-11:单行「工序路线排线」与「批量排产」两个弹窗原各写一遍,收成一份)
 *
 * 2026-11-18 第二轮:跨道顺序不再硬校验(后道开工按前道实际开工推导,允许早于前道计划完工),
 * 只剩「本道开工晚于本道完工」一类问题 —— 话术随之收成两条(改完工拉回开工 / 改开工顺延完工)。
 *
 * ⚠ 只依赖 `tt` 与纯逻辑,不含 Vue 状态;供 `ProcessRoutePlanDialog` / `ScheduleBatchDialog` 共用。
 */
import { tt } from '@/i18n'
import { planDateProblems } from './planChain'

const MSG_OWN_START = '计划开工日期不能晚于计划完工日期，已把开工日期调为 {d}'
const MSG_OWN_DUE = '计划开工日期不能晚于计划完工日期，已把完工日期调为 {d}'
const MSG_PROBLEM_INVERTED = '计划开工日期不能晚于计划完工日期'

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
    if (f.start) out.push(fill(MSG_OWN_START, f.start))  // 开工被本道完工拉回
  } else if (f.due) {
    out.push(fill(MSG_OWN_DUE, f.due))                   // 完工被本道开工顺延
  }
  return out
}

/**
 * 提交前硬校验(空串 ⇒ 通过):只列**本道日期倒挂**(开工晚于完工)。
 * @param {Array<object>} rows 工序行(按工序顺序,数据键中文)
 * @returns {string} 可直接 `ElMessage.warning(msg)` 的提示;无问题 ⇒ ''
 */
export function planProblemMessages(rows) {
  const probs = planDateProblems(rows)
  if (!probs.length) return ''
  return `${tt(MSG_PROBLEM_INVERTED)}: ${probs
    .map((p) => `${p.row['工序'] || ''} ${p.row['计划开工日期']} → ${p.row['计划完工日期']}`.trim())
    .join('; ')}`
}
