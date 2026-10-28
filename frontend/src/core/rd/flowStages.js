/**
 * flowStages.js — 研发「项目流程管控」的环节判定(纯函数,单测钉边界)。
 *
 * 【它做什么】把 PxController#rdFlow 取回的一条项目事实(立项申请表 / 两处单据状态 /
 * 实施计划 / 进度查询行 / 审批留痕)翻译成 **10 步流程** + 「当前卡在哪一步、该谁动手、停留几天」。
 *
 * 【为什么在前端】判定规则全是"字段空不空 + 留痕取哪一条"的纯逻辑,放在这里可以用 node:test
 * 把 12 种真实边界逐条钉住(草稿/待审批/已审未定级/未分发/未确认责任人/未确认收到/计划未建/
 * 计划未填/已填未提交/待审批/已归档未同步/全部完成);后端只负责取数,不重复一份口径。
 *
 * 【数据契约】入参形状即 /api/px/rdFlow 的 projects[i](字段中文键已由后端转驼峰):
 *   { approvalNo, approvalDocNo, projectName, customer, spec, initiator, createdBy, createdAt, updatedAt,
 *     level, liaison, owner, ownerAck, ownerAckAt,
 *     approvalStatus:{pending,pendingBy,pendingAt,shr,shsj,archived,archivedAt,canceled,modifyState},
 *     plans:[{no,docNo,projectName,level,owner,createdAt,updatedAt,createdBy,plannedStages,doneStages,status:{…}}],
 *     progressRows:[string], trail:[{panel,action,result,operator,at,opinion}] }
 *
 * 【真源口径】(2026-10-20 两账套实测,与 ButtonService 的门禁逐条对齐)
 *   · 关联键:rd_plan.文档编号 = rd_approval.单据编号(新口径,责任人确认收到即自动建单);
 *   · 审批/归档 = yj_doc_status;动作时间/操作人 = yj_form_approval 留痕;
 *   · 定级分发 = rd_approval.项目等级 + 备用1(对接人);确认责任人 = 备用2;确认收到 = 备用3/备用4;
 *   · 进进度查询 = rd_progress_detail.[说明] 有该立项单号的行。
 */

/** 固定 10 步(顺序即业务链顺序,前端时间轴直接用它) */
export const STAGES = [
  { key: 'applyFill', name: '立项申请填写' },
  { key: 'applySubmit', name: '立项申请提交审批' },
  { key: 'applyApprove', name: '立项申请审批通过' },
  { key: 'gradeDispatch', name: '定级分发（等级 + 对接人）' },
  { key: 'confirmOwner', name: '确认项目责任人' },
  { key: 'ownerAck', name: '责任人确认收到' },
  { key: 'planFill', name: '填写项目实施计划' },
  { key: 'planSubmit', name: '实施计划提交审批' },
  { key: 'planArchive', name: '实施计划审批通过并归档' },
  { key: 'progressSync', name: '进入项目进度查询' },
]

const s = (v) => (v === null || v === undefined ? '' : String(v).trim())

/** 'YYYY-MM-DD HH:mm:ss'(库里的 CONVERT 120)→ 毫秒;空/非法 → 0 */
function ms(v) {
  const t = s(v)
  if (!t) return 0
  const d = new Date(t.replace(' ', 'T'))
  const n = d.getTime()
  return Number.isNaN(n) ? 0 : n
}

/** 账号 → 「姓名（账号）」;没姓名就只给账号 */
function person(account, names) {
  const a = s(account)
  if (!a) return ''
  const n = s(names[a])
  return n && n !== a ? `${n}（${a}）` : a
}

/** 账号 → 姓名(没有姓名就退回账号);待办人栏用它,账号另给 account 供链接/查人 */
function plainName(account, names) {
  const a = s(account)
  if (!a) return ''
  return s(names[a]) || a
}

/** 取某面板某动作的**最后一条**留痕 */
function lastTrail(trail, panel, action) {
  let hit = null
  for (const r of trail || []) {
    if (s(r.panel) !== panel) continue
    if (s(r.action).toUpperCase() !== action.toUpperCase()) continue
    hit = r
  }
  return hit
}

