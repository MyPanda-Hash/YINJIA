/**
 * slipPrintFlow.js — 三张扫码单「提交即打印 / 补打印」的取值与出纸编排(2026-11-16)
 *
 * <h3>编排(与生产领料单同一条路,只是类型不同)</h3>
 * <pre>
 *   取数  POST /px/slip/rows {面板, 单据编号}   → 头 + 明细(已是代理要的键)
 *   入队  queueToPrintStation({...载荷, 类型})  → 开了开关且勾了该类型的打印电脑出纸
 *   兜底  没电脑在线/没勾     → printInPage 走浏览器打印层(现场至少打得出来)
 * </pre>
 * 为什么兜底不能省:2026-11-02 用户现场就吃过"打印电脑没开,手机上什么都打不出来"的亏,
 * 领料单那条链路因此一直保留本机打印兜底(见 MobilePickDoc.reprint)。
 *
 * <p>纯口径(类型/标题/二维码/载荷拼装)在 slipPrint.js;本文件只做 IO。
 */
import request from '@core/request'
import { printInPage } from '@core/panel/printChannel'
import { pickSlipHtml } from './print-formats'
import { queueToPrintStation } from './printStation'
import { buildSlipPayload, typeOfKind, panelOfKind, isSlipKind } from './slipPrint'

/**
 * 取一张单据的纸面数据。
 * @param {{ kind:string, docNo:string }} p
 * @returns {Promise<object>} 后端的 {面板, 单据编号, 单据日期, 部门, 明细}
 */
export async function fetchSlipData({ kind, docNo } = {}) {
  if (!isSlipKind(kind)) throw new Error('未知的报表类型:' + kind)
  const no = String(docNo || '').trim()
  if (!no) throw new Error('请提供单据编号')
  // 2026-11-18:混料单不是 yj_panel 单据面板(落的是混料记录报表),取数走自己的窄接口;
  // 其余三类仍走 /px/slip/rows(通用「单号 → 头 + 行」取数)
  const res = kind === 'MIX'
    ? await request.get('/px/mix/doc', { params: { docNo: no } })
    : await request.post('/px/slip/rows', {
      面板: panelOfKind(kind),
      单据编号: no,
    })
  return res.data?.data || res.data || {}
}

/**
 * 本机打印(浏览器打印层):与打印代理同一份版式(pickSlipHtml),只是没有代理时用。
 *
 * <p>⚠ 不传二维码(这三个类型纸上不打码,见 slipPrint.buildSlipPayload 注释);
 * pickSlipHtml 收到空码就**连框都不画**。
 *
 * @param {object} payload 与入队同一个载荷
 * @param {object} [opts] 透传给 printInPage(afterprint 回调等)
 * @returns {Promise<boolean>} 是否真的调起了打印层
 */
export async function printSlipLocal(payload, opts = {}) {
  const p = payload || {}
  const title = String(p['标题'] || '').trim() || '领料单'
  return printInPage(title, pickSlipHtml(p, ''), opts)
}

/**
 * 打印一张单(提交后自动打印 / 扫码补打印 / 查询补打印 —— 三处都走这一个函数)。
 *
 * <p>**永不抛业务错**:打印是次要动作,调用方(生单)不该因为它回滚。
 * 但"没打成"必须有个可读的说法,所以返回结构里带 mode + 原因。
 *
 * @param {{ kind:string, docNo:string, source?:string, opts?:object }} p
 * @returns {Promise<{ok:boolean, mode:'station'|'local'|'none', docNo:string, message:string}>}
 */
export async function printSlip({ kind, docNo, source, opts } = {}) {
  const no = String(docNo || '').trim()
  if (!isSlipKind(kind)) return { ok: false, mode: 'none', docNo: no, message: '未知的报表类型:' + kind }
  if (!no) return { ok: false, mode: 'none', docNo: no, message: '没有单号,无法打印' }

  let data
  try {
    data = await fetchSlipData({ kind, docNo: no })
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || ''
    return { ok: false, mode: 'none', docNo: no, message: msg || '取单据明细失败' }
  }

  const payload = buildSlipPayload({ kind, docNo: no, data })
  const type = typeOfKind(kind)
  const queued = await queueToPrintStation({ ...payload, 类型: type, 来源: source || 'mobileOther' })

  if (queued && queued.online) {
    return { ok: true, mode: 'station', docNo: no, message: queued.message || '已发送到打印电脑' }
  }
  // 没有电脑订阅 / 开关关着 ⇒ 退回本机打印层(任务说清楚原因,别让人猜)
  const fell = await printSlipLocal(payload, opts || {})
  return {
    ok: !!fell,
    mode: fell ? 'local' : 'none',
    docNo: no,
    message: queued?.message || (fell ? '' : '没有可用的打印电脑,浏览器打印层也没能调起'),
  }
}
