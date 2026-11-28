/**
 * shipNote.js — 「出货单」(销售出库单对外联单)版式与取数
 *
 * ── 用户口径(2026-11-28)──
 * 「现在需要同步下拉销售出库单,并且销售出库要打印报表,需求是分批次号的明细,
 *   根据同一物料成一行来打印。」
 *   ⇒ 明细在库里是**按批次/按行**的(同一物料可能有好几行),纸上要**同一物料合成一行**:
 *     数量求和,批号全部塞进「备注」列(逗号分隔、去重、保持出现顺序)。
 *   ⇒ 版式照用户给的纸样(出货单):公司抬头 + 客户编码/客户名称/出货日期 + 8 列明细 +
 *     合计行 + 说明 + 物流/仓管/财务/品质/客户 签字行 + 五联说明。
 *
 * ── 取数口径(为什么是这些键)──
 * 数据来自 `engine.getFormDescriptor(panelCode, code)`:`data` = 表头、`detailData` 首页签 = 明细行,
 * 两者都是**按 yj_field.label 命名的中文键**(不是物理列名)。所以这里读的是
 *   表头:单据编号 / 单据日期 / 客户 / 客户编码 / 销售订单号
 *   明细:存货编码 / 存货名称 / 规格型号 / 计量单位 / 数量 / 批次号(物理列 批号)/ 源单编号
 *   · 「订单编号」列 = 行级「源单编号」(= 金蝶 src_bill_no,即**销售订单号**),行上没有才退回表头
 *     「销售订单号」—— 用户纸样里同一张出库单的两行订单编号是不同的(R1=LZW-20261116-05、
 *     R2=LZW-20261127-02),说明它必须按行取,不能取表头。
 *   · 「产品整体规格」= 存货的 规格型号(如 `L: 275±0.5mm`),不是研发面板那个同名标签。
 *
 * ── 批号的两个坑(都按「别印废话」处理)──
 *   ① 金蝶对**无批次管理的商品**一律写占位批号 `PC0000`(见 AGENTS §2.4),MES 同步进来的行
 *      大批就是这个值 ⇒ 印在联单上等于没信息,故 PLACEHOLDER_BATCHES 里的值直接滤掉;
 *   ② 同一物料的多个批次**去重**(同批号出现两次多半是同批拆行),但**保持出现顺序**,
 *      不排序 —— 车间按先进先出登记,顺序本身有信息。
 *
 * ── 版面常量(改文案只动这里)──
 * 公司抬头与「说明」固定条款抄自用户纸样;签字行的人名是纸样上预印的(仓管 蒋小刚 / 财务 叶健乐 /
 * 品质 冯敏),换人只改 SHIP_NOTE_SIGNERS 一处(纸样本来就是预印联单,不是每次现填)。
 */
// 相对路径 + 扩展名:本文件被 `node --test` 直接加载(不认 Vite 别名),见 print-formats.js 同款注释
import { sumKeepScale } from '../core/panel/sumTotals.js'
import { printInPage } from '../core/panel/printChannel.js'

/** 公司抬头(与 print-formats.js 的 COMPANY 同源,这里只取出货单用到的四项) */
export const SHIP_NOTE_HEAD = {
  name: '惠州市银嘉环保科技有限公司',
  en: 'AGplus Technologies Co.,Ltd',
  tel: '0752-5583930',
  fax: '0752-5583930',
}

/** 占位批号:金蝶无批次商品统一填这个值,印在联单上没有意义 */
export const PLACEHOLDER_BATCHES = ['PC0000']

/**
 * 签字行:`标签：` + (可选)预印人名 + 手签横线 —— **五格都有横线**(用户 2026-11-28 二次口径
 * 「这3个也有横线」:仓管/财务/品质 也要和物流/客户一样有手签线)。
 *
 * - `name` 非空 = 纸样预印人名(印在线的左边,粗体);空 = 只留标签 + 横线手签。
 * - `w` = 手签横线长度(px),按格宽给:物流 92 / 仓管·财务·品质 76 / 客户 120。
 *
 * 🔴 别把线的样式改回 `height:1px + vertical-align:middle`(2026-11-28 用户报的第一版问题):
 * 那样线会浮在文字中间、不像下划线;现在是 `height:1em + vertical-align:baseline`(压在文字基线上)。
 */
export const SHIP_NOTE_SIGNERS = [
  { label: '物流', name: '', w: 92 },
  { label: '仓管', name: '蒋小刚', w: 76 },
  { label: '财务', name: '叶健乐', w: 76 },
  { label: '品质', name: '冯敏', w: 76 },
  { label: '客户', name: '', w: 120 },
]

