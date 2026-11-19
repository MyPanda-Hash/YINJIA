/**
 * productFlow.js —— 产品文件流程（产品信息表 + 4 张受控文件）的纯口径  2026-11-11
 *
 * 【用户口径】
 *   「再用设计库设计一个和项目流程管控面板一样的流程查看功能的面板去专门查看产品文件的流程管控，
 *     就是和产品信息表以及下面 4 个面板对应的流程」
 *
 * 【数据来源，不另立口径】
 *   GET /px/rdDevOverview 的 `products`（与「产品文件列表 · 流程全览」「项目进度查询 · 开发产品」
 *   同一份事实）：每行 = 一个产品，含
 *     · 产品信息表那一步：`单据编号` / `state`
 *     · `nodes`：4 张文件（规格书 / 烧结工艺清单 / 组装工艺清单 / 出货检验计划表），
 *       每个节点 {panel,label,docNo,state,done,reaudited}
 *     · `doneCount` / `allDone`
 *   本模块只做**判定与分组**（KPI、步骤态、下一步），不发请求、不碰 Vue，便于单测。
 */

/** 步骤态三档（与 ProjectFlow 的时间轴同一套语义，便于两个页面看起来是一家的） */
export const STEP_STATE = { done: 'done', doing: 'doing', none: 'none' }

/** 单个文件节点的步骤态：已完成 > 已建单未完成 > 未开始 */
export function stepStateOf(node) {
  if (!node) return STEP_STATE.none
  if (node.done) return STEP_STATE.done
  const state = String(node.state ?? '').trim()
  if (!state || state === '未开始' || state === '未开发') return STEP_STATE.none
  return STEP_STATE.doing
}

/**
 * 一个产品的 5 步（产品信息表 + 4 张文件）。
 *
 * <p>2026-11-20 用户口径：**步骤行不显示单据编号，显示这一行所属产品的「产品编号」**。
 * 单据编号只保留在多单据清单里（那是用来区分同类多张单的，必需）。</p>
 *
 * @param {Record<string, any>|null} row /px/rdDevOverview 的一行
 * @returns {Array<{key: string, label: string, productCode: string, docNo: string, actor: string,
 *   at: string, state: string, tone: string, docs: Array, reaudited: boolean}>}
 */
export function flowStepsOf(row) {
  if (!row) return []
  const nodes = Array.isArray(row.nodes) ? row.nodes : []
  // 产品编号 = 这一行所属产品的业务编号（如 A-54-08），**不是**单据编号（PI-…）。
  // 每一步都带上：步骤行改渲染它（2026-11-20），多单据清单每行也要它。
  const productCode = String(row['产品编号'] || '')
  // 同类多张单：后端 node.docs=[{no,state,done,at,actor}]，逐项透传并补产品编号。
  const docsOf = (list) => (Array.isArray(list) ? list.map((d) => ({
    no: String(d.no || ''),
    state: String(d.state || ''),
    at: String(d.at || ''),
    actor: String(d.actor || ''),
    productCode,
  })) : [])
  const head = {
    key: 'RD_PROD_INFO',
    label: '产品信息表',
    productCode,
    docNo: String(row['单据编号'] || ''),
    // 处理人（2026-11-11 用户口径）：产品信息表 = **填写并提交审批的人**；
    // 规格书 = 产品信息表的二级负责人；成型/组装/出货 = 签核后分发给该文件的负责人。
    // ⚠ 2026-11-17 用户口径「去掉处理人，只留单号 + 状态 + 日期」⇒ 界面不再显示 owner。
    //   字段保留：后端仍在算（别的视图/导出会用到），只是本页不渲染。
    owner: String(row['填写人'] || ''),
    // 最后操作时间（2026-11-17 用户口径「每个都显示处理的日期」）：后端 yyyy-MM-dd HH:mm，
    // 取不到就是空串 ⇒ 界面显示「—」，不编造。
    at: String(row.at || ''),
    // 2026-11-19 销售问题汇总 P14：每个步骤显示填写人。
    // 2026-11-20：row.actor 缺失时回落「填写人」—— 后端老版本没有 actor 也不至于整行空白；
    //   后端新版本 actor 已解析成姓名，优先用它。
    actor: String(row.actor || row['填写人'] || ''),
    // 2026-11-19：同类多张数据记录表（同一项目编号反复测试）——全部单号列在这里
    docs: docsOf(row.docs),
    state: String(row.state || ''),
    tone: String(row.state || '') === '已归档' ? STEP_STATE.done
      : (String(row.state || '').trim() && String(row.state) !== '草稿' ? STEP_STATE.doing : STEP_STATE.none),
    reaudited: !!row.reaudited,
  }
  return [head, ...nodes.map((n) => ({
    key: String(n.panel || n.label || ''),
    label: String(n.label || n.panel || ''),
    productCode,
    docNo: String(n.docNo || ''),
    owner: String(n.owner || ''),
    at: String(n.at || ''),
    // 2026-11-19 P14 后端 nodeOf 已下发 actor，但这里上一轮只给产品信息表那步映射了 actor
    //   ⇒ 4 张文件的填写人永远传不到页面（2026-11-20 生产实测：接口有 actor、页面没有）。
    actor: String(n.actor || ''),
    // 同类多张数据记录表：同样上一轮漏映射 ⇒「· N 张」永远不出现。这里一并透传。
    docs: docsOf(n.docs),
    state: String(n.state || ''),
    tone: stepStateOf(n),
    reaudited: !!n.reaudited,
  }))]
}

