/**
 * mixScan.js — 手机扫码 · **扫码混料**的纯逻辑(2026-11-18;第四轮随「两页结构」改版)
 *
 * <h3>用户口径(原话)</h3>
 * 「在手机扫码里面加一个扫码混料的面版。逻辑:扫工单码,带出一级BOM(就是物料清单,
 *  之前生产领料的是组装物料清单),逐项扫物料码,自动获取电子秤的数量,
 *  提交保存一笔,全部扫完,整单保存。保存后自动打印,并且保留单据,重新扫码后进入可以补打印。」
 *
 * <p>第四轮(2026-11-18):「扫码混料,应该和生产领料一样也是跳转到单据的明细里面再开始扫物料码,
 * 解锁对应的物料码,然后根据连接电子秤的取数,点击确认。再扫其他的物料解锁,根据电子秤再确认。
 * 全部物料确认完毕后,才可以提交。设计要和生产领料一致。」</p>
 *
 * <h3>为什么单独一个模块</h3>
 * 工单码解析、行模型归一、「全部确认完毕」的判据、秤值有效性、纸面载荷拼装全是纯函数,
 * 能被 `node --test` 钉住边界;两个页面只负责交互与请求:
 * · 列表页 {@code MobileMixScan.vue}(= 生产领料的 MobilePickList)
 * · 明细页 {@code MobileMixDoc.vue} (= 生产领料的 MobilePickDoc,差别只在数量来自电子秤)
 *
 * <h3>「确认」是覆盖写入,不是累加(2026-11-18 第四轮改口径)</h3>
 * 与生产领料「写入数量」同一语义:同一物料再确认一次 = 以最后一次秤值为准。
 * 上一版扫一次加一次,现场"扫了看一眼再确认"会把实际用量记成两倍。
 *
 * <h3>码格式(沿用既有约定,不新造)</h3>
 * · 工单码 = `公司代码@工单号@(1000+工单行号)`,行号 3 位补零(见 print-formats.js 的 woQrText);
 * · 物料码 = `存货编码|批号`(见 scanPick.js 的 parseBarcode)。
 */

/**
 * 解析工单二维码。
 *
 * 规则:公司代码@工单号@(1000+行号),行号 3 位不足补 0。
 * 例:`YJ@GD-2026-10-0220@1002` ⇒ { company:'YJ', orderNo:'GD-2026-10-0220', lineNo:2 }
 *
 * 为什么要减 1000:行号加了 1000 前缀是为了让码里的行号恒为 4 位、便于人眼与扫码枪对齐;
 * 减回去才是 plang.pl_xc 的真实行号。
 *
 * <p>本函数**只认工单二维码**(必须带 @)。手敲的工单号 / 产品名片段不走这里,
 * 由页面的「查询单据」转服务端关键字查 —— 否则物料码 `YJ-SX-001|2026...`
 * 会被误判成工单号(既有单测钉住了这条)。
 *
 * @param {string} raw 扫码枪或手工输入的原串
 * @returns {{ ok: boolean, company: string, orderNo: string, lineNo: number, kind?: string, reason?: string }}
 */
export function parseWorkOrderQr(raw) {
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return { ok: false, company: '', orderNo: '', lineNo: 0, reason: 'empty' }
  const parts = text.split('@')
  if (parts.length < 2) return { ok: false, company: '', orderNo: '', lineNo: 0, reason: 'no-order' }
  const company = String(parts[0] || '').trim()
  const orderNo = String(parts[1] || '').trim()
  if (!orderNo) return { ok: false, company, orderNo: '', lineNo: 0, reason: 'no-order' }
  // 第三段(行号)可选:整单码只到工单号时,行号记 0 表示「整单」
  const lineRaw = parts.length > 2 ? String(parts[2] || '').trim() : ''
  // 第四段(可选)= **领料标记**:2026-11-18 领料单纸面二维码多带一位,
  //   `A`=组装领料 / `M`=混料领料(用户口径「混料和组装的二维码是一样的,需要在二维码上多一位作为标记」)。
  //   老的三段工单码没有这段 ⇒ kind 记空串,行为与以前一模一样。
  const kind = pickKindOf(parts[3])
  if (!lineRaw) return { ok: true, company, orderNo, lineNo: 0, kind }
  const n = Number(lineRaw)
  if (!Number.isFinite(n)) return { ok: false, company, orderNo, lineNo: 0, reason: 'bad-line', kind }
  const lineNo = n >= 1000 ? n - 1000 : n
  return { ok: true, company, orderNo, lineNo, kind }
}

