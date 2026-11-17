/**
 * mixScan.js — 手机扫码 · **扫码混料**的纯逻辑(2026-11-18)
 *
 * <h3>用户口径(原话)</h3>
 * 「在手机扫码里面加一个扫码混料的面版。逻辑:扫工单码,带出一级BOM(就是物料清单,
 *  之前生产领料的是组装物料清单),逐项扫物料码,自动获取电子秤的数量,
 *  提交保存一笔,全部扫完,整单保存。保存后自动打印,并且保留单据,重新扫码后进入可以补打印。」
 *
 * <h3>为什么单独一个模块</h3>
 * 工单码解析、BOM 展开、秤值有效性、纸面载荷拼装全是纯函数,能被 `node --test` 钉住边界;
 * 页面组件(views/mobile/MobileMixScan.vue)只负责交互与请求。
 *
 * <h3>码格式(沿用既有约定,不新造)</h3>
 * · 工单码 = `公司代码@工单号@(1000+工单行号)`,行号 3 位补零
 *   (见 print-formats.js 的 woQrText,2026-10-09 规则改版);
 * · 物料码 = `存货编码|批号`(见 scanPick.js 的 parseBarcode,条码三面板固定格式)。
 *
 * <h3>与「工单扫码领料」(2026-11-18 删除)的关系</h3>
 * 码解析、BOM 展开、秤读数校验这三段是那次留下的**同一套口径**(工单码和秤是同一个数据源),
 * 原样搬过来继续用;变的是出口:以前整单提交生成**材料出库单**,
 * 现在逐笔落**混料记录**(wo_mixing_list),整单保存只取单号 + 置标记。
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
 * <p>2026-11-19:页面查询框与「生产领料」一致,**允许直接敲工单号**(没有码纸时不必先找码)。
 * 该行为由 `opt.plainOrderNo` 显式开启,默认仍拒绝 —— 否则物料码
 * `YJ-SX-001|2026...` 会被误判成工单号(既有单测钉住了这条)。
 *
 * @param {string} raw 扫码枪或手工输入的原串
 * @param {{ plainOrderNo?: boolean }} [opt] plainOrderNo:不带 @ 的纯工单号(只认"像单号"的串)
 * @returns {{ ok: boolean, company: string, orderNo: string, lineNo: number, reason?: string }}
 */