/**
 * 「下一步该做哪一步」：第一个没完成的步骤；全完成给 null。
 * （给"卡在哪"一句话用，不猜负责人 —— 本次数据里没有逐节点的处理人。）
 */
export function nextStepOf(steps) {
  const list = Array.isArray(steps) ? steps : []
  return list.find((s) => s.tone !== STEP_STATE.done) || null
}

/**
 * KPI 汇总。口径：
 *   · total  = 产品数（有产品编号的行）
 *   · done   = 5 步全完成（后端 allDone，缺省时按 doneCount===nodes.length 兜底）
 *   · doing  = 已开工未完成（至少一步有单号/状态）
 *   · none   = 一步都没开工
 * @param {Array<Record<string, any>>|null} rows
 */
/**
 * 整包状态（done / doing / none）—— **只看 4 张文件**，不把产品信息表算进"开工"。
 *
 * 为什么排除产品信息表：它是这 4 张文件的**来源单据**（先有它才能下发），
 * 归档只说明"已经允许开发"，不等于"某份文件开始做了"。把它算进开工，
 * 就会出现"产品信息表已归档 + 4 份文件一份没起"被标成「进行中」的误读。
 *
 * @returns {'done'|'doing'|'none'} 4 张全完成 / 至少一张开工 / 一张都没开工
 */
export function flowStatusOf(row) {
  const files = flowStepsOf(row).slice(1)
  if (!files.length) return STEP_STATE.none
  if (files.every((s) => s.tone === STEP_STATE.done)) return STEP_STATE.done
  return files.some((s) => s.tone !== STEP_STATE.none) ? STEP_STATE.doing : STEP_STATE.none
}

export function flowKpisOf(rows) {
  // ⚠ 2026-11-17:「产品数」的口径必须与列表**同一份行**——两者都只要求"单据编号或产品编号有一个"
  //   (新建的产品信息表还没填产品编号)。此前这里单看产品编号 ⇒ 列表 3 行、KPI 写 2 的产品数矛盾。
  const list = (Array.isArray(rows) ? rows : []).filter((r) => String(r?.['产品编号'] || '').trim() !== ''
    || String(r?.['单据编号'] || '').trim() !== '')
  let done = 0
  let doing = 0
  let none = 0
  for (const r of list) {
    // 与表格里那枚状态 chip 用**同一个函数**（flowStatusOf）：否则会出现行上写「进行中」
    // 而 KPI 的「进行中」是 0 的矛盾（实测踩过 —— doneCount 只数"已完成"，不数"已开工"）。
    const st = flowStatusOf(r)
    if (st === STEP_STATE.done) done += 1
    else if (st === STEP_STATE.doing) doing += 1
    else none += 1
  }
  return { total: list.length, done, doing, none }
}

