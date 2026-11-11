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
 * @param {Record<string, any>|null} row /px/rdDevOverview 的一行
 * @returns {Array<{key: string, label: string, docNo: string, state: string, tone: string, reaudited: boolean}>}
 */
export function flowStepsOf(row) {
  if (!row) return []
  const nodes = Array.isArray(row.nodes) ? row.nodes : []
  const head = {
    key: 'RD_PROD_INFO',
    label: '产品信息表',
    docNo: String(row['单据编号'] || ''),
    state: String(row.state || ''),
    tone: String(row.state || '') === '已归档' ? STEP_STATE.done
      : (String(row.state || '').trim() && String(row.state) !== '草稿' ? STEP_STATE.doing : STEP_STATE.none),
    reaudited: !!row.reaudited,
  }
  return [head, ...nodes.map((n) => ({
    key: String(n.panel || n.label || ''),
    label: String(n.label || n.panel || ''),
    docNo: String(n.docNo || ''),
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
  const list = (Array.isArray(rows) ? rows : []).filter((r) => String(r?.['产品编号'] || '').trim() !== '')
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