/** 说明条款(用户纸样原文) */
export const SHIP_NOTE_NOTE = '说明：货物数量及规格请当面点清验收，有关质量问题交货三日内提出，逾期不予退货。'

/** 五联说明(用户纸样原文) */
export const SHIP_NOTE_COPIES = '第一联（白色）：财务　　第二、三联（红色、蓝色）：客户　　第四联（绿色）：仓管　　第五联（黄色）：客户签收回单'

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtDate = (v) => (v === null || v === undefined || v === '' ? '' : String(v).slice(0, 10).replace('T', ' '))
const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : String(n)
}

/** 明细行的批号:label 是「批次号」,物理列叫「批号」。两种键都认(在线数据/探针数据都可能给) */
const batchOf = (line) => str(line?.['批次号']) || str(line?.['批号'])

/**
 * 明细行 → 出货单行(**同一物料合成一行**)。
 *
 * 合并键 = `存货编码 + 计量单位`:
 *   · 只用存货编码不够 —— 同一物料偶尔会两种单位并存(件/支),数量直接相加会算错;
 *   · 编码为空的行跳过(明细区常见的占位空行 / 手工加行)。
 *
 * @param {Array<Object>} lines 明细行(中文键)
 * @param {Object} [doc] 表头(取「销售订单号」作订单编号兜底)
 * @returns {Array<{订单编号:string,产品编码:string,产品种类:string,产品整体规格:string,数量:number|null,单位:string,备注:string}>}
 */
export function shipNoteRows(lines, doc = {}) {
  const out = []
  const byKey = new Map()
  const headOrder = str(doc?.['销售订单号'])
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line) continue
    const code = str(line['存货编码'])
    const name = str(line['存货名称'])
    if (!code && !name) continue // 空行
    const unit = str(line['计量单位'])
    const key = (code || name) + '\u0001' + unit
    let row = byKey.get(key)
    if (!row) {
      row = {
        订单编号: '',
        产品编码: code || name,
        产品种类: name,
        产品整体规格: str(line['规格型号']),
        数量: null,
        单位: unit,
        备注: '',
        // 内部暂存:算合计与拼备注用,出参时删掉
        _qty: [],
        _orders: [],
        _batches: [],
      }
      byKey.set(key, row)
      out.push(row)
    }
    row._qty.push(line['数量'])
    const order = str(line['源单编号']) || headOrder
    if (order && !row._orders.includes(order)) row._orders.push(order)
    const batch = batchOf(line)
    if (batch && !PLACEHOLDER_BATCHES.includes(batch) && !row._batches.includes(batch)) row._batches.push(batch)
  }
  return out.map((r) => ({
    订单编号: r._orders.join(', '),
    产品编码: r.产品编码,
    产品种类: r.产品种类,
    产品整体规格: r.产品整体规格,
    数量: sumKeepScale(r._qty) ?? 0,
    单位: r.单位,
    备注: r._batches.join(', '),
  }))
}

/** 合计数量(逐行求和;口径与明细一致,不重算原始行) */
export function shipNoteTotal(rows) {
  const list = Array.isArray(rows) ? rows : []
  return sumKeepScale(list.map((r) => r['数量'])) ?? 0
}

/**
 * 出货单 HTML(纯函数:不碰 DOM,可单测)。
 * 版式常量按用户纸样:8 列 + 合计行 + 说明 + 签字行 + 五联说明,A4 纵向。
 */
