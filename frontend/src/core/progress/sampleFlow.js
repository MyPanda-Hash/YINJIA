/**
 * sampleFlow.js —— 样品进度跟踪（2026-11-18 用户口径，Excel #9；2026-11-20 双外部面板）
 *
 * 用户原话：「设置类似产品文件列表的进度展示，提取样品单编号、客户名称、下单日期、审核人、确认人，
 *   字段填充列标题。同时需要列标题加一项进度描述……销售填写申请单之后可到此列表查询样品进展，
 *   可以看到到几级审核了」。
 * 2026-11-20 追加：「样品追踪应该是追踪外部的两个样品面板，现在只是一个，
 *   加上在这个界面可以切换分别追踪这两个外部的单据」。
 *
 * 【本模块只做纯逻辑，不碰网络】
 *   后端 `/px/sampleFlow?panel=` 只回**原始标记**（pending / approve_node / archived / canceled）与
 *   头表字段；节点文案在这里推导 —— 以后改口径（比如加"待销售确认"）只动这一处，不用重编 jar。
 *
 * 【面板】两个外部样品单，接口同契约、页面同一套渲染/筛选：
 *   · RD_SAMPLE_EXT 外部-开发样品单（两级审批：提交 → 一级审核 → 二级确认 → 归档）
 *   · RD_SAMPLE_ND  外部-非开发样品单（一级审批：提交 → 审核；没有「确认」节点）
 *
 * 【节点口径】与审批流一一对应（RD_SAMPLE_EXT：提交 → 一级审核 → 二级确认 → 已审核）：
 *   已作废 canceled='Y'            → 已作废（优先判，作废单不该显示成"进行中"）
 *   已归档 archived='Y'            → 已完成（ND 的"已审核"由后端映射成该标记）
 *   pending='Y' 且 approve_node≥2  → 待二级确认（一级已过，等二级签核；**ND 没有二级**）
 *   pending='Y' 且 approve_node<2  → 待一级审核
 *   其余                            → 草稿
 */

/** 外部-开发样品单（两级审批；不传 panel 时的默认面板，保持旧链接/旧调用兼容） */
export const SAMPLE_PANEL_EXT = 'RD_SAMPLE_EXT'
/** 外部-非开发样品单（一级审批：没有「确认」节点，确认人恒空） */
export const SAMPLE_PANEL_ND = 'RD_SAMPLE_ND'

/**
 * 可切换的面板（顺序即页面切换顺序）。
 * singleLevel = 单级审批 ⇒ 节点推导不认 approve_node≥2，KPI「待二级确认」恒 0。
 */
export const SAMPLE_PANELS = [
  { code: SAMPLE_PANEL_EXT, label: '外部-开发样品单', singleLevel: false },
  { code: SAMPLE_PANEL_ND, label: '外部-非开发样品单', singleLevel: true },
]

/** 面板码归一：只认 ND，其余（不传/脏值/旧链接）落回 EXT */
export function normalizeSamplePanel(panel) {
  const p = String(panel == null ? '' : panel).trim().toUpperCase()
  return p === SAMPLE_PANEL_ND ? SAMPLE_PANEL_ND : SAMPLE_PANEL_EXT
}

/** 该面板是不是单级审批（ND） —— 节点/KPI 共用这一处判定 */
export function isSingleLevelPanel(panel) {
  return normalizeSamplePanel(panel) === SAMPLE_PANEL_ND
}

/**
 * 点一行/点单号要去哪个面板 —— 必须跟着**当前选中的面板**走：
 * EXT → RD_SAMPLE_EXT，ND → RD_SAMPLE_ND（不能写死 EXT，否则在非开发单页点开的是开发单列表）。
 * @returns {{path: string, query: {focus: string}}} 与 router.push 的参数同构
 */
