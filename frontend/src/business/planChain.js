/**
 * planChain.js — 工序排线的「计划开工/计划完工日期」日期链纯逻辑(2026-10-30)
 *
 * 单行排线弹窗(ProcessRoutePlanDialog)与批量排产弹窗(ScheduleBatchDialog)共用这一份,
 * 避免两处各写一遍日期链(改一处忘一处 ⇒ 批量与单行的计划日期口径不一致)。
 *
 * 🔴 现行口径(2026-11-18 第二轮,用户复核后重定;两张「工单排产」截图):
 *   ① 每道工序的**预计开工日期**按「上一道真的开始做了没有」来定:
 *        · 本道已有已审报工(`实际开工` 有值)⇒ 取**本道实际开工日**;
 *        · 否则上一道已有已审报工 ⇒ 取**上一道实际开工日**(上一道一开始报工,本道就能做流下来的量);
 *        · 否则(上一道还没开工)⇒ 沿用计划链:上一道的预计完工日期;首道缺开工给今天。
 *   ② 每道工序的**预计完工日期** = 排产时**原来选择的日期**,不按上道的完工日、也不按本道
 *      原时长顺延;只有当开工被推到它之后(开工 > 完工)时才后延到开工日(2026-11-09 口径)。
 *   ③ 实际完工日只用于"这道做完了"的判断与展示,**不再改写计划完工**,也不再把下道开工
 *      踩到实际完工日(第一轮那版已按用户复核否掉)。
 *   ⇒ 例(GD-2026-10-0228 行1,2026-11-18):成型 11-18~11-20(实际 11-18 完工)、
 *     切炭 11-18~11-21、组装 11-18~11-24 —— 开工跟实际报工(11-18),完工保持原来选择。
 *
 * 🔴 2026-11-09 用户报障(批量排产截图):两道日期能**倒挂** ——「计划开工 2026-11-09 / 计划完工 11-03」。
 *   根因:cascadeDue 只处理「下一道」,**没有管被改的那一道自己**。现在两条编辑路径都保证
 *   「开工 ≤ 完工」:改完工时若早于本道开工 ⇒ 开工一起调到完工日;改开工时若晚于本道完工
 *   ⇒ 完工拉到开工日;`isPlanDateInverted` / `invertedPlanRows` / `planDateProblems` 供提交前硬校验。
 *
 * 🔴 2026-11-11 用户口径「下方的工序不能比上方的工序小」:
 *   **原实现**是「后道开工 ≥ 前道计划完工」并对客户端给出的日期硬校验;2026-11-18 第二轮改为
 *   「后道开工 = 前道实际开工(或计划完工)」—— 后道开工**可以早于**前道计划完工(前道提前开工、
 *   量已流入),所以本文件与后端 preplanManual 都不再拿「上道计划完工」夹后道日期;
 *   只保留「本道开工 ≤ 本道完工」这一条硬约束(跨道顺序由上面 ① 的事实推导保证)。
 *
 * 🔴 2026-11-18 第一轮(已被第二轮取代):曾把已完工那道自己的计划完工改成实际完工、下道按
 *   原时长顺延 —— 用户复核后否掉"顺延完工",别再改回去。
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

/**
 * 提交前硬校验:只列**本道日期倒挂**(开工晚于本道完工)。
 *
 * <p>2026-11-18 第二轮起不再校验「下道早于上道」:后道开工按前道**实际开工**推导,
 * 允许早于前道计划完工(前道提前开工、量已流入)。
 *
 * @param {Array<object>} rows 工序行(按工序顺序)
 * @returns {Array<{index:number,row:object,prevRow:(object|null),kind:'inverted'}>}
 */