/** 列表筛选：产品编号 / 产品名称 / 立项文档编号，大小写无关，空关键字不过滤 */
export function filterFlowRows(rows, keyword, onlyOpen = false) {
  const kw = String(keyword ?? '').trim().toLowerCase()
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (onlyOpen && flowStatusOf(r) === STEP_STATE.done) return false
    if (!kw) return true
    const hay = `${r?.['产品编号'] ?? ''} ${r?.['产品名称'] ?? ''} ${r?.['立项文档编号'] ?? ''}`.toLowerCase()
    return hay.includes(kw)
  })
}

/* ═════════ 与「项目流程管控」(ProjectFlow.vue)对齐的展示口径 · 2026-11-17 ═════════
 * 用户口径:「产品文件流程管控的格式可以按照项目流程管控的格式进行参考设计」。
 * 参考实现把「状态标签/当前环节/展开行信息区」的口径都放在纯函数里,页面只负责画 ——
 * 这里照做,避免两页各写一套判定(判定一漂,同一张单在两条流程里说法就不一样)。
 */

const STEP_LABEL = {
  done: '已完成',
  doing: '进行中',
  none: '未开始',
}

/**
 * 步骤的**状态文案**(el-tag 里显示的那三个字)。
 *
 * <p>归一成三档、不直接显示单据状态原文:ProductFlow 原先 `st.state` 会原样吐出「草稿」,
 * 而 ProjectFlow 那一列一直是「已完成/进行中/未开始」。两页并排看就露馅,故统一走这里。</p>
 *
 * @param {{tone?: string}} step flowStepsOf() 产出的步骤
 * @returns {'已完成'|'进行中'|'未开始'}
 */
export function stateLabelOf(step) {
  const tone = String(step?.tone || STEP_STATE.none)
  return STEP_LABEL[tone] || STEP_LABEL.none
}

/**
 * 「当前环节」= 第一个没完成的步骤(与 nextStepOf 同一个判定,但多给一个**第几步**)。
 *
 * <p>ProjectFlow 的「当前环节」列显示成 `3/10 环节名`,这边是 `2/5 成型工艺清单`。
 * 全部完成返回 null(界面显示「已完成」)。</p>
 *
 * @param {Array} steps flowStepsOf() 的结果
 * @returns {{index: number, step: object, text: string}|null} index 是 1 起的序号
 */
export function currentStepOf(steps) {
  const list = Array.isArray(steps) ? steps : []
  const i = list.findIndex((s) => s.tone !== STEP_STATE.done)
  if (i < 0) return null
  return { index: i + 1, step: list[i], text: `${i + 1}/${list.length}` }
}

/** 展开行底部的「单据信息」项(与 ProjectFlow 的 pf-meta 同构:label + value 成对) */
const DOC_META_FIELDS = [
  { label: '产品编号', pick: (r) => r?.['产品编号'] },
  { label: '产品名称', pick: (r) => r?.['产品名称'] },
  { label: '立项文档编号', pick: (r) => r?.['立项文档编号'] },
  // 「产品信息表单号」= 这张开发包对应产品信息表的**单据编号**(PI-…),
  // 与第一列表头那个「产品编号」(A-54-08 这种业务编号)是两回事,别混。
  { label: '产品信息表单号', pick: (r) => r?.['单据编号'] },
  { label: '最后动作', pick: (r) => r?.at },
]

/**
 * 展开行信息区:与 ProjectFlow 的 `dl.pf-meta` 同一形态(5 项 label/value)。
 * 空值统一给「-」(参考实现是 `|| '-'`,不显示 undefined/空串)。
 *
 * @param {Record<string, any>|null} row /px/rdDevOverview 的一行
 * @returns {Array<{label: string, value: string}>}
 */
export function docMetaOf(row) {
  return DOC_META_FIELDS.map((f) => {
    const v = f.pick(row)
    const s = v === undefined || v === null ? '' : String(v).trim()
    return { label: f.label, value: s || '-' }
  })
}
