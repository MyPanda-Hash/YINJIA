/**
 * woFlowChain.js — 「工序流转」逐道明细的**悬停提示文本**(2026-11-14 用户口径)
 *
 * 背景(用户原话):「删除掉这个工序流转明细,这个作用不明显还很丑,除非有其他方法」。
 * 原先工单排产(WorkOrderBoard)与生产工单(WorkOrderList)两页都有一列 `type="expand"`,
 * 展开后是 8 列大表(工序/换算率/计划量/可加工量/已审完工/待报量/待流入量/状态)。
 * 问题:① 行内本来就有「当前工序 + 上道完工量 + 可加工量 + 待报量 + 待流入量」五列,
 *        展开表把同样的数字再说一遍 ⇒ 作用不明显;② 展开表横跨整行、底色发灰,
 *        在一屏几十行的排产表里非常抢眼 ⇒ 丑。
 * ⇒ 展开区整体删除,信息收进「当前工序」格的**悬停提示**:一行一道工序,平时看不见,
 *   要看的人鼠标停一下就有 —— 这是"其他方法"。全工序的进度仍在「生产工序进度看板」
 *   的环/圆点链里(那里是它的主场)。
 *
 * 设计边界:
 *   · 纯字符串拼装,不依赖 Vue / i18n / Element:工序名与数量按传入的 t()/fmt() 格式化,
 *     语言切换由调用方(页面的 tt())负责,方便单测(见 woFlowChain.test.js)。
 *   · 数据源 = 后端 `ProcessFlow` 给每行算的 `工序流转明细[]`(字段:工序/换算率/计划量/
 *     可加工量/已审完工/待报量/待流入量/当前),本文件只挑看板真用得上的几个数。
 *
 * 提示样式(例):
 *   ▶ 成型 · 计划量 25 · 已审完工 25 · 可加工量 25
 *     装箱 · 计划量 50 · 已审完工 0 · 可加工量 0 · 待流入量 50
 * ▶ = 该行当前工序;★ = 从「生产工序进度看板」深链定位过来的那道工序(见 CONTRACT.md §3.1)。
 */

/** 数值兜底(只用于「>0 才显示」的判定,显示仍走调用方的 fmt,保证与表格列的 - 一致) */
function num(v) {
  const n = Number(v == null ? '' : v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 生成「当前工序」格的悬停提示文本(多行字符串;没数据返回空串 ⇒ title 为空 = 不显示提示)。
 *
 * @param {Array<object>} steps 后端 `row.工序流转明细`(可为空/缺字段)
 * @param {object} [opts]
 * @param {(s: string) => string} [opts.t] 词条翻译(默认原样返回;页面传 i18n 的 tt)
 * @param {(v: any) => string} [opts.fmt] 数量格式化(默认原样;页面传 flowNum,空值显示 -)
 * @param {string} [opts.focusOp] 深链定位的工序名(命中那道前面加 ★)
 * @returns {string}
 */
export function flowChainTip(steps, opts = {}) {
  const t = typeof opts.t === 'function' ? opts.t : (s) => String(s ?? '')
  const fmt = typeof opts.fmt === 'function' ? opts.fmt : (v) => String(v ?? '')
  const focusOp = String(opts.focusOp ?? '').trim()
  const list = Array.isArray(steps) ? steps : []
  const lines = []
  for (const f of list) {
    if (!f) continue
    const op = String(f.工序 ?? '')
    const mark = focusOp && op === focusOp ? '★ ' : (f.当前 ? '▶ ' : '')
    let line = `${mark}${t(op)} · ${t('计划量')} ${fmt(f.计划量)} · ${t('已审完工')} ${fmt(f.已审完工)} · ${t('可加工量')} ${fmt(f.可加工量)}`
    // 待流入量 = 还等上一道流下来多少;为 0 时不占提示宽度(排产里大多数格是 0)
    if (num(f.待流入量) > 0) line += ` · ${t('待流入量')} ${fmt(f.待流入量)}`
    lines.push(line)
  }
  return lines.join('\n')
}