export function planDateProblems(rows) {
  const list = rows || []
  const out = []
  for (let i = 0; i < list.length; i++) {
    const row = list[i]
    if (isPlanDateInverted(row)) {
      out.push({ index: i, row, prevRow: i > 0 ? list[i - 1] : null, kind: 'inverted' })
    }
  }
  return out
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

/**
 * 改某道的**计划完工日期**(2026-11-18 第二轮口径):
 * <ol>
 *   <li>2026-11-09:改后的完工日若**早于本道开工日**,先把本道开工日降到完工日(开工不得晚于完工);</li>
 *   <li>下游**还没开工**(没有已审报工、`实际开工` 为空)的行:开工跟着本道完工走;
 *       它们的完工仍保留原来选择的日期,只在早于新开工时后延 —— **不按原时长顺延**;</li>
 *   <li>下游**已开工**的行不动:开工以已审报工(实际开工)为准。</li>
 * </ol>
 *
 * @param {Array<object>} rows 工序行(就地修改)
 * @param {number} index 改了哪一道
 * @param {string} value 新的计划完工日期(YYYY-MM-DD;空 ⇒ 不动)
 * @returns {{start: (string|null), due: (string|null)}} 被自动调平的字段值(没动 ⇒ null,调用方据此提示)
 */
export function cascadeDue(rows, index, value) {
  const list = rows || []
  const r = list[index]
  const fixed = { start: null, due: null }
  if (!r || !value) return fixed
  const due = ymd(value)
  const start = ymd(r['计划开工日期'])
  if (start && start > due) {                 // 本道日期倒挂 ⇒ 开工跟到完工日
    r['计划开工日期'] = due
    fixed.start = due
  }
  const next = list[index + 1]
  if (!next) return fixed
  if (ymd(next['实际开工'])) return fixed       // 下游已开工 ⇒ 日期以实际报工为准,不跟着改
  next['计划开工日期'] = due
  const nextDue = ymd(next['计划完工日期']) || due
  next['计划完工日期'] = nextDue < due ? due : nextDue
  cascadeDue(list, index + 1, next['计划完工日期'])
  return fixed
}

/**
 * 改某道的**计划开工日期**(2026-11-18 第二轮口径):
 * <ul>
 *   <li>2026-11-09:开工晚于本道完工 ⇒ 完工拉到开工日(不再按原时长顺着把后道整体推走);</li>
 *   <li>本道完工被拉后 ⇒ 按 {@link #cascadeDue} 只推动**未开工**的下游开工;</li>
 *   <li>不再按「上道计划完工」夹本道开工:后道提前开工是允许的(量已流入)。</li>
 * </ul>
 *
 * @param {Array<object>} rows 工序行(就地修改)
 * @param {number} index 改了哪一道
 * @param {string} value 新的计划开工日期(YYYY-MM-DD;空 ⇒ 不动)
 * @returns {{start: (string|null), due: (string|null)}} 被自动调平的字段值(没动 ⇒ null,调用方据此提示)
 */
export function cascadeStart(rows, index, value) {
  const list = rows || []
  const r = list[index]
  const fixed = { start: null, due: null }
  if (!r) return fixed
  const start = ymd(value)
  if (!start) return fixed
  const due = ymd(r['计划完工日期'])
  if (due && start > due) {                   // 开工晚于本道完工 ⇒ 完工拉到开工,并推动未开工的下游
    r['计划完工日期'] = start
    fixed.due = start
    cascadeDue(list, index, start)
  }
  return fixed
}

/**
 * 打开弹窗时把每道工序的**预计开工日期**按事实/计划链收口(2026-11-18 第二轮,见文件头 ① ②):
 * <pre>
 *   本道实际开工(已审报工最早时间)有值      ⇒ 开工 = 本道实际开工日
 *   否则上一道实际开工有值                   ⇒ 开工 = 上一道实际开工日
 *   否则第 2 道起                            ⇒ 开工 = 上一道预计完工日(原计划链)
 *   首道/上面都取不到                        ⇒ 开工 = 本道原开工 || 今天
 *   预计完工 = 本道原选择的日期;仅当开工 > 完工时才后延到开工日
 * </pre>
 *
 * <p>2026-10-29 的老口径「上一道计划完工 = 下一道计划开工」只在**上游还没开工**时才成立;
 * 上游一开始报工,下道开工就跟着实际开工走(用户 2026-11-18 口径「按照前一个的实际开工后
 * 存在的报工数给到这一个流程里的预计开工日期,而工序的预计完工日期还是原来选择的日期」)。
 *
 * @param {Array<object>} rows 工序行(就地修改;数据键中文,日期串可能带时分)
 * @param {string} [today] 首道缺开工日时用的「今天」(测试可注入)
 */
export function normalizePlanChain(rows, today = todayStr()) {
  const list = rows || []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    const ownStart = ymd(r['计划开工日期'])
    const actualStart = ymd(r['实际开工'])          // 本道已审报工的最早时间(库里带时分)
    let start = ''
    if (actualStart) {
      start = actualStart
    } else if (i > 0) {
      const prev = list[i - 1]
      start = ymd(prev['实际开工']) || ymd(prev['计划完工日期']) || ownStart
    } else {
      start = ownStart
    }
    if (!start) start = today
    // 预计完工 = 排产时**原来选择的日期**(不再按上道/时长顺延);倒挂时才后延
    let due = ymd(r['计划完工日期']) || start
    if (due < start) due = start
    r['计划开工日期'] = start
    r['计划完工日期'] = due
  }
  return list
}