/**
 * 二维码「领料标记」段 → 领料类型。
 *
 * <p>领料单纸面二维码第 4 段:`A`/`组装` ⇒ 组装领料;`M`/`混料` ⇒ 混料领料;
 * 其它值或没有这一段(老工单码)⇒ `''`,`parseWorkOrderQr` 的其余字段与以前一致。
 *
 * @param {any} seg 第 4 段原文
 * @returns {'组装'|'混料'|''}
 */
export function pickKindOf(seg) {
  const s = String(seg == null ? '' : seg).trim().toUpperCase()
  if (!s) return ''
  if (s === 'A' || s === '组装' || s === 'ASSEMBLY') return '组装'
  if (s === 'M' || s === '混料' || s === 'MIX') return '混料'
  return ''
}

/** 四位小数取整(与后端 decimal(18,8) 落库、界面显示同口径) */
export function round4(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10000) / 10000
}

/**
 * 明细页行模型:后端 `GET /px/mix/task` 的 `明细` → 页面行。
 *
 * <p>应投量由**后端**按《物料清单》算(标准用量 × 排产数量 + 损耗量),页面不再自己乘 ——
 * 一处算、一处显示,免得界面和提交时的校验各算一套。
 *
 * @param {any[]} lines 后端明细行
 * @returns {any[]} 每行 { 行号, 编码, 名称, 规格, 单位, 应投, 实投, 待投, 行id, 批号, 已确认 }
 */
export function toMixRows(lines) {
  return (Array.isArray(lines) ? lines : []).map((l, i) => {
    const required = round4(l?.['应投'])
    const actual = round4(l?.['实投'])
    return {
      行号: String(l?.['行id'] ?? i + 1),
      编码: String(l?.['物料编号'] ?? '').trim(),
      名称: String(l?.['物料名称'] ?? '').trim(),
      规格: String(l?.['规格型号'] ?? '').trim(),
      单位: String(l?.['单位'] ?? '').trim(),
      应投: required,
      实投: actual,
      待投: round4(required - actual),
      行id: Number(l?.['行id']) || 0,
      批号: String(l?.['物料批次'] ?? '').trim(),
      // 已确认 = 该行已有实投(>0);与后端的提交闸门、mixProgress 同一判据
      已确认: actual > 0,
    }
  })
}

/**
 * 只读明细页的行模型:后端 `GET /px/mix/doc`(一张已保存的混料单)的 `明细` → 页面行。
 *
 * <p>已保存的单**不能再改**:这里只做形状归一(纸面口径用的是字符串重量,页面要数字),
 * 不给 `行id`/`已确认` —— 页面据此判断"这是只读单据"。
 *
 * @param {any[]} lines 后端明细行(应投重量 / 实投重量 / 添加比例 都是纸面口径的字符串)
 * @returns {any[]} 每行 { 行号, 编码, 名称, 规格, 单位, 应投, 实投, 批号, 比例 }
 */
export function toSavedRows(lines) {
  return (Array.isArray(lines) ? lines : []).map((l, i) => ({
    行号: String(l?.['序号'] ?? i + 1),
    编码: String(l?.['物料编号'] ?? '').trim(),
    名称: String(l?.['物料名'] ?? l?.['物料名称'] ?? '').trim(),
    规格: String(l?.['规格型号'] ?? '').trim(),
    单位: String(l?.['单位'] ?? '').trim(),
    应投: round4(l?.['应投重量']),
    实投: round4(l?.['实投重量']),
    批号: String(l?.['物料批次'] ?? '').trim(),
    比例: String(l?.['添加比例'] ?? '').trim(),
  }))
}

/**
 * 「全部物料都确认完毕了吗」—— 提交闸门的唯一判据。
 *
 * <p>与「生产领料」的 {@code pickProgress} 完全同口径:**每一行都要有数量(>0)**,
 * 不要求等于应投量(现场多投/少投由纸上体现,系统不在这里拦)。
 * 后端 {@code saveDoc} 会按物料清单再校一遍,两边判据一致。
 *
 * @param {any[]} rows {@link toMixRows} 的结果
 * @returns {{ ok: boolean, total: number, done: number, missing: string[] }}
 */
export function mixProgress(rows) {
  const arr = (Array.isArray(rows) ? rows : [])
  const missing = arr.filter((r) => round4(r?.实投) <= 0).map((r) => String(r?.编码 || r?.名称 || ''))
  const total = arr.length
  const done = total - missing.length
  return { ok: total > 0 && missing.length === 0, total, done, missing }
}

