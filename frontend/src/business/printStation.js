/**
 * printStation.js — 「自动打印」面板与打印任务队列(2026-10-30 建,2026-11-04 改按电脑+按类型)
 *
 * 用户口径(2026-10-30):
 *   「关于打印还有单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数并且设置成打开,
 *    然后在手机打印的时候就可以关联这个打开了面版参数的电脑,这台电脑连接的打印机就会自动打印」
 *   二次确认:「需要做个设置(来配置需要用到打印的电脑,实现连接的电脑自动打印)」。
 *
 * 用户口径(2026-11-04,本次改造):
 *   「我是想要设置的电脑开启自动打印,没有设置的电脑就不开启,但是在服务器上开启是固定的。
 *    能不能在自动打印的面版加个参数来限定电脑。还有我想加个勾选打印类型的。」
 *
 * 分工(为什么前端只管"发"):
 *   · **手机端(本文件)**:把「打什么(类型)+ 内容」交给服务端队列,一句 {@link queueToPrintStation};
 *   · **服务端**:按「哪台电脑开了开关、勾了这个类型」派单(见后端 PrintStationController);
 *   · **打印电脑**:本机代理 `tools/printing/print-agent.ps1` 自己每 4 秒拉 `/pending` 并出纸
 *     —— 页面**不参与取任务**,只用来配置和看状态(2026-11-03 起就是这个架构)。
 *
 * ⚠ 为什么浏览器不能自己静默打印:标准 `window.print()` **一定**弹打印对话框。
 *   真正的零点击出纸只有本机代理能做到,故本模块只负责"把任务送到服务端的队列里"。
 */

import request from '@core/request'
import * as QRCodeMod from 'qrcode'

/**
 * 打印类型 code —— **必须与后端 `PrintStationController.PRINT_TYPES` 的键一致**。
 *
 * <p>新增一种报表:后端注册表加一行,这里加一个常量,并在产出该报表的地方
 * （如 `MobilePickDoc.reprint`）把它作为 {@code 类型} 传给 {@link queueToPrintStation}。
 * 面板上的勾选框由后端下发（`/px/print/station` 的 `types`），前端不维护第二份清单。
 */
export const PRINT_TYPE_PICK_SLIP = 'PICK_SLIP'   // 生产领料单(工单二维码 + 领料明细)

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
 * 把一条打印任务送进站点队列,由**开了开关且勾了这个类型**的打印电脑取走。
 *
 * **永不抛错**:打印是次要动作,调用方(生单/领料)不该因为打印失败而回滚业务。
 * 失败时返回 `{ online: false, queued: false, reason }`,调用方据此降级为本机打印层。
 *
 * @param {{类型?:string, 标题?:string, 二维码内容?:string, 工单号?:string, 工单行号?:number,
 *          产品名称?:string, 规格型号?:string, 来源?:string}} payload
 * @returns {Promise<{online:boolean, queued:boolean, reason?:string, message?:string,
 *                    taskId?:number, station?:string, targets?:string[]}>}
 */
export async function queueToPrintStation(payload) {
  try {
    const res = await request.post('/px/print/enqueue', {
      // 打印类型(2026-11-04):决定这条任务发给哪几台电脑(见后端 PRINT_TYPES)
      类型: payload?.类型 || PRINT_TYPE_PICK_SLIP,
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
      targets: Array.isArray(d.targets) ? d.targets : [],
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

/**
 * 站点状态(「自动打印」页):服务端总闸 / 打印电脑清单(各自开关+类型) / 类型清单 / 队列 / 最近出纸。
 */
export async function fetchStationState() {
  const res = await request.get('/px/print/station')
  return res.data?.data || res.data || {}
}

/**
 * 保存**某一台打印电脑**的配置(开关 + 勾选的打印类型)。
 *
 * <p>2026-11-04:这条不再写全局开关 —— 只写 {@code stationName} 那一行,
 * 别的电脑一点不受影响(用户口径「没有设置的电脑就不开启」)。
 */
export async function saveStationConfig({ stationName, enabled, types } = {}) {
  const res = await request.post('/px/print/station', {
    stationName: stationName || '', enabled: !!enabled, types: Array.isArray(types) ? types : [],
  })
  return res.data?.data || res.data || {}
}