export function shipNoteHtml(doc, lines) {
  const d = doc || {}
  const rows = shipNoteRows(lines, d)
  const total = shipNoteTotal(rows)
  // 明细有几行就印几行(**不铺空行**):用户纸样只有 2 行明细、下面直接就是合计行,
  // 铺空行会让「合计」离明细太远、像漏填(退货单/送货单那两张是手写预留行,这里不是)。
  const trs = rows.map((r, i) => '<tr>'
    + `<td class="c">${i + 1}</td>`
    + `<td>${esc(r['订单编号'])}</td>`
    + `<td>${esc(r['产品编码'])}</td>`
    + `<td>${esc(r['产品种类'])}</td>`
    + `<td>${esc(r['产品整体规格'])}</td>`
    + `<td class="r">${esc(fmtNum(r['数量']))}</td>`
    + `<td class="c">${esc(r['单位'])}</td>`
    + `<td>${esc(r['备注'])}</td>`
    + '</tr>').join('')
  // 五格同一套:标签 + (预印人名,粗体)+ 手签横线(2026-11-28 用户口径「这3个也有横线」)
  const sign = SHIP_NOTE_SIGNERS.map((s) => `<span>${esc(s.label)}：`
    + (s.name ? `<b>${esc(s.name)}</b>` : '')
    + `<i class="line" style="width:${Number(s.w) || 90}px"></i></span>`).join('')
  return '<style>'
    + '@page{size:A4 portrait;margin:12mm 10mm}'
    + '.hd{text-align:center}'
    + '.hd .cn{font-size:21px;font-weight:700;letter-spacing:2px}'
    + '.hd .en{font-size:13px;margin:2px 0}'
    + '.hd .tel{font-size:12px;margin-bottom:10px}'
    + 'h1{font-size:19px;text-align:center;margin:6px 0 12px;letter-spacing:14px;font-weight:700}'
    + '.top{display:flex;gap:10px;margin-bottom:6px;font-size:12px}'
    + '.top .f{white-space:nowrap}'
    + '.top .v{display:inline-block;border-bottom:1px solid #333;padding:0 6px 1px;min-width:70px}'
    + '.top .grow{flex:1}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #333;padding:4px 5px;font-size:12px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f4f4f4;font-weight:600;text-align:center}'
    + 'td.r{text-align:right}td.c{text-align:center}'
    + 'tr.sum td{font-weight:600}'
    // 页脚三段(说明 / 签字行 / 五联):各留一点间距,不再挤成一坨;
    // 手签横线用 `height:1em + vertical-align:baseline` 压在文字基线上(原来 1px+middle 会浮在字中间)
    + '.note{margin-top:12px;font-size:12px;line-height:1.8}'
    + '.sign{display:flex;align-items:baseline;gap:10px;margin-top:8px;font-size:12px;line-height:1.8}'
    + '.sign span{flex:1;white-space:nowrap}'
    + '.sign i.line{display:inline-block;height:1em;vertical-align:baseline;border-bottom:1px solid #333;margin-left:4px}'
    + '.copies{margin-top:8px;font-size:11px;line-height:1.6;color:#222}'
    + '</style>'
    + '<div class="hd"><div class="cn">' + esc(SHIP_NOTE_HEAD.name) + '</div>'
    + `<div class="en">${esc(SHIP_NOTE_HEAD.en)}</div>`
    + `<div class="tel">电话：${esc(SHIP_NOTE_HEAD.tel)}／传真：${esc(SHIP_NOTE_HEAD.fax)}</div></div>`
    + '<h1>出货单</h1>'
    + '<div class="top">'
    + `<span class="f">客户编码：<span class="v">${esc(d['客户编码'])}</span></span>`
    + '<span class="grow"></span>'
    + `<span class="f">客户名称：<span class="v">${esc(d['客户'])}</span></span>`
    + '<span class="grow"></span>'
    + `<span class="f">出货日期：<span class="v">${esc(fmtDate(d['单据日期']))}</span></span>`
    + '</div>'
    + '<table>'
    + '<colgroup>'
    + '<col style="width:6%"/><col style="width:15%"/><col style="width:12%"/>'
    + '<col style="width:23%"/><col style="width:15%"/><col style="width:8%"/>'
    + '<col style="width:6%"/><col style="width:15%"/>'
    + '</colgroup>'
    + '<thead><tr>'
    + ['序号', '订单编号', '产品编码', '产品种类', '产品整体规格', '数量', '单位', '备注']
      .map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs
    + '<tr class="sum"><td colspan="5" class="c">合计</td>'
    + `<td class="r">${esc(fmtNum(total))}</td><td></td><td></td></tr>`
    + '</tbody></table>'
    + `<div class="note">${esc(SHIP_NOTE_NOTE)}</div>`
    + `<div class="sign">${sign}</div>`
    + `<div class="copies">${esc(SHIP_NOTE_COPIES)}</div>`
}

/**
 * 打印出货单(页面内打印层 + window.print(),与全系统同一条出纸通道)。
 * @param {Object} doc 表头(中文键)
 * @param {Array<Object>} lines 明细行(中文键)
 * @returns {boolean} true=已交给浏览器打印
 */
export function printShipNote(doc, lines, opts) {
  const no = str(doc?.['单据编号']) || str(doc?.['编号']) || ''
  const ok = printInPage('出货单-' + no, shipNoteHtml(doc, lines), opts)
  if (!ok) alert('打印失败:浏览器阻止了打印,请允许本页面弹出打印对话框')
  return ok
}