export function sampleDocRoute(panel, docNo) {
  return {
    path: `/panelx/list/${normalizeSamplePanel(panel)}`,
    query: { focus: String(docNo == null ? '' : docNo).trim() },
  }
}

/** 节点键 → 文案（文案走 tt()，键本身稳定） */
export const SAMPLE_NODE_TEXT = {
  void: '已作废',
  done: '已完成',
  l2: '待二级确认',
  l1: '待一级审核',
  draft: '草稿',
}

/** 节点键 → 序号（用于排序/着色；作废排最后） */
export const SAMPLE_NODE_ORDER = { draft: 1, l1: 2, l2: 3, done: 4, void: 9 }

/** 由一行原始数据推出节点键（panel 省略 = EXT 两级口径，兼容旧调用） */
export function sampleNodeOf(row, panel) {
  const r = row || {}
  if (String(r.canceled || '').toUpperCase() === 'Y') return 'void'
  if (String(r.archived || '').toUpperCase() === 'Y') return 'done'
  if (String(r.pending || '').toUpperCase() === 'Y') {
    // 单级审批（ND）没有二级节点：pending 一律算「待一级」，脏数据 approve_node=2 也不会冒出"待二级"
    if (isSingleLevelPanel(panel)) return 'l1'
    return Number(r.approve_node || 0) >= 2 ? 'l2' : 'l1'
  }
  return 'draft'
}

/** 节点键 → 文案（未翻译原文；渲染层请套 tt()） */
export function sampleNodeText(row, panel) {
  return SAMPLE_NODE_TEXT[sampleNodeOf(row, panel)] || SAMPLE_NODE_TEXT.draft
}

/** 顶部四个计数：全部 / 待一级 / 待二级 / 已完成（作废单不计入"全部"；ND 待二级恒 0） */
export function sampleKpisOf(rows, panel) {
  const list = Array.isArray(rows) ? rows : []
  let l1 = 0
  let l2 = 0
  let done = 0
  let total = 0
  for (const r of list) {
    const node = sampleNodeOf(r, panel)
    if (node === 'void') continue
    total += 1
    if (node === 'l1') l1 += 1
    else if (node === 'l2') l2 += 1
    else if (node === 'done') done += 1
  }
  return { total, l1, l2, done }
}

/**
 * 关键字过滤：样品单编号 / 客户名称 / 审核人 / 确认人 / 进度描述，忽略大小写、支持片段。
 * 空关键字 = 不过滤（与产品文件流程管控同口径）。
 */
/** 可查询字段（2026-11-19 用户口径：「做一个根据下面信息的字段内容进行查询的功能」） */
export const SAMPLE_FLOW_FIELDS = ['样品单编号', '客户名称', '审核人', '确认人', '当前节点', '进度描述', '下单日期']

/**
 * 样品进度跟踪筛选。
 * @param {Array} rows /px/sampleFlow 的行
 * @param {{field?: string, keyword?: string}|string} opt 传字符串时按**全部字段**模糊匹配（兼容旧调用）
 */
export function filterSampleRows(rows, opt) {
  const list = Array.isArray(rows) ? rows : []
  const o = typeof opt === 'string' ? { field: '', keyword: opt } : (opt || {})
  const k = String(o.keyword == null ? '' : o.keyword).trim().toLowerCase()
  if (!k) return list
  const field = String(o.field || '').trim()
  // 字段名 → 行里的键（单号列在服务端叫「单据编号」，界面显示「样品单编号」）
  const KEY = { '样品单编号': '单据编号' }
  const read = (r, f) => String(r?.[KEY[f] || f] == null ? '' : r[KEY[f] || f])
  if (field && field !== '全部字段') {
    return list.filter((r) => read(r, field).toLowerCase().includes(k))
  }
  const fields = ['单据编号', '客户名称', '审核人', '确认人', '当前节点', '进度描述', '下单日期']
  return list.filter((r) => fields.some((f) => read(r, f).toLowerCase().includes(k)))
}