export function parseWorkOrderQr(raw, opt = {}) {
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return { ok: false, company: '', orderNo: '', lineNo: 0, reason: 'empty' }
  const parts = text.split('@')
  if (parts.length < 2) {
    // 手工敲的纯工单号:必须"像单号"(无 | 这个物料码分隔符、有数字),否则仍按 no-order 拒绝
    if (opt.plainOrderNo && /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(text) && /\d/.test(text)) {
      return { ok: true, company: '', orderNo: text, lineNo: 0 }
    }
    return { ok: false, company: '', orderNo: '', lineNo: 0, reason: 'no-order' }
  }
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

/**
 * 把**一级BOM(物料清单 mate 行)**按工单排产数量折算成「应投料量」。
 *
 * 口径:BOM 里的 标准用量(bzl) 是**生产 1 个单位成品**的用量,
 * 故应投 = 标准用量 × 排产数量 + 损耗量。
 *
 * 数量按 4 位小数收敛(与 wo_mixing_list 的 decimal(18,8) / 界面显示对齐),避免浮点尾差。
 *
 * @param {any[]} bomRows 物料清单明细行(含 子件代码/子件名称/子件单位/标准用量/损耗量)
 * @param {number} planQty 排产数量
 * @returns {{ code: string, name: string, uom: string, required: number, loss: number, picked: number, remain: number }[]}
 */
export function expandBom(bomRows, planQty) {
  const qty = Number(planQty) || 0
  const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000
  const out = []
  for (const r of Array.isArray(bomRows) ? bomRows : []) {
    const code = String(r['子件代码'] || r['材料编码'] || '').trim()
    if (!code) continue
    const per = Number(r['标准用量']) || 0
    const loss = Number(r['损耗量']) || 0
    const required = round4(per * qty + loss)
    out.push({
      code,
      name: String(r['子件名称'] || r['材料名称'] || '').trim(),
      uom: String(r['子件单位'] || r['计量单位'] || '').trim(),
      required,
      loss: round4(loss),
      picked: 0,
      remain: required,
    })
  }
  return out
}

/**
 * 扫一个物料码 → 在混料清单里找到对应行并累加**已记**数量。
 *
 * 匹配口径:**只按存货编码**(与 scanPick.matchPickRows 同一教训)——
 * 条码视图的批号是采购入库派生的,和 kucai 里的批号常常对不上,按「编码+批号」全等实测 0 命中。
 *
 * 找不到编码时**不猜**:返回 miss,由页面提示「该物料不在本工单的物料清单里」。
 *
 * @param {any[]} lines expandBom 的结果(会被就地更新 picked/remain)
 * @param {{ code: string, batch?: string }} parsed parseBarcode 的结果
 * @param {number} qty 本次实际用量(来自电子秤或手输)
 * @returns {{ ok: boolean, reason?: 'miss'|'no-qty', line?: any, index?: number, exceed?: boolean }}
 */
export function applyScan(lines, parsed, qty) {
  const code = String(parsed?.code || '').trim()
  if (!code) return { ok: false, reason: 'miss' }
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: 'no-qty' }
  const idx = (Array.isArray(lines) ? lines : []).findIndex((l) => String(l.code || '').trim() === code)
  if (idx < 0) return { ok: false, reason: 'miss' }
  const line = lines[idx]
  const picked = Math.round((Number(line.picked) + n) * 10000) / 10000
  // 超投不拦死(现场常有多投一点),只把超出量标出来由页面提示;
  // 真正的对账在混料记录里,系统不在这里做库存校验。
  line.picked = picked
  line.remain = Math.round((Number(line.required) - picked) * 10000) / 10000
  return { ok: true, line, index: idx, exceed: line.remain < 0 }
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
 * 汇总进度:已记行数 / 总行数,以及是否可整单保存。
 *
 * 整单保存的判据 = **每一行都有实际用量**(picked > 0)。
 * 页面据此把「整单保存」按钮点亮,并提示还差几项。
 *
 * @param {any[]} lines expandBom 的结果
 * @returns {{ total: number, done: number, allDone: boolean, anyDone: boolean, remainCount: number }}
 */
export function mixProgress(lines) {
  const arr = Array.isArray(lines) ? lines : []
  const total = arr.length
  const done = arr.filter((l) => Number(l.picked) > 0).length
  return { total, done, allDone: total > 0 && done === total, anyDone: done > 0, remainCount: total - done }
}

/**
 * 拼「提交保存一笔」的请求体(POST /px/mix/scan)。
 *
 * 字段名与后端 {@code MixScanService.saveScan} 逐字对应(数据键中文,ADR-0001)。
 *
 * @param {{ order?: object, line?: object, qty: number, uom?: string }} p
 *   order = 工单行({工单号, 工单行号, 行id, 产品编码, 产品名称});
 *   line  = expandBom 的一行({code,name,uom,required});
 *   qty   = 本次实际用量(秤或手输)
 * @returns {object} 请求体
 */
export function buildScanPayload(p) {
  const order = p?.order || {}
  const line = p?.line || {}
  const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000
  return {
    工单号: String(order.orderNo || '').trim(),
    工单行id: Number.isFinite(Number(order.lineId)) && Number(order.lineId) > 0 ? Number(order.lineId) : undefined,
    工单行号: Number(order.lineNo) || 0,
    产品编码: String(order.productCode || '').trim(),
    产品名称: String(order.productName || '').trim(),
    物料编号: String(line.code || '').trim(),
    物料名称: String(line.name || '').trim(),
    // 物料批次(2026-11-18 第二轮):物料码是 `存货编码|批号`,批号随码带下来 ——
    // 纸面《成型配料记录》有「物料批次」一列,不存下来就印不出来。
    物料批次: String(p?.batch || '').trim(),
    计划用量: round4(line.required),
    实际用量: round4(p?.qty),
    单位: String(line.uom || p?.uom || '').trim(),
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

