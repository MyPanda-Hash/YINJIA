/**
 * planChain.js — 工序排线的「计划开工/计划完工日期」日期链纯逻辑(2026-10-30)
 *
 * 用户口径(2026-10-29):「上一道的计划完工日期 = 下一道的计划开工日期」。
 * 单行排线弹窗(ProcessRoutePlanDialog)与批量排产弹窗(ScheduleBatchDialog)共用这一份,
 * 避免两处各写一遍日期链(改一处忘一处 ⇒ 批量与单行的计划日期口径不一致)。
 *
 * 口径细节(从单行弹窗原样抽出,**行为不变**):
 *   · 打开时 normalizePlanChain:第 2 道起「开工 = 上一道完工」,保留该道原计划时长整体顺延;
 *     首道缺开工给今天;缺完工 = 开工;完工早于开工 ⇒ 拉到开工。
 *   · 改完工日 cascadeDue:下一道开工 = 本道完工,后续按各自原时长顺延(沿链下传)。
 *   · 改开工日 cascadeStart:开工晚于本道完工 ⇒ 完工拉到开工,并继续沿链下传。
 *
 * 🔴 2026-11-09 用户报障(批量排产截图):两道日期能**倒挂** —— 「计划开工 2026-11-09 /
 *   计划完工 2026-11-03」。根因:cascadeDue 只处理「下一道」,**没有管被改的那一道自己** ——
 *   把某道的完工日改到早于它的开工日(上例:首道默认今天 11-09,完工改成交期 11-03)后,
 *   本道开工仍旧留着 11-09,链上下一道却已按 11-03 排好。用户口径:「让当前的开工日期不得大于完工日期」。
 *   ⇒ 现在两条编辑路径都保证「开工 ≤ 完工」:改完工时若早于本道开工,开工一起调到完工日;
 *     改开工时若晚于本道完工,完工拉到开工日(原行为,顺带把自动调平提示出来)。
 *     `isPlanDateInverted` / `invertedPlanRows` 供弹窗提交前硬校验(任何路径漏过去也拦得住)。
 *
 * 数据键中文(与 routeSteps / preplanManual 的 步骤 一致),日期串统一 `YYYY-MM-DD`。
 */

/** 日期串规整:只取日期部分(库里可能给 `2026-11-03T00:00:00`);空 ⇒ '' */
function ymd(text) {
  return String(text == null ? '' : text).slice(0, 10)
}

/**
 * 本行是否**日期倒挂**(计划开工晚于计划完工)。任一为空 ⇒ 不算倒挂(还没填不算错)。
 * @param {object} row 工序行(数据键中文)
 * @returns {boolean}
 */
export function isPlanDateInverted(row) {
  if (!row) return false
  const start = ymd(row['计划开工日期'])
  const due = ymd(row['计划完工日期'])
  return Boolean(start && due && start > due)
}

/**
 * 把**所有**日期倒挂的行挑出来(提交前硬校验 + 行内提示用)。
 * @param {Array<object>} rows 工序行
 * @returns {Array<{row: object, index: number}>}
 */
export function invertedPlanRows(rows) {
  return (rows || [])
    .map((row, index) => ({ row, index }))
    .filter((x) => isPlanDateInverted(x.row))
}

