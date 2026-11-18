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
 * 🔴 2026-11-11 用户口径(工序路线排线截图:成型 11-11~11-13,切炭/组装却 11-01~11-01):
 *   「校验需要增加实现下方的工序页不能比上方的工序小的实现」——
 *   即**后道工序的日期不得早于前道工序**:后道开工 ≥ 前道完工(后道完工随之 ≥ 前道完工)。
 *   根因:改日期的级联只往**下**传(上道改了下道跟着动),改**下道**自己的日期时没人管它跟
 *   上道的关系 ⇒ 手工把切炭开工改成 11-01 也照收。现在:
 *     · 改开工:cascadeStart 先按「≥ 上道完工」夹一道,再管本道开工≤完工;
 *     · 改完工:cascadeDue 先按「≥ 上道完工」夹一道,再把本道开工拉到完工以内;
 *     · 提交前 planDateProblems 把「本道倒挂」和「下道早于上道」两类一起拦下;
 *     · 后端 preplanManual 对客户端明确给出却早于上道完工的日期直接 400。
 *
 * 🔴 2026-11-18 实际完工优先(用户口径 + 「工序路线排线」两张截图):
 *   某道工序**已实际完工**、且「实际完工日期 ≠ 计划完工日期」时,计划链必须踩**实际**完工日,
 *   否则下一道的计划开工日会被排到一个还没到/已经错位的日子上:
 *     · 下一道「计划开工日期」= 上一道(**实际完工日** || 计划完工日);
 *     · 下一道「计划完工日期」= 新开工日 + **该道自己的原计划时长**(原完工 − 原开工)顺延,
 *       不能退化成「和上一道完工日同一天」(工时会凭空归零 ⇒ 后道全挤在一天);
 *     · **已实际完工那道自己的「计划完工日期」也要改成实际完工日** —— 三个原因:
 *       ① 链一致性:不变式「上一道计划完工 = 下一道计划开工」只有改了它才真的成立;
 *       ② 保存时按这一列回填 wo_process_line 台账,后端 preplanManual 有「下道开工不得早于
 *          上道完工」的硬校验 —— 不改这边,下道(踩实际完工)就会早于台账里的上道计划完工 ⇒ 直接 400;
 *       ③ 计划与实际分离展示(实际完工另有一列只读),计划列踩实际值才与真实进度同源。
 *     · 实际完工串形如 `2026-11-18 11:49`,只取前 10 位日期(`ymd`)。
 *   没有实际完工的行(该列空/缺)行为与 2026-11-11 那版**逐字一致**:
 *   第 2 道起开工 = 上一道计划完工、保留本道原时长;首道缺开工给今天;开工 ≤ 完工。
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

/** 上一道工序的计划完工日(第一道/空链 ⇒ '') */
function prevDueOf(rows, index) {
  const prev = index > 0 ? (rows || [])[index - 1] : null
  return prev ? ymd(prev['计划完工日期']) : ''
}

/**
 * 提交前硬校验:一次列出**两类**问题(2026-11-11 起)。
 * <ul>
 *   <li>{@code kind:'inverted'} 本道日期倒挂(开工晚于本道完工);</li>
 *   <li>{@code kind:'order'} **下道工序早于上道工序**(后道开工早于前道完工)——
 *       用户口径「下方的工序页不能比上方的工序小」。</li>
 * </ul>
 * @param {Array<object>} rows 工序行(按工序顺序)
 * @returns {Array<{index:number,row:object,prevRow:(object|null),kind:string,prevDue?:string}>}
 */
