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
 * 数据键中文(与 routeSteps / preplanManual 的 步骤 一致),日期串统一 `YYYY-MM-DD`。
 */

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
  return Math.max(0, daysBetween(row['计划开工日期'], row['计划完工日期']))
}

/**
 * 改某道的**计划完工日期**:下一道开工日 = 本道完工日,后续按各自原时长顺延(沿链下传)。
 * @param {Array<object>} rows 工序行(就地修改)
 * @param {number} index 改了哪一道
 * @param {string} value 新的计划完工日期(YYYY-MM-DD;空 ⇒ 不动)
 */
export function cascadeDue(rows, index, value) {
  const next = (rows || [])[index + 1]
  if (!next || !value) return
  const dur = durationOf(next)
  next['计划开工日期'] = value
  next['计划完工日期'] = addDays(value, dur)
  cascadeDue(rows, index + 1, next['计划完工日期'])
}

/**
 * 改某道的**计划开工日期**:开工晚于本道完工 ⇒ 完工拉到开工日,并继续沿链下传
 * (避免提交时「开工晚于完工」被后端拒)。
 */
export function cascadeStart(rows, index, value) {
  const r = (rows || [])[index]
  if (!r) return
  if (value && r['计划完工日期'] && value > r['计划完工日期']) {
    r['计划完工日期'] = value
    cascadeDue(rows, index, value)
  }
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
      if (prev['计划完工日期']) {
        const dur = durationOf(r)
        r['计划开工日期'] = prev['计划完工日期']
        r['计划完工日期'] = addDays(r['计划开工日期'], dur)
      }
    }
    if (!r['计划开工日期']) r['计划开工日期'] = today
    if (!r['计划完工日期']) r['计划完工日期'] = r['计划开工日期']
    if (r['计划完工日期'] < r['计划开工日期']) r['计划完工日期'] = r['计划开工日期']
  }
  return list
}
