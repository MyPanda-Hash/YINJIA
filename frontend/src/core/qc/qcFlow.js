/**
 * qcFlow.js — 「品质流程监控」(QC_FLOW)的**纯逻辑**:把后端一行数据摊成
 * 送料暂收单 → 来料检验单 → 采购入库单 三个节点,并给出每个节点的时态与跳转目标。
 *
 * 为什么单独成模块而不是写在 QcFlowMonitor.vue 里:
 *   · 三个节点的时态判定(已审核/草稿/审批中/作废/未生成/免检)是这一页最容易改错的地方,
 *     抽出来才能单测(见 qcFlow.test.js);
 *   · 跳转**必须**先过面板查看权 —— 判定放在这里,前端各处(看板节点、列表链接)只有一个实现,
 *     不会出现"看板点了会拦、列表点了不拦"的漂移。
 *
 * 口径与后端 QcFlowService 一一对应:
 *   状态 5 档 = yj_doc_status 折叠(已作废 > 已中止 > 审批中 > 已审核 > 草稿);
 *   「免检」= 该物料 bs_inv.来料检验 <> '是' 且还没有检验单(免检批次不走来料检验)。
 */
import { canViewPanel } from '../auth/panelAccess.js'

/** 三个节点对应的目标面板(面板码是跳转的唯一凭据) */
export const FLOW_PANELS = Object.freeze({
  recv: Object.freeze({ code: 'QC_RECV', name: '送料暂收单' }),
  insp: Object.freeze({ code: 'QC_INSP', name: '来料检验单' }),
  in: Object.freeze({ code: 'PURCHASE_IN', name: '采购入库单' }),
})

/** 单据状态 → 展示档位(tone 同时给看板节点底色与列表 el-tag 用) */
export const STATUS_TONE = Object.freeze({
  已审核: 'done',
  草稿: 'draft',
  审批中: 'warn',
  已作废: 'void',
  已中止: 'void',
  未生成: 'none',
  免检: 'skip',
})

/** tag 类型映射(el-tag 的 type 词与 tone 不同名:done↔success) */
export function tagTypeOf(tone) {
  if (tone === 'done') return 'success'
  if (tone === 'warn') return 'warning'
  if (tone === 'void') return 'danger'
  if (tone === 'draft') return 'primary'
  return 'info'
}

/**
 * 节点时态:
 * @param {string} docNo 单据编号(空 = 该环节还没有单据)
 * @param {string} status 单据状态(5 档之一)
 * @param {{skip?:boolean}} [opt] skip = 免检物料且没有检验单 ⇒ 这一节显示「免检」而不是「未生成」
 * @returns {'done'|'doing'|'warn'|'void'|'todo'|'skip'}
 */
export function stepState(docNo, status, opt = {}) {
  const no = String(docNo ?? '').trim()
  const st = String(status ?? '').trim()
  if (!no) return opt.skip ? 'skip' : 'todo'
  if (st === '已作废' || st === '已中止') return 'void'
  if (st === '已审核') return 'done'
  if (st === '审批中') return 'warn'
  return 'doing'
}

/** 采购订单号展示:有行号时追加 #N(与生产工序进度看板同一写法) */
export function poText(row) {
  const no = String(row?.['采购订单号'] ?? '').trim()
  if (!no) return ''
  const line = String(row?.['采购订单行号'] ?? '').trim()
  return line ? `${no} #${line}` : no
}

/**
 * 一行 → 三个节点。
 * @param {object} row 后端 /px/qcFlow/list 的一行
 * @returns {Array<{key:string,name:string,panel:string,no:string,status:string,date:string,state:string,tone:string,skip:boolean}>}
 */
export function buildSteps(row) {
  const needInsp = Number(row?.['需检验'] ?? 0) === 1
  const one = (key, no, status, date, skip) => {
    const docNo = String(no ?? '').trim()
    const st = String(status ?? '').trim() || '未生成'
    return {
      key,
      name: FLOW_PANELS[key].name,
      panel: FLOW_PANELS[key].code,
      no: docNo,
      status: docNo ? st : (skip ? '免检' : '未生成'),
      date: String(date ?? '').trim(),
      state: stepState(docNo, st, { skip }),
      tone: skip && !docNo ? STATUS_TONE['免检'] : (STATUS_TONE[st] || STATUS_TONE['未生成']),
      skip: !!skip && !docNo,
    }
  }
  return [
    one('recv', row?.['送料暂收单号'], row?.['送料状态'], row?.['送料日期'], false),
    one('insp', row?.['检验单号'], row?.['检验状态'], row?.['检验日期'], !needInsp),
    one('in', row?.['入库单号'], row?.['入库状态'], row?.['入库日期'], false),
  ]
}

/**
 * 跳转目标:能不能跳 + 跳到哪。
 *
 * 用户口径(2026-11-12):「可以知道每个单据的状态,和跳转,**如果没有对应面版的权限就无法跳转过去**。」
 * ⇒ 判定用 canViewPanel(与导航/我的桌面/单据间跳转同一真源),`user` 传 { isAdmin, visiblePanels }。
 * 没权限时 `ok=false`、`path=null` —— 调用方只提示「无查看该面板的权限」,**不要**发路由。
 *
 * @param {{isAdmin?:boolean, visiblePanels?:string[]}|null|undefined} user
 * @param {'QC_RECV'|'QC_INSP'|'PURCHASE_IN'|string} panel
 * @param {string} docNo
 * @returns {{ok:boolean, path:string|null, query:object, reason:string}}
 */
export function jumpTarget(user, panel, docNo) {
  const code = String(panel ?? '').trim()
  const no = String(docNo ?? '').trim()
  if (!code || !no) return { ok: false, path: null, query: {}, reason: 'empty' }
  if (!canViewPanel(user, code)) return { ok: false, path: null, query: {}, reason: 'no-permission' }
  return { ok: true, path: `/panelx/list/${code}`, query: { docNo: no }, reason: '' }
}