/**
 * 确认一项:**覆盖**该行的实投量(不是累加 —— 见文件头「确认是覆盖写入」)。
 *
 * <p>匹配口径**只按物料编码**(与物料清单同一键):条码里的批号是采购入库派生的,
 * 拿它和清单做全等匹配实测 0 命中。
 *
 * @param {any[]} rows {@link toMixRows} 的结果(会被就地更新 实投/待投/已确认/批号)
 * @param {{ code: string, qty: number, batch?: string }} p
 * @returns {{ ok: boolean, reason?: 'miss'|'no-qty', line?: any, index?: number, exceed?: boolean }}
 */
export function applyConfirm(rows, p) {
  const code = String(p?.code || '').trim()
  if (!code) return { ok: false, reason: 'miss' }
  const qty = round4(p?.qty)
  if (!(qty > 0)) return { ok: false, reason: 'no-qty' }
  const list = Array.isArray(rows) ? rows : []
  const idx = list.findIndex((r) => String(r?.编码 || '').trim() === code)
  if (idx < 0) return { ok: false, reason: 'miss' }
  const line = list[idx]
  line.实投 = qty
  line.待投 = round4(round4(line.应投) - qty)
  line.已确认 = true
  const batch = String(p?.batch || '').trim()
  if (batch) line.批号 = batch
  // 超投不拦死(现场常有多投一点),只把超出量标出来由页面提示
  return { ok: true, line, index: idx, exceed: line.待投 < 0 }
}

/**
 * 从 `/api/dc/monitor` 的响应里取出「电子秤 · 重量」这一个点位的最新读数。
 *
 * ⚠ 返回结构是**扁平的**:`data.points` 是当前选中设备的点位数组(不是嵌在 devices 里),
 * 每个点位 { code, name, valueNum, valueText, unit, at, status }。
 * 2026-10-21 在「工单扫码领料」里实测踩过:按 `devices[].points` 取会永远拿不到值
 * ⇒ 秤一直显示「等待称重」。扫码混料沿用同一口径(同一个数采点位、同一个前端库)。
 *
 * 纯函数:只做形状归一,不碰网络(请求在页面里发),因此可以直接单测。
 *
 * @param {any} payload `/dc/monitor` 的响应体(或它的 data)
 * @returns {{ value:number, at:string, stable:boolean, deviceCode:string }|null}
 */
export function scaleReadingOf(payload) {
  const d = (payload && (payload.data || payload)) || {}
  const points = Array.isArray(d.points) ? d.points : []
  if (!points.length) return null
  // 优先「重量」点位,其次 kg 单位,最后退回第一个
  const w = points.find((p) => String(p.name || '').includes('重量'))
    || points.find((p) => String(p.unit || '') === 'kg')
    || points[0]
  if (!w) return null
  const v = w.valueNum != null ? Number(w.valueNum) : Number(w.valueText)
  return {
    value: Number.isFinite(v) ? v : NaN,
    at: w.at || w.collectAt || '',
    // 数采侧给 status='normal' 才算稳定;报警/超限一律不算
    stable: String(w.status || '') === 'normal',
    deviceCode: String(d.deviceCode || w.deviceCode || ''),
  }
}

/**
 * 判定电子秤读数是否可用于记录实际用量。
 *
 * 实测教训(2026-10-19 采样):库里出现过 `-1.0000` 的脏值,以及同一时刻重复上报。
 * 故取值必须同时满足:重量 > 0、采样时间在窗口内、与上一次读数一致(连续两次相同才认稳定)。
 *
 * @param {any} reading 一次秤读数 { value:number, at:string|Date, stable?:boolean }
 * @param {any} [prev] 上一次读数
 * @param {{ windowMs?: number, now?: number }} [opt]
 * @returns {{ ok: boolean, reason?: 'no-value'|'negative'|'stale'|'unstable', value?: number }}
 */
export function checkScaleReading(reading, prev, opt = {}) {
  const windowMs = opt.windowMs == null ? 10000 : opt.windowMs
  const now = opt.now == null ? Date.now() : opt.now
  const v = Number(reading?.value)
  if (!Number.isFinite(v)) return { ok: false, reason: 'no-value' }
  if (v <= 0) return { ok: false, reason: 'negative' }
  const at = reading?.at ? new Date(reading.at).getTime() : NaN
  if (!Number.isFinite(at)) return { ok: false, reason: 'stale' }
  if (now - at > windowMs) return { ok: false, reason: 'stale' }
  // 秤本身报了稳定标志就直接认
  if (reading?.stable === true) return { ok: true, value: v }
  // 否则要求与上一次读数一致(按 0.001 比较),避免把称重过程中的跳动值抓进去
  const pv = Number(prev?.value)
  if (!Number.isFinite(pv)) return { ok: false, reason: 'unstable' }
  if (Math.abs(v - pv) > 0.001) return { ok: false, reason: 'unstable' }
  return { ok: true, value: v }
}