/** 任一动作的最后一条(用于定级分发这种"新旧按钮并存"的步骤) */
function lastTrailAny(trail, panel, actions) {
  let hit = null
  for (const r of trail || []) {
    if (s(r.panel) !== panel) continue
    const a = s(r.action).toUpperCase()
    if (!actions.includes(a)) continue
    hit = r
  }
  return hit
}

/**
 * 一条项目的流程判定。
 *
 * @param {object} p       /api/px/rdFlow 的 projects[i]
 * @param {object} names   账号 → 姓名(后端 names 字段)
 * @param {string} now     当前时刻 'YYYY-MM-DD HH:mm:ss'(传参便于单测)
 * @returns {{steps:Array, currentKey:string, currentName:string, doneCount:number, total:number,
 *            pendingWith:{account:string,name:string}, stuckDays:number, lastActionAt:string,
 *            headline:string, canceled:boolean, planNo:string}}
 */
export function buildFlow(p, names = {}, now = '') {
  const ap = p || {}
  const st = ap.approvalStatus || {}
  const trail = ap.trail || []
  const plans = ap.plans || []
  const plan = plans.length ? plans[plans.length - 1] : null
  const planSt = (plan && plan.status) || {}
  const progressRows = ap.progressRows || []
  const canceled = s(st.canceled) === 'Y'
  const archivedOrApproved = s(st.archived) === 'Y' || !!s(st.shr)

  const steps = new Map()
  const put = (key, done, { at = '', actor = '', detail = '', warn = false } = {}) => {
    steps.set(key, { key, name: STAGES.find((x) => x.key === key).name, done: !!done, at: s(at), actor: s(actor), detail, warn })
  }

  // ① 立项申请填写:有这张单就算(它存在才查得到)
  put('applyFill', !!s(ap.approvalNo), {
    at: ap.createdAt,
    actor: person(ap.createdBy, names),
    detail: [s(ap.customer) && `客户：${s(ap.customer)}`, s(ap.projectName) && `机型：${s(ap.projectName)}`]
      .filter(Boolean).join(' / '),
  })

  // ② 提交审批:留痕 SUBMIT 优先,其次 pending='Y' / 已审批(老单没留痕)
  const apSubmit = lastTrail(trail, 'RD_APPROVAL', 'SUBMIT')
  const submitted = !!apSubmit || s(st.pending) === 'Y' || archivedOrApproved
  put('applySubmit', submitted, {
    at: apSubmit ? apSubmit.at : s(st.pendingAt) || s(st.shsj),
    actor: apSubmit ? person(apSubmit.operator, names) : person(st.pendingBy, names),
    detail: submitted ? '' : `待${s(ap.initiator) || person(ap.createdBy, names) || '申请人'}提交审批`,
  })

  // ③ 审批通过
  const apApprove = lastTrail(trail, 'RD_APPROVAL', 'APPROVE')
  put('applyApprove', archivedOrApproved || !!apApprove, {
    at: s(st.shsj) || (apApprove ? apApprove.at : ''),
    actor: person(s(st.shr) || (apApprove ? apApprove.operator : ''), names),
    detail: submitted || archivedOrApproved ? (s(st.shr) ? '' : (apApprove ? '' : '待审批'))
      : '尚未提交审批',
  })

  // ④ 定级分发:项目等级 + 对接人(两个都写了才算;2026-10-19 起是一个按钮)
  const grade = lastTrailAny(trail, 'RD_APPROVAL', ['GRADE_DISPATCH', 'GRADE', 'LIAISON'])
  const graded = !!s(ap.level)
  const dispatched = !!s(ap.liaison)
  put('gradeDispatch', graded && dispatched, {
    at: grade ? grade.at : '',
    actor: grade ? person(grade.operator, names) : '',
    detail: `等级：${graded ? s(ap.level) : '未定级'} / 对接人：${dispatched ? person(ap.liaison, names) : '未分发'}`,
  })

  // ⑤ 确认项目责任人(由对接人签核选人)
  const ownerTrail = lastTrail(trail, 'RD_APPROVAL', 'OWNER')
  put('confirmOwner', !!s(ap.owner), {
    at: ownerTrail ? ownerTrail.at : '',
    actor: ownerTrail ? person(ownerTrail.operator, names) : '',
    detail: s(ap.owner) ? `项目责任人：${person(ap.owner, names)}` : '待对接人确认项目责任人',
  })

  // ⑥ 责任人确认收到(不确认就填不了实施计划,见 ButtonService.ensurePlanOwnerAcked)
  //   口径:备用3/备用4 是"确认收到"的正规落点;历史上也有只写了 OWNER_ACK 留痕没写备用3 的单
  //   (实测 HSDZ_MES LXA-2026-10-0011),留痕在就当已确认 —— 否则会出现"后面的计划都填完了,
  //   这一步还显示没做"的假卡单。
  const ackTrail = lastTrail(trail, 'RD_APPROVAL', 'OWNER_ACK')
  const acked = !!s(ap.ownerAck) || !!ackTrail
  put('ownerAck', acked, {
    at: s(ap.ownerAckAt) || (ackTrail ? ackTrail.at : ''),
    actor: person(ackTrail ? ackTrail.operator : s(ap.ownerAck), names),
    detail: acked ? `确认收到：${person(s(ap.ownerAck) || (ackTrail ? ackTrail.operator : ''), names)}` : '待项目责任人确认收到',
  })

  // ⑦ 填写项目实施计划:建单 ≠ 填完,阶段内容一个都没填仍算"没开始填"
  const planned = plan ? Number(plan.plannedStages || 0) : 0
  const planNo = plan ? s(plan.no) : ''
  // 老单据兜底(2026-10-20 用户问「旧单据会不会查不到」):实施计划的『文档编号』若是手填/留空,
  // 单据编号就对不上立项单号 ⇒ 这里列出「项目名称相同」的候选计划,让用户知道单子其实存在、只是没关联。
  const candidates = plan ? [] : (ap.planCandidates || [])
  const candidateText = candidates.length
    ? candidates.slice(0, 3).map((c) => `${s(c.no)}${s(c.docNo) ? `（文档编号 ${s(c.docNo)}）` : '（文档编号空）'}`).join('、')
    : ''
  put('planFill', !!plan && planned > 0, {
    at: plan ? plan.updatedAt : '',
    actor: plan ? person(plan.createdBy, names) : '',
    detail: !plan
      ? (candidateText
        ? `未按『文档编号』关联到立项单号；疑似计划 ${candidateText} —— 请到实施计划把『文档编号』填成 ${s(ap.approvalNo)}`
        : '责任人确认收到后系统自动建计划草稿；尚未建单')
      : planned > 0
        ? `计划 ${planNo}：已填 ${planned} 个阶段${Number(plan.doneStages || 0) > 0 ? `（已完成 ${plan.doneStages}）` : ''}`
        : `计划 ${planNo} 已建单，阶段内容还没填`,
  })

  // ⑧ 提交审批(计划)
  const planSubmit = lastTrail(trail, 'RD_PLAN', 'SUBMIT')
  const planSubmitted = !!planSubmit || s(planSt.pending) === 'Y' || !!s(planSt.shr) || s(planSt.archived) === 'Y'
  put('planSubmit', !!(plan && planned > 0 && planSubmitted), {
    at: planSubmit ? planSubmit.at : s(planSt.pendingAt) || s(planSt.shsj),
    actor: planSubmit ? person(planSubmit.operator, names) : person(planSt.pendingBy, names),
    detail: s(planSt.pending) === 'Y' ? `提交人：${person(planSt.pendingBy, names) || '-'}，待审批`
      : planned > 0 ? (planSubmitted ? '' : '阶段已填，待提交审批') : '',
  })

  // ⑨ 审批通过并归档(RD_PLAN 属归档面板:审批通过即归档)
  const planArchived = !!plan && (s(planSt.archived) === 'Y' || !!s(planSt.shr))
  put('planArchive', planArchived, {
    at: s(planSt.archivedAt) || s(planSt.shsj),
    actor: person(planSt.shr, names),
    detail: planArchived ? '' : (s(planSt.pending) === 'Y' ? '待审批通过后归档' : ''),
  })

  // ⑩ 进项目进度查询(RD_PLAN 归档时自动同步;没同步上就是管理员点「同步进度」)
  put('progressSync', progressRows.length > 0, {
    at: '',
    detail: progressRows.length ? `进度单：${progressRows[0]}` : (planArchived ? '已归档但未同步进度（管理员点「同步进度」）' : '尚未同步进度'),
  })

  // ── 状态机收口 ──
  const ordered = STAGES.map((x) => steps.get(x.key))
  let currentKey = ''
  for (const it of ordered) if (!it.done) { currentKey = it.key; break }
  const doneCount = ordered.filter((x) => x.done).length
  const total = ordered.length
  let activeSeen = false
  for (const it of ordered) {
    if (it.done) it.state = 'done'
    else if (!activeSeen) { it.state = 'active'; activeSeen = true }
    else it.state = 'todo'
  }

  // 乱序守卫(实测数据会这样):当前环节没落库,但后面的环节已经做完了
  // (例:HSDZ_MES LXA-2026-10-0011 计划已归档进进度查询,立项上「责任人确认收到」却空着)
  // ⇒ 标 warn 并在 detail 里点明,避免用户以为"流程还没走到这"而重复操作。
  const activeIdx = ordered.findIndex((x) => x.state === 'active')
  if (activeIdx >= 0 && ordered.slice(activeIdx + 1).some((x) => x.done)) {
    const it = ordered[activeIdx]
    it.warn = true
    it.detail = `${it.detail ? it.detail + '；' : ''}后序环节已完成，此处状态未落库`
  }

  // 停留天数 = 现在 - 最后一次动作时间(已完成的项目不算卡住)
  let lastMs = 0
  let lastActionAt = ''
  for (const it of ordered) {
    if (!it.done || !it.at) continue
    const m = ms(it.at)
    if (m > lastMs) { lastMs = m; lastActionAt = it.at }
  }
  const stuckDays = currentKey && lastMs && ms(now) ? Math.max(0, Math.floor((ms(now) - lastMs) / 86400000)) : 0

  // 当前该谁动手
  const cur = s(ap.owner)
  const pendingWith = (() => {
    if (!currentKey) return { account: '', name: '' }
    if (currentKey === 'applySubmit') return { account: s(ap.createdBy), name: s(ap.initiator) || plainName(ap.createdBy, names) || '申请人' }
    if (currentKey === 'applyApprove' || currentKey === 'planArchive') return { account: '', name: '审批人' }
    if (currentKey === 'gradeDispatch') {
      const who = s(st.shr)
      return { account: who, name: plainName(who, names) || '本单审批人' }
    }
    if (currentKey === 'confirmOwner') return { account: s(ap.liaison), name: plainName(ap.liaison, names) || '对接人' }
    if (currentKey === 'progressSync') return { account: '', name: '管理员' }
    return { account: cur, name: plainName(cur, names) || '项目责任人' }
  })()

  const currentName = currentKey ? STAGES.find((x) => x.key === currentKey).name : ''
  let headline
  if (canceled) {
    headline = `已弃审/作废：本单退回「${currentName || '草稿'}」，需重新走流程`
  } else if (!currentKey) {
    headline = `全部完成（${doneCount}/${total}）`
  } else {
    const who = pendingWith.name ? `，待 ${pendingWith.name}` : ''
    headline = `卡在：${currentName}${who}${stuckDays > 0 ? `，已停留 ${stuckDays} 天` : ''}`
  }

  return { steps: ordered, currentKey, currentName, doneCount, total, pendingWith, stuckDays, lastActionAt, headline, canceled, planNo }
}