export function planDateProblems(rows) {
  const list = rows || []
  const out = []
  for (let i = 0; i < list.length; i++) {
    const row = list[i]
    const prevRow = i > 0 ? list[i - 1] : null
    if (isPlanDateInverted(row)) out.push({ index: i, row, prevRow, kind: 'inverted' })
    if (prevRow) {
      const prevDue = ymd(prevRow['计划完工日期'])
      const start = ymd(row['计划开工日期'])
      if (prevDue && start && start < prevDue) {
        out.push({ index: i, row, prevRow, kind: 'order', prevDue })
      }
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
 * <p>2026-11-11 校验:改后的完工日若**早于上道工序的完工日**,先夹到上道完工日
 * (用户口径「下方的工序不能比上方的工序小」)。
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
  let due = ymd(value)
  const prevDue = prevDueOf(list, index)
  if (prevDue && due && due < prevDue) {      // 下道完工不得早于上道完工 ⇒ 夹到上道完工日
    due = prevDue
    r['计划完工日期'] = due
    fixed.due = due
  }
  const start = ymd(r['计划开工日期'])
  if (start && due && start > due) {          // 本道日期倒挂 ⇒ 开工跟到完工日
    r['计划开工日期'] = due
    fixed.start = due
  }
  const next = list[index + 1]
  if (!next) return fixed
  const dur = durationOf(next)
  next['计划开工日期'] = due
  next['计划完工日期'] = addDays(due, dur)
  cascadeDue(list, index + 1, next['计划完工日期'])
  return fixed
}

/**
 * 改某道的**计划开工日期**:
 * <ul>
 *   <li>2026-11-11:早于**上道工序的完工日** ⇒ 先夹到上道完工日
 *       (用户口径「下方的工序不能比上方的工序小」);</li>
 *   <li>2026-11-09:开工晚于本道完工 ⇒ 完工拉到开工日,并继续沿链下传
 *       (避免提交时「开工晚于完工」被后端拒)。</li>
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
  let start = ymd(value)
  if (!start) return fixed
  const prevDue = prevDueOf(list, index)
  if (prevDue && start < prevDue) {           // 下道开工不得早于上道完工
    start = prevDue
    r['计划开工日期'] = start
    fixed.start = start
  }
  const due = ymd(r['计划完工日期'])
  if (due && start > due) {                   // 开工晚于本道完工 ⇒ 完工顺延并下传
    r['计划完工日期'] = start
    fixed.due = start
    cascadeDue(list, index, start)
  }
  return fixed
}

/**
 * 打开弹窗时把计划链**规整成一条**:上一道的计划完工日 = 下一道的计划开工日。
 *
 * <p>2026-10-29 用户报障(工序路线排线截图):台账里各道日期是历史各次排产留下的,
 * 打开时出现「成型 10-29~10-31,切炭却 10-08~10-15,装箱 10-30~10-29(开工晚于完工)」——
 * 计划链没有真正生效。这里在加载后统一收口:第 2 道起开工日=上一道完工日,
 * **保留该道原来的计划时长**整体顺延;首道缺开工日给今天。
 *
 * <p>2026-11-18 用户口径(实际完工优先):某道**已实际完工**时,它的计划完工日取**实际完工日**
 * (只取日期前 10 位),下一道的计划开工日因此也取该实际完工日,下一道自己的完工日按
 * **本道原计划时长**顺延。理由:链一致性 + 保存回填 wo_process_line 台账 + 后端 preplanManual
 * 的「下道开工不得早于上道完工」硬校验。没有实际完工的行行为不变。详见文件头注释。
 *
 * <p>顺序很重要:每行只改一次,`durationOf` 必须在改本行日期**之前**取(否则原时长会被
 * 已改写的开工/完工日算成 0,后道全被压平到同一天)。
 *
 * @param {Array<object>} rows 工序行(就地修改)
 * @param {string} [today] 首道缺开工日时用的「今天」(测试可注入)
 */
export function normalizePlanChain(rows, today = todayStr()) {
  const list = rows || []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    const dur = durationOf(r)              // 本行**原**计划时长(改日期之前取,2026-11-18)
    const actualDue = ymd(r['实际完工'])    // 实际完工日(库里带时分,只取日期)
    if (i > 0) {
      const prev = list[i - 1]
      // 上一道已实际完工 ⇒ 锚点换成**实际**完工日;否则仍是计划完工日(2026-11-18)
      const prevDue = ymd(prev['实际完工']) || ymd(prev['计划完工日期'])
      if (prevDue) r['计划开工日期'] = prevDue
      r['计划开工日期'] = ymd(r['计划开工日期']) || today
      if (actualDue) {
        r['计划完工日期'] = actualDue     // 已完工 ⇒ 计划完工踩实际完工日
        // 实际完工早于排出来的开工日 ⇒ 开工让到实际完工日(否则本行日期倒挂、提交被拦)
        if (r['计划完工日期'] < r['计划开工日期']) r['计划开工日期'] = actualDue
      } else {
        r['计划完工日期'] = addDays(r['计划开工日期'], dur)   // 原时长整体顺延
      }
    } else {
      r['计划开工日期'] = ymd(r['计划开工日期']) || today
      if (actualDue) {
        r['计划完工日期'] = actualDue
        // 首道没有台账/开工日残缺时(实测空计划 + 实际完工在过去),开工会留在 today ⇒ 与完工倒挂;
        // 实际完工意味着"已经做完了",开工不可能晚于完工日 ⇒ 开工一并让到实际完工日。
        if (r['计划开工日期'] > actualDue) r['计划开工日期'] = actualDue
      } else {
        r['计划完工日期'] = ymd(r['计划完工日期']) || r['计划开工日期']
        if (r['计划完工日期'] < r['计划开工日期']) r['计划完工日期'] = r['计划开工日期']
      }
    }
  }
  return list
}
