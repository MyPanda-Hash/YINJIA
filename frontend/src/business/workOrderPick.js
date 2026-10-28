/**
 * workOrderPick.js — 工单扫码领料的纯逻辑(2026-10-21)
 *
 * 为什么单独一个模块:工单码解析、BOM 展开对账、秤值有效性判断全是纯函数,
 * 能直接被 `node --test` 钉住边界;页面组件(views/scm/WorkOrderPick.vue)只负责交互与请求。
 *
 * 业务流程(用户 2026-10-21 口径):
 *   扫工单码 → 显示工单内容 → 按 BOM 列出该工单要领哪些料
 *   → 一项项扫物料码 → 自动抓台车电子秤数量 → 提交本笔
 *   → 全部领完 → 整单提交,写进材料出库单(资料表)
 *
 * 码格式(沿用既有约定,不新造):
 *   · 工单码 = `公司代码@工单号@(1000+工单行号)`,行号 3 位补零
 *     (见 print-formats.js:157 woQrText,2026-10-09 规则改版)
 *   · 物料码 = `存货编码|批号`(见 scanPick.js parseBarcode,条码管理三面板固定格式)
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
 * @param {string} raw 扫码枪或手工输入的原串
 * @returns {{ ok: boolean, company: string, orderNo: string, lineNo: number, reason?: string }}
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
  if (!lineRaw) return { ok: true, company, orderNo, lineNo: 0 }
  const n = Number(lineRaw)
  if (!Number.isFinite(n)) return { ok: false, company, orderNo, lineNo: 0, reason: 'bad-line' }
  const lineNo = n >= 1000 ? n - 1000 : n
  return { ok: true, company, orderNo, lineNo }
}

/**
 * 把 BOM(mate 行)按工单排产数量折算成「应领数量」。
 *
 * 口径:BOM 里的 标准用量(bzl) 是**生产 1 个单位成品**的用量,
 * 故应领 = 标准用量 × 排产数量 + 损耗量。
 *
 * 数量按 4 位小数收敛(与 MATERIAL_OUT 的 decimal(18,4) 对齐),避免浮点尾差。
 *
 * @param {any[]} bomRows WLBOM/mate 的明细行(含 子件代码/子件名称/标准用量/损耗量/子件单位)
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
 * 扫一个物料码 → 在领料清单里找到对应行并累加数量。
 *
 * 匹配口径:**只按存货编码**(与 scanPick.matchPickRows 同一教训)——
 * 条码视图的批号是采购入库派生的(日期码+流水),而 kucun 里实际批号是 SX-20261007 这类,
 * 按「编码+批号」全等匹配实测 0 命中、只按编码则全中。批号仅随行记录,不做过滤。
 *
 * 找不到编码时**不猜**:返回 miss,由页面提示「该物料不在本工单 BOM 里」。
 *
 * @param {any[]} lines expandBom 的结果(会被就地更新 picked/remain)
 * @param {{ code: string, batch: string }} parsed parseBarcode 的结果
 * @param {number} qty 本次数量(来自电子秤或手输)
 * @returns {{ ok: boolean, reason?: 'miss'|'no-qty'|'exceed', line?: any, index?: number }}
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
  // 超领不拦死(现场常有多领一点),只把超出量标出来由页面提示;
  // 真正的库存校验在服务端 StockLedgerService,这里只做界面提示。
  line.picked = picked
  line.remain = Math.round((Number(line.required) - picked) * 10000) / 10000
  return { ok: true, line, index: idx, exceed: line.remain < 0 }
}

/**
 * 判定电子秤读数是否可用于领料。
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
 * 把已确认的领料行拼成「材料出库单」的 formData(整单提交)。
 *
 * 字段名必须与 MATERIAL_OUT 面板的 yj_field label 一致(数据键中文,ADR-0001):
 *   表头必填 = 单据日期 / 单据编号 / 业务类型(单据编号留空由后端 FormNoService 生成)
 *   明细必填 = 材料名称 / 计量单位 / 数量
 * 另带 加工单号 + 工单行号,让审核出库后 ManuWritebackService 能按行回写 plang.ll_no2。
 *
 * @param {{ orderNo: string, lineNo: number, warehouse?: string, lines: any[] }} p
 * @returns {object}
 */
export function buildPickForm(p) {
  const today = new Date().toISOString().slice(0, 10)
  const picked = (Array.isArray(p?.lines) ? p.lines : []).filter((l) => Number(l.picked) > 0)
  const items = picked.map((l, i) => ({
    行号: String(i + 1),
    材料编码: String(l.code || '').trim(),
    材料名称: String(l.name || '').trim(),
    计量单位: String(l.uom || '').trim(),
    数量: Math.round(Number(l.picked) * 10000) / 10000,
    仓库: String(p.warehouse || '').trim(),
    明细备注: '工单扫码领料',
  }))
  return {
    单据日期: today,
    单据编号: '',                 // 后端生成
    业务类型: '生产领料',
    加工单号: String(p?.orderNo || '').trim(),
    工单行号: String(p?.lineNo || 0),
    仓库: String(p?.warehouse || '').trim(),
    单据状态: '草稿',
    备注: '工单扫码领料(手机端)',
    detail: { items },
  }
}

/**
 * 汇总进度:已领行数 / 总行数,以及是否可整单提交。
 *
 * 整单提交的判据 = **每一行都已领**(picked > 0),而不是「已领满 required」——
 * 现场允许少领(某料不足),由仓库在材料出库单里按实发调整。
 *
 * @param {any[]} lines expandBom 的结果
 * @returns {{ total: number, done: number, allPicked: boolean, anyPicked: boolean }}
 */
export function pickProgress(lines) {
  const arr = Array.isArray(lines) ? lines : []
  const total = arr.length
  const done = arr.filter((l) => Number(l.picked) > 0).length
  return { total, done, allPicked: total > 0 && done === total, anyPicked: done > 0 }
}
