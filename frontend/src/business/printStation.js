/**
 * printStation.js — 把打印任务发给「自动打印」站点电脑(2026-10-30)
 *
 * 用户口径(2026-10-30):
 *   「关于打印还有单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数并且设置成打开,
 *    然后在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」
 *   二次确认:「需要做个设置(来配置需要用到打印的电脑,实现连接的电脑自动打印)」。
 *
 * 分工(为什么前端只管"发"):
 *   · **手机端(本文件)**:把「打什么」交给服务端队列,一句 {@link queueToPrintStation} 的事;
 *   · **服务端**:队列 + 心跳判定"有没有在线的打印电脑"(见后端 PrintStationController);
 *   · **打印电脑**:`views/sys/PrintStation.vue` 常驻轮询取任务 → 交本地打印代理静默出纸。
 *
 * ⚠ 为什么浏览器不能自己静默打印:标准 `window.print()` **一定**弹打印对话框。
 *   真正的零点击出纸只有本地代理能做到(`tools/printing/print-agent.ps1`),
 *   故本模块只负责"把任务送到那台电脑",不假装能静默。
 */

import request from '@core/request'
import * as QRCodeMod from 'qrcode'

/**
 * 把二维码渲染成 dataURL(PNG,base64)。
 *
 * <p>为什么要前端生成再传给打印电脑(2026-11-01 用户口径「要有二维码显示,和工单同个二维码」):
 * 打印代理是纯 PowerShell,自己画 QR 要么带第三方 DLL、要么手写 QR 编码器,都不现实;
 * 而前端本来就有 `qrcode` 库(标签/工单打印都在用),**同一份算法、同一个内容**,
 * 生成的码天然与工单二维码一致。
 *
 * <p>失败返回空串 —— 代理那边会退回"只有文字、不贴码",不让整条打印失败。
 *
 * @param {string} text 二维码内容
 * @returns {Promise<string>} 形如 data:image/png;base64,...
 */
async function qrDataUrl(text) {
  const content = String(text || '').trim()
  if (!content) return ''
  try {
    // CJS 互操作:不同打包方式下 toDataURL 可能挂在 .default 上(与 print-formats.js 同一处理)
    const lib = typeof QRCodeMod?.toDataURL === 'function'
      ? QRCodeMod
      : (typeof QRCodeMod?.default?.toDataURL === 'function' ? QRCodeMod.default : null)
    if (!lib) return ''
    return await lib.toDataURL(content, { margin: 1, width: 260, errorCorrectionLevel: 'M' })
  } catch {
    return ''
  }
}

/**
 * 把一条打印任务送进站点队列。
 *
 * **永不抛错**:打印是次要动作,调用方(生单/领料)不该因为打印失败而回滚业务。
 * 失败时返回 `{ online: false, queued: false, reason }`,调用方据此降级为本机打印层。
 *
 * @param {{标题?:string, 二维码内容?:string, 工单号?:string, 工单行号?:number,
 *          产品名称?:string, 规格型号?:string, 来源?:string}} payload
 * @returns {Promise<{online:boolean, queued:boolean, reason?:string, message?:string, taskId?:number}>}
 */
export async function queueToPrintStation(payload) {
  try {
    const res = await request.post('/px/print/enqueue', {
      标题: payload?.标题 || '生产领料单',
      二维码内容: payload?.二维码内容 || '',
      // 二维码图随任务一起走,打印电脑直接贴进 PDF/标签(见 qrDataUrl 注释)
      二维码图: await qrDataUrl(payload?.二维码内容),
      工单号: payload?.工单号 || '',
      工单行号: Number(payload?.工单行号) || 0,
      产品名称: payload?.产品名称 || '',
      规格型号: payload?.规格型号 || '',
      来源: payload?.来源 || 'mobile',
    })
    const d = res.data?.data || res.data || {}
    return {
      online: !!d.online,
      queued: !!d.queued,
      reason: d.reason || '',
      message: d.message || '',
      taskId: d.taskId,
      station: d.station || '',
    }
  } catch (e) {
    // 网络/权限问题都按"没走成站点打印"处理 —— 交给调用方降级
    return {
      online: false,
      queued: false,
      reason: 'error',
      message: e?.response?.data?.message || e?.message || '',
    }
  }
}

/** 站点状态(打印电脑页用):开关 / 在线 / 队列长度 / 最近出纸 */
export async function fetchStationState() {
  const res = await request.get('/px/print/station')
  return res.data?.data || res.data || {}
}

/** 取一条待打印任务(打印电脑页轮询;取走即出队) */
export async function fetchPendingTask(station) {
  const res = await request.get('/px/print/pending', { params: station ? { station } : {} })
  return res.data?.data || res.data || { task: null }
}

/** 回报已出纸 / 失败 */
export async function ackTask({ taskId, ok, error, printer, 标题, 工单号, 工单行号, 发起人 }) {
  await request.post('/px/print/ack', {
    taskId, ok, error: error || '', printer: printer || '',
    标题, 工单号, 工单行号, 发起人,
  })
}

/** 保存站点配置(全局开关 + 站点名) */
export async function saveStationConfig({ autoEnabled, stationName }) {
  const res = await request.post('/px/print/station', { autoEnabled, stationName })
  return res.data?.data || res.data || {}
}