/**
 * 拼「确认」的请求体(POST /px/mix/scan 的 {@code 确认写入})。
 *
 * 字段名与后端 {@code MixScanService.saveScan} 逐字对应(数据键中文,ADR-0001)。
 *
 * @param {{ order?: object, line?: object, qty: number, batch?: string }} p
 *   order = 单据抬头({工单号, 工单行号, 工单行id, 产品编码, 产品名称});
 *   line  = {@link toMixRows} 的一行({编码, 名称, 应投, 单位});
 *   qty   = 本次实际用量(电子秤读数或手输)
 * @returns {object} 请求体
 */
export function buildScanPayload(p) {
  const order = p?.order || {}
  const line = p?.line || {}
  return {
    工单号: String(order.工单号 || '').trim(),
    工单行id: Number(order.工单行id) > 0 ? Number(order.工单行id) : undefined,
    工单行号: Number(order.工单行号) || 0,
    产品编码: String(order.产品编码 || '').trim(),
    产品名称: String(order.产品名称 || '').trim(),
    物料编号: String(line.编码 || '').trim(),
    物料名称: String(line.名称 || '').trim(),
    // 物料批次:物料码是 `存货编码|批号`,批号随码带下来 —— 纸面《成型配料记录》有「物料批次」一列
    物料批次: String(p?.batch || '').trim(),
    计划用量: round4(line.应投),
    实际用量: round4(p?.qty),
    单位: String(line.单位 || '').trim(),
  }
}

/**
 * 混料单的纸面口径(2026-11-18 第二轮:用户给了纸样,要求**横板 A4**)。
 *
 * 纸样 = 《成型配料记录》(文件编码 YJ-QR-147),一张 17 列的宽表:
 * ```
 *   序号 | 车间 | 产品编号 | 配方版本号 | 物料编号 | 物料名 | 添加比例 | 应投重量 |
 *   实投重量 | 物料批次 | 开始时间 | 结束时间 | 转速 | 配料批次号 | 物料水分 | 配料人 | 确认人
 * ```
 * 代理(print-agent.ps1 的 Send-MixSheetToPrinter)与浏览器兜底(mixSheetHtml)共用这份键。
 *
 * 为什么不再复用「领料单七列表」:纸样是**另一种纸**——列名、列数、纸张(A4 横)都不一样,
 * 硬套领料单版式只会两边都改得四不像。
 */
export const MIX_PAPER = {
  标题: '成型配料记录',
  文件编码: 'YJ-QR-147',
  /** A4 横向:210mm 高 × 297mm 宽(浏览器兜底打印用) */
  纸张: { w: '297mm', h: '210mm' },
}

/**
 * 把 `/px/mix/doc` 的返回拼成**专用纸表**的打印载荷。
 *
 * @param {{ docNo: string, data?: object }} p
 * @returns {object} { 标题, 领料单号, 打印日期, 纸面:{…整单抬头…}, 明细:[{物料编号,物料名,添加比例,应投重量,实投重量,物料批次}] }
 */
export function buildMixSlipPayload({ docNo, data } = {}) {
  const d = data || {}
  const no = String(docNo || d['单据编号'] || '').trim()
  return {
    标题: String(d['标题'] || MIX_PAPER.标题),
    // 任务单号:打印缓存/站点列表里认单用(纸面上的号是「配料批次号」)
    领料单号: no,
    打印日期: String(d['单据日期'] || '').trim().slice(0, 10),
    // 整张单只有一格的抬头数据(代理按固定版式取;缺的字段留空,纸上就是空格子)
    纸面: {
      标题: String(d['标题'] || MIX_PAPER.标题),
      文件编码: String(d['文件编码'] || MIX_PAPER.文件编码),
      序号: 1,
      车间: String(d['车间'] || '').trim(),
      产品编号: String(d['产品编号'] || '').trim(),
      配方版本号: String(d['配方版本号'] || '').trim(),
      开始时间: String(d['开始时间'] || '').trim(),
      结束时间: String(d['结束时间'] || '').trim(),
      转速: String(d['转速'] || '').trim(),
      配料批次号: String(d['配料批次号'] || no),
      物料水分: String(d['物料水分'] || '').trim(),
      配料人: String(d['配料人'] || d['创建人'] || '').trim(),
      确认人: String(d['确认人'] || '').trim(),
    },
    明细: Array.isArray(d['明细']) ? d['明细'] : [],
  }
}
