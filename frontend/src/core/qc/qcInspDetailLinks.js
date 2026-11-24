/**
 * 出货检验两张明细表(QC_PROC_INSP_DETAIL / QC_ASM_INSP_DETAIL)的**单号跳转契约**,唯一真源。
 *
 * 【用户口径 2026-11-23】「实现点击对应的单号可以转到对应的单据。」
 * (附《出货检验（表观）明细表》截图,红框圈住「工号」列 = 工单号 GD-2026-11-0002…)
 *   ⇒ 明细表上两列单号可点:
 *     · 单据编号 → 本行所属的出货检验单(面板 QC_PROC_INSP / QC_ASM_INSP,
 *                  /panelx/list/<面板>?docNo=<单号> 定位,与检验数据记录明细表/来料品质流程监控同一口径);
 *     · 工单号   → 生产工单页(/prod/plan/workOrderList?keyword=<工单号>&focus=<工单行id>),
 *                  与「生产工序进度看板」点整行同款 —— 定位该工单行 + 打开工单详情·追溯。
 *
 * 【为什么单独成模块】跳转目标 = 另一张面板/页面的编码,属于前端路由知识;
 * 权限闸门也必须与导航/看板同一真源,不能每个调用点各写一份 if。
 * 纯函数(不碰 vue/router),单测见 qcInspDetailLinks.test.js。
 *
 * 【两处字段来源】
 *   · 单据编号 / 工单号 = 视图里已有的列(扁平报表的列名即数据键);
 *   · 工单行id = 视图的隐藏列(visible=0,见 tools/migrate-qc-insp-detail-doclinks-20261123.sql),
 *     头表只有「工单号 + 工单行号」,精确定位工单页那一行必须靠 plang.id。
 *     对不上(NULL)时退化成只按工单号关键字跳 —— 不报错、不猜行。
 */
import { canDo, canViewPanel, PAGE_PANELS } from '../auth/panelAccess.js'

/** 明细表面板码 → { 归属的出货检验单面板 } */
export const QC_INSP_DETAIL_PANELS = Object.freeze({
  QC_PROC_INSP_DETAIL: Object.freeze({ docPanel: 'QC_PROC_INSP', docPanelName: '出货检验（功能）' }),
  QC_ASM_INSP_DETAIL: Object.freeze({ docPanel: 'QC_ASM_INSP', docPanelName: '出货检验（表观）' }),
})

/** 可点跳转的列(字段标签 = 视图列名 = 报表列 prop) */
export const LINK_DOC_COL = '单据编号'
export const LINK_WO_COL = '工单号'
/** 隐藏列(视图里的 plang.id):点工单号时定位到具体工单行 */
export const LINK_WO_LINE_COL = '工单行id'
/** 生产工单页(页面级虚拟面板 WORK_ORDER_LIST,权限走 pagePerms 的 view 词) */
export const WORK_ORDER_ROUTE = '/prod/plan/workOrderList'

/** 该面板是不是出货检验明细表 */
export function isQcInspDetailPanel(panelCode) {
  return !!QC_INSP_DETAIL_PANELS[String(panelCode ?? '').trim()]
}

/**
 * 这一列要不要渲染成链接。
 * @param {string} panelCode 当前面板码
 * @param {string} columnLabel 列名(报表列 prop)
 * @returns {''|'doc'|'workOrder'} '' = 不跳(普通单元格)
 */
export function detailLinkKind(panelCode, columnLabel) {
  const cfg = QC_INSP_DETAIL_PANELS[String(panelCode ?? '').trim()]
  if (!cfg) return ''
  const label = String(columnLabel ?? '').trim()
  if (label === LINK_DOC_COL) return 'doc'
  if (label === LINK_WO_COL) return 'workOrder'
  return ''
}

/**
 * 「单据编号 → 出货检验单」的跳转目标(过面板查看权)。
 * 目标面板查表 = QC_INSP_DETAIL_PANELS;单号为空/面板不在册/无权限一律 ok=false(调用方只提示)。
 * @param {{isAdmin?:boolean, visiblePanels?:string[]}|null|undefined} user
 * @param {string} panelCode 明细表面板码
 * @param {string} docNo 单据编号
 * @returns {{ok:boolean, path:string|null, query:object, reason:string, panel:string, title:string}}
 */
export function docJumpTarget(user, panelCode, docNo) {
  const cfg = QC_INSP_DETAIL_PANELS[String(panelCode ?? '').trim()]
  const no = String(docNo ?? '').trim()
  const base = { ok: false, path: null, query: {}, panel: cfg ? cfg.docPanel : '', title: cfg ? cfg.docPanelName : '' }
  if (!cfg) return { ...base, reason: 'unknown-panel' }
  if (!no) return { ...base, reason: 'empty' }
  if (!canViewPanel(user, cfg.docPanel)) return { ...base, reason: 'no-permission' }
  return { ...base, ok: true, path: `/panelx/list/${cfg.docPanel}`, query: { docNo: no }, reason: '' }
}

/**
 * 「工单号 → 生产工单页」的跳转目标。
 *
 * 带 `focus` = 工单行 id(plang.id)时,工单页会高亮该行并自动打开「工单详情·追溯」;
 * 对不上工单行(隐藏列 NULL)时只带 keyword —— 工单页按单号过滤,用户仍能看到那张工单。
 * 权限 = 页面面板 WORK_ORDER_LIST 的 view 词(与生产工序进度看板/导航同一闸门)。
 *
 * @param {{isAdmin?:boolean, pagePerms?:Record<string,string>}|null|undefined} user
 * @param {string} docNo 工单号
 * @param {string|number|null|undefined} lineId 工单行id(plang.id;可空)
 * @returns {{ok:boolean, path:string|null, query:object, reason:string}}
 */
export function workOrderJumpTarget(user, docNo, lineId) {
  const no = String(docNo ?? '').trim()
  const base = { ok: false, path: null, query: {} }
  if (!no) return { ...base, reason: 'empty' }
  if (!canDo(user, PAGE_PANELS.WORK_ORDER_LIST, 'view')) return { ...base, reason: 'no-permission' }
  const id = lineId == null ? '' : String(lineId).trim()
  const query = { keyword: no }
  if (id) query.focus = id
  return { ok: true, path: WORK_ORDER_ROUTE, query, reason: '' }
}