/** 今天(本地时区,`YYYY-MM-DD`) */
export function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 日期串 + n 天;非法输入原样返回(不炸) */
export function addDays(text, n) {
  const parts = String(text || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return String(text || '')
  const [y, m, d] = parts
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

/** b − a 的天数(日期串);非法输入按 0 */
export function daysBetween(a, b) {
  const p1 = String(a || '').split('-').map(Number)
  const p2 = String(b || '').split('-').map(Number)
  if (p1.length !== 3 || p2.length !== 3) return 0
  const [y1, m1, d1] = p1
  const [y2, m2, d2] = p2
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000)
}

/** 某道的计划时长(完工 − 开工);缺任一或为负 ⇒ 0 */
function durationOf(row) {
  if (!row || !row['计划开工日期'] || !row['计划完工日期']) return 0
  return Math.max(0, daysBetween(ymd(row['计划开工日期']), ymd(row['计划完工日期'])))
}

/**
 * 改某道的**计划完工日期**:下一道开工日 = 本道完工日,后续按各自原时长顺延(沿链下传)。
 *
 * <p>2026-11-09 校验:改后的完工日若**早于本道开工日**,先把本道开工日降到完工日
 * (开工不得晚于完工 —— 用户报障「开工 11-09 / 完工 11-03」就是漏了这一步),再往下传链。
 *
 * @param {Array<object>} rows 工序行(就地修改)
 * @param {number} index 改了哪一道
 * @param {string} value 新的计划完工日期(YYYY-MM-DD;空 ⇒ 不动)
 * @returns {string|null} 被自动调平的开工日(没调平 ⇒ null,调用方据此提示)
 */
export function cascadeDue(rows, index, value) {
  const list = rows || []
  const r = list[index]
  if (!r || !value) return null
  const due = ymd(value)
  const start = ymd(r['计划开工日期'])
  let fixedStart = null
  if (start && due && start > due) {          // 本道日期倒挂 ⇒ 开工跟到完工日
    r['计划开工日期'] = due
    fixedStart = due
  }
  const next = list[index + 1]
  if (!next) return fixedStart
  const dur = durationOf(next)
  next['计划开工日期'] = due
  next['计划完工日期'] = addDays(due, dur)
  cascadeDue(list, index + 1, next['计划完工日期'])
  return fixedStart
}

/**
 * 改某道的**计划开工日期**:开工晚于本道完工 ⇒ 完工拉到开工日,并继续沿链下传
 * (避免提交时「开工晚于完工」被后端拒)。
 *
 * @param {Array<object>} rows 工序行(就地修改)
 * @param {number} index 改了哪一道
 * @param {string} value 新的计划开工日期(YYYY-MM-DD;空 ⇒ 不动)
 * @returns {string|null} 被自动顺延的完工日(没动 ⇒ null,调用方据此提示)
 */
export function cascadeStart(rows, index, value) {
  const r = (rows || [])[index]
  if (!r) return null
  const start = ymd(value)
  if (!start) return null
  const due = ymd(r['计划完工日期'])
  if (!due || start <= due) return null
  r['计划完工日期'] = start
  cascadeDue(rows, index, start)
  return start
}

/**
 * 打开弹窗时把计划链**规整成一条**:上一道的计划完工日 = 下一道的计划开工日。
 *
 * <p>2026-10-29 用户报障(工序路线排线截图):台账里各道日期是历史各次排产留下的,
 * 打开时出现「成型 10-29~10-31,切炭却 10-08~10-15,装箱 10-30~10-29(开工晚于完工)」——
 * 计划链没有真正生效。这里在加载后统一收口:第 2 道起开工日=上一道完工日,
 * **保留该道原来的计划时长**整体顺延;首道缺开工日给今天。
 *
 * @param {Array<object>} rows 工序行(就地修改)
 * @param {string} [today] 首道缺开工日时用的「今天」(测试可注入)
 */
export function normalizePlanChain(rows, today = todayStr()) {
  const list = rows || []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    if (i > 0) {
      const prev = list[i - 1]
      const prevDue = ymd(prev['计划完工日期'])
      if (prevDue) {
        const dur = durationOf(r)
        r['计划开工日期'] = prevDue
        r['计划完工日期'] = addDays(r['计划开工日期'], dur)
      }
    }
    r['计划开工日期'] = ymd(r['计划开工日期']) || today
    r['计划完工日期'] = ymd(r['计划完工日期']) || r['计划开工日期']
    if (r['计划完工日期'] < r['计划开工日期']) r['计划完工日期'] = r['计划开工日期']
  }
  return list
}
