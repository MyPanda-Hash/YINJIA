/**
 * 项目阶段进度(纯函数,无 Vue 依赖)。
 * 数据来源:项目实施计划(RD_PLAN)的阶段框字段
 *   阶段N            = 阶段标题(旧版单字段,兜底)
 *   阶段N_计划内容    = 计划内容(有效阶段的判定键)
 *   阶段N_计划开始 / 阶段N_计划完成 / 阶段N_实际完成 / 阶段N_责任人
 * 口径:已完成 = 实际完成非空;逾期 = 未完成且计划完成早于今天(当天不算逾期);空阶段框不计入。
 */

const MAX_STAGE = 10

/** 可翻译的状态词(UI 用 tt() 组句,数字由界面拼) */
export const STATUS_TOKENS = {
  no_plan: '无实施计划',
  none: '无阶段计划',
  not_started: '未开始',
  doing: '进行中',
  done: '全部完成',
  overdue: '逾期',
}

function text(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/** 归一为 YYYY-MM-DD(兼容 2026/9/12 与带时分的值);解析不出返回空串 */
function normDate(value) {
  const raw = text(value)
  if (!raw) return ''
  const m = raw.replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return ''
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
}

function isOverdue(stage, today) {
  if (stage.actual) return false
  const due = normDate(stage.due)
  const now = normDate(today)
  if (!due || !now) return false
  return due < now
}

/**
 * 抽取有效阶段(计划内容或旧版阶段标题非空),按阶段号升序。
 * @param {Object} planHead 实施计划单据表头
 */
export function pickStages(planHead) {
  if (!planHead) return []
  const out = []
  for (let no = 1; no <= MAX_STAGE; no += 1) {
    const content = text(planHead[`阶段${no}_计划内容`]) || text(planHead[`阶段${no}`])
    if (!content) continue
    out.push({
      no,
      content,
      start: text(planHead[`阶段${no}_计划开始`]),
      due: text(planHead[`阶段${no}_计划完成`]),
      actual: text(planHead[`阶段${no}_实际完成`]),
      owner: text(planHead[`阶段${no}_责任人`]),
    })
  }
  return out
}

/** 阶段框内 5 个字段(与实施计划纸面阶段框一一对应) */
export const PHASE_FIELDS = ['计划内容', '计划开始', '计划完成', '实际完成', '责任人']

/** 阶段框是否填过内容:5 个字段任一非空即为已填;全空则在导出/打印时跳过该框 */
export function hasPhaseContent(head, no) {
  if (!head) return false
  return PHASE_FIELDS.some((field) => text(head[`阶段${no}_${field}`]) !== '')
}

/** 单个阶段的行内状态(弹窗徽标用) */
export function stageRowState(stage, today = '') {
  if (stage && stage.actual) return 'done'
  return isOverdue(stage || {}, today) ? 'overdue' : 'doing'
}

/**
 * 汇总阶段完成情况。
 * @param {Array|null} stages pickStages 的结果;null=没找到实施计划
 * @param {string} today 今天 YYYY-MM-DD
 */
export function summarizeStages(stages, today = '') {
  if (stages === null || stages === undefined) {
    return { state: 'no_plan', total: 0, done: 0, overdue: 0, next: null }
  }
  const list = stages || []
  const total = list.length
  const done = list.filter((s) => !!s.actual).length
  const overdue = list.filter((s) => isOverdue(s, today)).length
  const next = list.find((s) => !s.actual) || null
  let state = 'none'
  if (total > 0) {
    if (done === 0) state = 'not_started'
    else if (done === total) state = 'done'
    else state = 'doing'
  }
  return { state, total, done, overdue, next }
}

/** 状态标签文案(中文原文;UI 展示用 STATUS_TOKENS 逐词 tt() 组句) */
export function statusLabel(summary) {
  if (!summary) return ''
  switch (summary.state) {
    case 'no_plan':
      return STATUS_TOKENS.no_plan
    case 'none':
      return STATUS_TOKENS.none
    case 'not_started':
      return `${STATUS_TOKENS.not_started} 0/${summary.total}`
    case 'done':
      return `${STATUS_TOKENS.done} ${summary.done}/${summary.total}`
    default:
      return summary.overdue > 0
        ? `${STATUS_TOKENS.doing} ${summary.done}/${summary.total} · ${STATUS_TOKENS.overdue} ${summary.overdue}`
        : `${STATUS_TOKENS.doing} ${summary.done}/${summary.total}`
  }
}

/** 状态色:no_plan/none/not_started 灰,doing 蓝,逾期橙,done 绿 */
export function statusTone(summary) {
  if (!summary) return 'none'
  if (summary.state === 'done') return 'done'
  if (summary.state === 'doing') return summary.overdue > 0 ? 'overdue' : 'doing'
  return 'idle'
}

// ---------- 阶段计划日期:次日 + 相邻阶段自动衔接 ----------
// 用途:项目实施计划的阶段框里,计划开始/计划完成改为日期弹窗后,
// 填完某阶段的「计划完成」就把下一阶段的「计划开始」接上次日,避免 10 个阶段逐个手填。
// 实测数据习惯即为如此:阶段1 09-01→09-10,阶段2 09-11→09-25。

/** 次日(YYYY-MM-DD);解析不出返回空串(不写脏数据) */
export function nextDay(value) {
  const day = normDate(value)
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + 1)
  const p = (x) => String(x).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

/**
 * 相邻阶段日期衔接:阶段 n「计划完成」确定后,若阶段 n+1「计划开始」为空则填次日。
 * 规则:**只在下一阶段为空时写入**,不覆盖已填值;本阶段日期为空/非法、或 n 已是最后阶段时不写入。
 * 就地修改 head(与面板其它字段读写方式一致)。
 * @param {Object} head 实施计划单据表头
 * @param {number} n 阶段号
 * @returns {number} 被写入的阶段号;未写入返回 0
 */
export function chainNextStageStart(head, n, total = MAX_STAGE) {
  if (!head || !n || n >= total) return 0
  const start = nextDay(head[`阶段${n}_计划完成`])
  if (!start) return 0
  const nextKey = `阶段${n + 1}_计划开始`
  if (text(head[nextKey])) return 0
  head[nextKey] = start
  return n + 1
}
