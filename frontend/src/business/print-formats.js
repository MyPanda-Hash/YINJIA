/**
 * print-formats.js — 固定版式纸质单据打印(2026-09-23)
 * 现有版式:
 *   ① 银嘉采购订单(用户截图,PU_ORDER 打印):头部信息+物料行表+总计+注意事项+供/需方签章框;
 *   ② 退货单(用户截图,QC_RETURN 暂收退料单 打印):公司抬头+供应商/退货日期+行表+说明+签章行;
 *   ③ 二维码标签(2026-09-24,INV 勾选即打):75×100mm 七字段标签;
 *     ③b 库位标识卡(2026-09-28,WHLOC 勾选即打):同款 75×100mm,卡面=仓库/库位地址/库位编码,二维码=仓库@库位地址@库位编码;
 *   ④ 生产任务单(打印工单,2026-09-24):横向 A4 一表多行+行尾二维码=公司代码@工单号@1000+行号(2026-10-09 规则改版,woQrText)。
 * 打印通道:新窗口 HTML + window.print()(同 QrLabelDialog,绕开 jsPDF §5.5 坑);
 * 版面文字(公司抬头/注意事项/需方联系/生产任务单表头)为固定版式常量,改文案只动本文件。
 * 业务单据为纸面事实格式,不入 tt() 翻译层(ADR-0001)。
 */
import * as QRCodeMod from 'qrcode'

/** qrcode 库兼容取用:CJS 互操作下 toDataURL 可能挂在 .default 上 */
function qrLib() {
  if (typeof QRCodeMod?.toDataURL === 'function') return QRCodeMod
  if (typeof QRCodeMod?.default?.toDataURL === 'function') return QRCodeMod.default
  return null
}

const COMPANY = {
  name: '惠州市银嘉环保科技有限公司',
  en: 'AGplus Technologies Co., Ltd',
  tel: '0752-5583930',
  fax: '0752-5583930',
  // 银嘉采购订单 抬头行
  brand: 'AGPLUS 银嘉',
  // 公司代码(2026-09-28 物料二维码口径):取旧系统 plang.comm,全库唯一值 '0';
  // 标识卡二维码前缀=公司代码@物料编码[@批号],与旧系统扫码解析口径一致
  companyCode: '0',
  // 需方签章框
  buyer: { 单位名称: '惠州市银嘉环保科技有限公司', 联系人: '孙郝聪', 联系方式: '13718162430' },
  // 生产任务单(打印工单)固定表头文字
  woTitle: '生产任务单',
  woLineLabel: '线体',
  woPreparedBy: '制单',
  woColumns: ['序', '客户', '成品品名', '批号', '规格', '重点管控', 'PO单号', '排产数量', '每箱数量', '盘数', '交期', '备注', '二维码'],
  // 银嘉采购订单 注意事项(固定条款,转录自用户提供的纸面格式)
  notes: [
    '1.交货要求：供应商应在收到订单的24小时内回复是否可以按照要求日期交货，如未回复，视为同意我方交期要求，逾期对我方造成的损失，我方保留追究供应商责任的权利。',
    '2.品质要求：来料必须符合我方对产品的品质标准。',
    '3.包装要求：必须为外包装标识卡片且只有一个标识卡，同种物料标签需统一。',
    '4.标签要求：每批来料必须清楚地标签，标签单上面的物料名称、数量须与本订单合同保持一致，来料解送到我司仓库；对送货单未注明标识的产品，我司有权拒收或退回。',
    '5.验收标准：我方在收到货后的15天内检验并开出品质异议，包括订单数量、品质等。',
  ],
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtDate = (v) => (v == null || v === '' ? '' : String(v).slice(0, 10).replace('T', ' '))
const fmtNum = (v) => {
  const n = Number(v)
  return v == null || v === '' || Number.isNaN(n) ? '' : String(n)
}

/** 新窗口打开打印(自动调起 print 对话框);宽表横向由各自 @page 控制 */
function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank', 'width=1100,height=780')
  if (!w) return false
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>'
    + '@page{size:A4 portrait;margin:10mm}'
    + 'body{font-family:"Microsoft YaHei",system-ui,sans-serif;margin:0;color:#111;font-size:12px}'
    + '</style></head><body>' + bodyHtml
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},200)}</scr' + 'ipt></body></html>')
  w.document.close()
  return true
}

/**
 * 生产任务单三模板(2026-09-27 用户截图版式,生产工单列表/工单排产看板共用):
 *   成型生产任务单——横向 A4,列含 成型折算后数量;组装生产任务单——同列结构无折算列;
 *   行尾二维码 = 公司代码@工单号@(1000+工单行号)(woQrText,2026-10-09 规则改版;旧 工单号|批号|物料编码|排产数量|生产线 作废)。
 * @param title '成型生产任务单' | '组装生产任务单'
 * @param rows  [{单据编号,公司代码?,工单行号?,是否重点管控产品,商品编码,商品名称,规格型号,订单数量,成型折算后数量,计划完工日期,批号,物料编码,排产数量,生产线}]
 */
/** 工单二维码内容(2026-10-09 规则改版):公司代码@工单号@(1000+工单行号),行号 3 位不足补 0。
 *  例:0@GD2608100001@1003 —— 尾段 = '1' + 3位行号补0 = 1000+行号;行号缺省按 1(MANU_ORDER 单行工单),
 *  公司代码缺省取 COMPANY.companyCode(plang.comm 全库唯一 '0')。扫码报工/领料按本口径解析。 */
export function woQrText(wo) {
  const no = String(wo?.['工单号'] ?? wo?.['单据编号'] ?? wo?.['合同号'] ?? wo?.['加工单号'] ?? '').trim()
  const xc = Number.parseInt(wo?.['工单行号'], 10)
  const comm = String(wo?.['公司代码'] ?? '').trim() || COMPANY.companyCode
  return `${comm}@${no}@${1000 + (Number.isFinite(xc) ? xc : 1)}`
}

const TASK_SHEET_COLUMNS = {
  '成型生产任务单': ['单据编号', '是否重点管控产品', '商品编码', '商品名称', '规格型号', '订单数量', '成型折算后数量', '计划完工日期'],
  '组装生产任务单': ['单据编号', '是否重点管控产品', '商品编码', '商品名称', '规格型号', '订单数量', '计划完工日期'],
}

export async function printWorkTaskSheet(title, rows, opts = {}) {
  const cols = TASK_SHEET_COLUMNS[title]
  if (!cols) return false
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r['单据编号'])
  if (!list.length) return false
  const line = opts.line || ''
  const user = opts.preparedBy || ''
  const stamp = (() => { const n = new Date(); return `${n.getFullYear()}/${n.getMonth() + 1}/${n.getDate()} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}` })()
  const trs = []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    let qr = ''
    try {
      const lib = qrLib()
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(woQrText(r), { margin: 1, errorCorrectionLevel: 'M' })
    } catch (e) { console.warn('[print-formats] 工单二维码生成失败:', e?.message || e) }
    trs.push('<tr><td>' + (i + 1) + '</td>'
      + `<td>${esc(r['单据编号'])}</td><td>${esc(r['是否重点管控产品'])}</td>`
      + `<td>${esc(r['商品编码'])}</td><td>${esc(r['商品名称'])}</td><td>${esc(r['规格型号'])}</td>`
      + `<td class="r">${esc(fmtNum(r['订单数量']))}</td>`
      + (title === '成型生产任务单' ? `<td class="r">${esc(fmtNum(r['成型折算后数量']))}</td>` : '')
      + `<td>${esc(r['计划完工日期'])}</td>`
      + `<td class="qr">${qr ? `<img src="${qr}"/>` : ''}</td></tr>`)
  }
  const ths = '<th>序号</th><th>单据编号</th><th>是否重点管控产品</th><th>商品编码</th><th>商品名称</th><th>规格型号</th><th>订单数量</th>'
    + (title === '成型生产任务单' ? '<th>成型折算后数量</th>' : '') + '<th>计划完工日期</th><th>二维码</th>'
  const body = '<style>'
    + '@page{size:A4 landscape;margin:8mm}'
    + 'body{font-family:"Microsoft YaHei",system-ui,sans-serif;margin:0;color:#111;font-size:12px}'
    + '.hd{display:flex;align-items:baseline;gap:18px;margin-bottom:6px}'
    + '.hd .t{flex:1;text-align:center;font-size:20px;font-weight:700;letter-spacing:6px}'
    + '.hd .s{font-size:12px;color:#333;white-space:nowrap}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.qr{text-align:center;padding:2px}td.qr img{width:64px;height:64px}'
    + '</style>'
    + '<div class="hd"><span class="s">' + esc(COMPANY.woLineLabel) + ': ' + esc(line) + '</span>'
    + '<span class="t">' + esc(title) + '</span>'
    + '<span class="s">' + esc(COMPANY.woPreparedBy) + ': ' + esc(user) + '　' + esc(stamp) + '</span></div>'
    + '<table><thead><tr>' + ths + '</tr></thead><tbody>' + trs.join('') + '</tbody></table>'
  if (!openPrintWindow(title, body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

/**
 * 生产投料单(2026-09-27 用户截图版式):纵向 A4,每工单一页——
 * 公司抬头 + 单据信息块(单据编号/产品编码/产品名称/产品规格/数量/客户名称/计划完工日期)
 * + 物料投料明细表(数量=定额数量×需求数量,由调用方算好传入) + 制单人落款。
 * @param orders [{单据编号,产品编码,产品名称,产品规格,数量,客户名称,计划完工日期,制单人,bom:[{物料编码,物料名称,规格型号,数量,单位,行备注}]}]
 */
export async function printFeedingSheet(orders, opts = {}) {
  const list = (Array.isArray(orders) ? orders : []).filter((o) => o && o['单据编号'])
  if (!list.length) return false
  const blocks = []
  for (let i = 0; i < list.length; i++) {
    const o = list[i]
    const bom = Array.isArray(o.bom) ? o.bom : []
    const trs = bom.map((b, bi) => '<tr><td>' + (bi + 1) + '</td>'
      + `<td>${esc(b['物料编码'])}</td><td>${esc(b['物料名称'])}</td><td>${esc(b['规格型号'])}</td>`
      + `<td class="r">${esc(fmtNum(b['数量']))}</td><td>${esc(b['单位'])}</td><td>${esc(b['行备注'])}</td></tr>`).join('')
    blocks.push(
      '<div class="fs-company">' + esc(COMPANY.name) + '</div>'
      + '<div class="fs-en">' + esc(COMPANY.en) + '</div>'
      + '<div class="fs-tel">电话：' + esc(COMPANY.tel) + ' / 传真：' + esc(COMPANY.fax) + '</div>'
      + '<div class="fs-title">生产投料单</div>'
      + '<table class="fs-info">'
      + '<tr><td class="k">单据编号：</td><td>' + esc(o['单据编号']) + '</td><td class="k">产品编码：</td><td>' + esc(o['产品编码']) + '</td><td class="k">产品名称：</td><td>' + esc(o['产品名称']) + '</td></tr>'
      + '<tr><td class="k">产品规格：</td><td>' + esc(o['产品规格']) + '</td><td class="k">数　　量：</td><td>' + esc(fmtNum(o['数量'])) + '</td><td class="k">客户名称：</td><td>' + esc(o['客户名称']) + '</td></tr>'
      + '</table>'
      + '<table class="fs-bom"><thead><tr><th style="width:36px">序号</th><th>物料编码</th><th>物料名称</th><th>规格型号</th><th style="width:90px">数量</th><th style="width:60px">单位</th><th>行备注</th></tr></thead><tbody>'
      + (trs || '<tr><td colspan="7" style="text-align:center;color:#888">（无 BOM 明细）</td></tr>') + '</tbody></table>'
      + '<div class="fs-foot">制单人：' + esc(o['制单人'] || '') + '　　　计划完工日期：' + esc(o['计划完工日期'] || '') + '</div>'
      + (i < list.length - 1 ? '<div style="page-break-after:always"></div>' : ''))
  }
  const body = '<style>'
    + '@page{size:A4 portrait;margin:12mm}'
    + 'body{font-family:"Microsoft YaHei",system-ui,sans-serif;margin:0;color:#111;font-size:12px}'
    + '.fs-company{text-align:center;font-size:20px;font-weight:700;letter-spacing:2px}'
    + '.fs-en{text-align:center;font-size:11px;color:#444}'
    + '.fs-tel{text-align:center;font-size:11px;color:#444;margin-bottom:4px}'
    + '.fs-title{text-align:center;font-size:18px;font-weight:700;margin:8px 0 10px;letter-spacing:6px}'
    + '.fs-info{width:100%;border-collapse:collapse;margin-bottom:8px}'
    + '.fs-info td{padding:3px 4px;font-size:12px;vertical-align:top}'
    + '.fs-info .k{color:#555;white-space:nowrap}'
    + '.fs-bom{width:100%;border-collapse:collapse}'
    + '.fs-bom th,.fs-bom td{border:1px solid #444;padding:5px 6px;font-size:12px;word-break:break-all}'
    + '.fs-bom th{background:#f2f2f2;font-weight:600}'
    + '.fs-bom .r{text-align:right}'
    + '.fs-foot{margin-top:12px;font-size:12px;text-align:right}'
    + '</style>' + blocks.join('')
  if (!openPrintWindow('生产投料单', body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

/**
 * 银嘉采购单据固定版式公共块(2026-09-28 采购入库单·无金额版与采购订单共用;改文案/版式只动这里):
 * CSS 与 品牌/注意事项/供/需签章框 两版式逐字相同——抽常量防复制粘贴,纸面事实文案不入 tt()(ADR-0001)。
 */
const PU_SHEET_CSS = '<style>'
  + '.brand{font-size:11px;color:#333;margin-bottom:2px}'
  + '.brand b{font-size:14px;color:#1e6fb8;margin-right:8px}'
  + 'h1{font-size:20px;text-align:center;margin:2px 0 10px;letter-spacing:4px;font-weight:700}'
  + '.info{display:grid;grid-template-columns:1fr 1fr;gap:6px 40px;margin:0 0 10px;font-size:12px}'
  + '.info .f{white-space:nowrap}.info .f b{font-weight:400}'
  + '.info .v{display:inline-block;min-width:180px;border-bottom:1px dotted #666;padding:0 6px 1px}'
  + '.info .v.s{min-width:80px}'
  + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
  + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
  + 'th{background:#f2f2f2;font-weight:600}'
  + 'td.r{text-align:right}td.c{text-align:center}'
  + '.sum td{background:#fafafa;font-weight:600}'
  + '.notes{margin:10px 0 8px;font-size:11px;line-height:1.55}'
  + '.notes .t{font-weight:700;font-size:12px;margin-bottom:2px}'
  + '.sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}'
  + '.sign .box{border:1px solid #444;min-height:110px;padding:6px 10px;font-size:12px;line-height:1.9}'
  + '.sign .box .t{text-align:center;font-weight:600;letter-spacing:8px;margin-bottom:4px}'
  + '</style>'
const PU_BRAND_HTML = `<div class="brand"><b>${esc(COMPANY.brand)}</b>${esc(COMPANY.en)}　${esc(COMPANY.name)}</div>`
const PU_NOTES_HTML = `<div class="notes"><div class="t">注意事项：</div>${COMPANY.notes.map((n) => `<div>${esc(n)}</div>`).join('')}</div>`
const PU_SIGN_HTML = '<div class="sign">'
  + '<div class="box"><div class="t">供　方</div>单位名称：<br/>联 系 人：<br/>联系方式：</div>'
  + `<div class="box"><div class="t">需　方</div>单位名称：${esc(COMPANY.buyer['单位名称'])}<br/>联 系 人：${esc(COMPANY.buyer['联系人'])}<br/>联系方式：${esc(COMPANY.buyer['联系方式'])}</div>`
  + '</div>'

/**
 * 银嘉采购订单
 * @param doc  头数据(单据编号/单据日期/供应商编码/供应商/付款方式)
 * @param lines 行数据(物料编码/物料名称/规格型号/单价/单位/数量/金额/预计到货日期/备注/税率%)
 */
export function printPuOrder(doc, lines) {
  const rows = (Array.isArray(lines) ? lines : []).filter((l) => l && (l['物料编码'] || l['物料名称']))
  const pad = Math.max(0, 4 - rows.length)
  const tax = rows.some((l) => Number(l['税率%']) > 0) ? '是' : '否'
  const totalQty = rows.reduce((a, l) => a + Number(l['数量'] || 0), 0)
  const totalAmt = rows.reduce((a, l) => a + Number(l['金额'] || 0), 0)
  const trs = rows.map((l) => '<tr>'
    + `<td>${esc(l['物料编码'])}</td><td>${esc(l['物料名称'])}</td><td>${esc(l['规格型号'])}</td>`
    + `<td class="r">${esc(fmtNum(l['单价']))}</td><td>${esc(l['单位'])}</td><td class="r">${esc(fmtNum(l['数量']))}</td>`
    + `<td class="r">${esc(fmtNum(l['金额']))}</td><td>${esc(fmtDate(l['预计到货日期']) || fmtDate(doc['交货日期']))}</td>`
    + `<td>${esc(l['备注'])}</td></tr>`).join('')
    + Array.from({ length: pad }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')
  const body = PU_SHEET_CSS
    + PU_BRAND_HTML
    + '<h1>银嘉采购订单</h1>'
    + '<div class="info">'
    + `<span class="f">订单编号：<span class="v">${esc(doc['单据编号'])}</span></span>`
    + `<span class="f">下单日期：<span class="v">${esc(fmtDate(doc['单据日期']))}</span></span>`
    + `<span class="f">供应商编号：<span class="v">${esc(doc['供应商编码'])}</span></span>`
    + `<span class="f">供应商名称：<span class="v">${esc(doc['供应商'])}</span></span>`
    + `<span class="f">付款方式：<span class="v s">${esc(doc['付款方式'])}</span></span>`
    + `<span class="f">是否含税：<span class="v s">${tax}</span></span>`
    + '</div>'
    + '<table><thead><tr>'
    + ['物料编码', '物料名称', '粉料规格及要求', '单价', '单位', '数量', '小计', '交期要求', '备注']
        .map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs
    + `<tr class="sum"><td colspan="5" class="c">总　计</td>`
    + `<td class="r">${esc(fmtNum(totalQty))}</td><td class="r">${esc(fmtNum(totalAmt))}</td><td></td><td></td></tr>`
    + '</tbody></table>'
    + PU_NOTES_HTML
    + PU_SIGN_HTML
  if (!openPrintWindow('银嘉采购订单-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert('浏览器拦截了打印窗口,请允许弹出窗口')
}

/**
 * 银嘉采购订单·无金额版(2026-09-28 用户澄清:不是入库单报表,是采购订单的另一种打印版式)——
 * 与 printPuOrder 同一标题/信息区(含付款方式/是否含税)/注意事项/签章框,仅三处金额内容不打印:
 * 行表去 单价/小计 两列(交期要求保留),总计行只留数量合计。
 * @param doc  头数据(同 printPuOrder)
 * @param lines 行数据(同 printPuOrder:物料编码/物料名称/规格型号/单价/单位/数量/金额/预计到货日期/备注)
 */
export function printPuOrderNoAmount(doc, lines) {
  const rows = (Array.isArray(lines) ? lines : []).filter((l) => l && (l['物料编码'] || l['物料名称']))
  const pad = Math.max(0, 4 - rows.length)
  const tax = rows.some((l) => Number(l['税率%']) > 0) ? '是' : '否'
  const totalQty = rows.reduce((a, l) => a + Number(l['数量'] || 0), 0)
  const trs = rows.map((l) => '<tr>'
    + `<td>${esc(l['物料编码'])}</td><td>${esc(l['物料名称'])}</td><td>${esc(l['规格型号'])}</td>`
    + `<td>${esc(l['单位'])}</td><td class="r">${esc(fmtNum(l['数量']))}</td>`
    + `<td>${esc(fmtDate(l['预计到货日期']) || fmtDate(doc['交货日期']))}</td>`
    + `<td>${esc(l['备注'])}</td></tr>`).join('')
    + Array.from({ length: pad }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')
  const body = PU_SHEET_CSS
    + PU_BRAND_HTML
    + '<h1>银嘉采购订单</h1>'
    + '<div class="info">'
    + `<span class="f">订单编号：<span class="v">${esc(doc['单据编号'])}</span></span>`
    + `<span class="f">下单日期：<span class="v">${esc(fmtDate(doc['单据日期']))}</span></span>`
    + `<span class="f">供应商编号：<span class="v">${esc(doc['供应商编码'])}</span></span>`
    + `<span class="f">供应商名称：<span class="v">${esc(doc['供应商'])}</span></span>`
    + `<span class="f">付款方式：<span class="v s">${esc(doc['付款方式'])}</span></span>`
    + `<span class="f">是否含税：<span class="v s">${tax}</span></span>`
    + '</div>'
    + '<table><thead><tr>'
    + ['物料编码', '物料名称', '粉料规格及要求', '单位', '数量', '交期要求', '备注']
        .map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs
    + `<tr class="sum"><td colspan="4" class="c">总　计</td>`
    + `<td class="r">${esc(fmtNum(totalQty))}</td><td></td><td></td></tr>`
    + '</tbody></table>'
    + PU_NOTES_HTML
    + PU_SIGN_HTML
  if (!openPrintWindow('银嘉采购订单(无金额)-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert('浏览器拦截了打印窗口,请允许弹出窗口')
}

/**
 * 退货单(暂收退料单)
 * @param doc  头数据(单据编号/单据日期/供应商)
 * @param lines 行数据(物料编码/物料名称/型号/数量/计量单位/不良原因/备注)
 */
export function printQcReturn(doc, lines) {
  const rows = (Array.isArray(lines) ? lines : []).filter((l) => l && (l['物料编码'] || l['物料名称']))
  const pad = Math.max(0, 4 - rows.length)
  const trs = rows.map((l) => '<tr>'
    + `<td>${esc(l['物料编码'])}</td><td>${esc(l['物料名称'])}</td><td>${esc(l['型号'])}</td>`
    + `<td class="r">${esc(fmtNum(l['数量']))}</td><td class="c">${esc(l['计量单位'])}</td>`
    + `<td>${esc(l['不良原因'])}</td><td>${esc(l['备注'])}</td></tr>`).join('')
    + Array.from({ length: pad }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')
  const body = '<style>'
    + '.hd{text-align:center}'
    + '.hd .cn{font-size:22px;font-weight:700;letter-spacing:2px}'
    + '.hd .en{font-size:13px;margin:2px 0}'
    + '.hd .tel{font-size:12px;margin-bottom:8px}'
    + 'h1{font-size:20px;text-align:center;margin:4px 0 12px;letter-spacing:16px;font-weight:700}'
    + '.top{display:flex;align-items:flex-end;gap:24px;margin-bottom:8px;font-size:12px}'
    + '.top .f{white-space:nowrap}.top .f b{font-weight:400}'
    + '.top .v{display:inline-block;border-bottom:1px solid #444;padding:0 30px 1px 4px}'
    + '.top .grow{flex:1}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.r{text-align:right}td.c{text-align:center}'
    + '.memo{border:1px solid #444;border-top:none;padding:6px 8px;font-size:12px}'
    + '.sign{display:flex;border:1px solid #444;border-top:none;padding:8px;font-size:12px}'
    + '.sign span{flex:1}'
    + '</style>'
    + '<div class="hd"><div class="cn">' + esc(COMPANY.name) + '</div>'
    + `<div class="en">${esc(COMPANY.en)}</div>`
    + `<div class="tel">电话：${esc(COMPANY.tel)} ／ 传真：${esc(COMPANY.fax)}</div></div>`
    + '<h1>退货单</h1>'
    + '<div class="top">'
    + `<span class="f">供应商：<span class="v">${esc(doc['供应商'])}</span></span>`
    + '<span class="grow"></span>'
    + `<span class="f">退货日期：<span class="v">${esc(fmtDate(doc['单据日期']))}</span></span>`
    + '</div>'
    + '<table><thead><tr>'
    + ['产品编码', '物料名称', '规格', '数量', '单位', '退货原因', '备　注'].map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs + '</tbody></table>'
    + '<div class="memo">说明：货物数量及规格请当面点清验收。</div>'
    + '<div class="sign"><span>总经理：</span><span>财务：</span><span>采购：</span><span>仓管：</span><span>供应商：</span></div>'
  if (!openPrintWindow('退货单-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert('浏览器拦截了打印窗口,请允许弹出窗口')
}

/**
 * 二维码标签·新版式(2026-09-24 用户拍板,替代 80×80 旧版式):商品界面「二维码标签」勾选即打。
 * 75×100mm 标签纸,一品一卡,一卡一页;字段=订单编号/供应商名称/物料编码/物料规格/数量/批次/生产日期
 * ——编码·规格取商品行,其余留横线手填;二维码=公司代码@物料编码[@批号](2026-09-28 口径,见下),
 * 置于右下角,距边框 ≥5mm 不重合。旧服务端版式 /report/qr-label(inv-qr-label.jrxml)暂留可回滚。
 * 2026-09-28 采购入库单「打印标识卡」复用本版式:同一卡面,但行对象可多带可选键
 * (订单编号/供应商名称/数量/批次/生产日期)——单据上有事实值即打印填充,缺键行为与商品档案完全一致(留空手填)。
 * 2026-09-28 二次修正(用户实打反馈):供应商名称过长时 nowrap 溢出卡边 → 改 flex 版式——
 * 标签恒不折行(.lb),值区占剩余宽度、过长自动转行(.v word-break:break-all),空值仍留 22mm 手填横线。
 * 2026-09-28 三修(用户拍板):二维码内容改旧系统扫码口径——
 * 带批号=公司代码@物料编码@批号(如 0@XH-SX80250SX@20060908,采购入库单行);
 * 不带批号=公司代码@物料编码(如 0@XH-SX80250SX,商品档案行/无批次行)。规格·数量不再进码。
 * 公司代码取旧系统 plang.comm(全库唯一 '0'),常量见 COMPANY.companyCode。
 * @param rows [{编码, 规格, 数量?, 批次?, 订单编号?, 供应商名称?, 生产日期?}]
 */
/** 标识卡二维码内容:公司代码@物料编码[@批号](批号空→两段;2026-09-28 旧系统扫码口径) */
export function productCardQrText(card, companyCode = COMPANY.companyCode) {
  return [companyCode, card['编码'], card['批次'] || ''].filter((s) => s !== '' && s != null).join('@')
}

export async function printProductCards(rows) {
  const cards = (Array.isArray(rows) ? rows : []).filter((r) => r && r['编码'])
  if (!cards.length) return false
  const pageCss = '@page{size:75mm 100mm;margin:0}'
  const cardCss = '.card{width:75mm;height:100mm;box-sizing:border-box;border:0.35mm solid #000;'
    + 'padding:5mm 5mm 26mm 5mm;position:relative;page-break-after:always;background:#fff;font-family:"Microsoft YaHei",system-ui,sans-serif;color:#111}'
    + '.card:last-child{page-break-after:auto}'
    + '.card .f{display:flex;align-items:flex-end;margin:2.2mm 0;line-height:1.3;font-size:10pt}'
    + '.card .f .lb{flex:none;white-space:nowrap}'
    + '.card .f .v{flex:0 1 auto;min-width:22mm;border-bottom:0.25mm solid #000;padding:0 1mm 0.4mm;font-size:9.5pt;word-break:break-all;overflow-wrap:anywhere}'
    + '.card .qr{position:absolute;right:6mm;bottom:6mm;width:20mm;height:20mm}'
    + '.card .qr img{width:20mm;height:20mm;display:block}'
    + 'body{margin:0;background:#fff}'
  const trs = []
  for (const c of cards) {
    const qrText = productCardQrText(c)
    let qr = ''
    try {
      const lib = qrLib()
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M' })
    } catch (e) { console.warn('[print-formats] 二维码生成失败:', e?.message || e) }
    const f = (label, value) => `<div class="f"><span class="lb">${label}：</span><span class="v">${esc(value || '')}</span></div>`
    trs.push('<div class="card">'
      + f('订单编号', c['订单编号']) + f('供应商名称', c['供应商名称'])
      + f('物料编码', c['编码']) + f('物料规格', c['规格'])
      + f('数　　量', c['数量']) + f('批　　次', c['批次']) + f('生产日期', c['生产日期'])
      + `<div class="qr">${qr ? `<img src="${qr}"/>` : ''}</div>`
      + '</div>')
  }
  const body = '<style>' + pageCss + cardCss + '</style>' + trs.join('')
  if (!openPrintWindow('产品标识卡', body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

/**
 * 库位标识卡(WHLOC 库位档案「二维码标签」勾选即打,2026-09-28)——与商品标识卡同款 75×100mm 版式,
 * 卡面只放库位字段(仓库/库位地址/库位编码),不含商品标识卡的 订单编号/供应商/数量/批次/生产日期 等字段
 * (用户口径:库位卡只服务定位)。二维码=仓库编码@库位地址@库位编码(固定三段,空段保留占位;
 * 2026-09-28 同日改版:首段 仓库→仓库编码,扫码按编码定位仓库,仓库编码选仓库时参照带回自动填)。
 * 卡面 CSS 与 printProductCards 同构:标签恒不折行(.lb),值区过长自动转行,二维码右下角 20×20mm。
 * @param rows [{仓库, 仓库编码, 库位地址, 库位编码}](库位编码=行身份,缺码行跳过)
 */
/** 库位标识卡二维码内容:仓库编码@库位地址@库位编码(三段固定顺序,空段保留占位) */
export function locationCardQrText(loc) {
  return [loc?.['仓库编码'], loc?.['库位地址'], loc?.['库位编码']].map((s) => String(s ?? '').trim()).join('@')
}

export async function printLocationCards(rows) {
  const cards = (Array.isArray(rows) ? rows : []).filter((r) => r && r['库位编码'])
  if (!cards.length) return false
  const pageCss = '@page{size:75mm 100mm;margin:0}'
  const cardCss = '.card{width:75mm;height:100mm;box-sizing:border-box;border:0.35mm solid #000;'
    + 'padding:5mm 5mm 26mm 5mm;position:relative;page-break-after:always;background:#fff;font-family:"Microsoft YaHei",system-ui,sans-serif;color:#111}'
    + '.card:last-child{page-break-after:auto}'
    + '.card .f{display:flex;align-items:flex-end;margin:2.2mm 0;line-height:1.3;font-size:10.5pt}'
    + '.card .f .lb{flex:none;white-space:nowrap}'
    + '.card .f .v{flex:0 1 auto;min-width:22mm;border-bottom:0.25mm solid #000;padding:0 1mm 0.4mm;font-size:10pt;word-break:break-all;overflow-wrap:anywhere}'
    + '.card .qr{position:absolute;right:6mm;bottom:6mm;width:20mm;height:20mm}'
    + '.card .qr img{width:20mm;height:20mm;display:block}'
    + 'body{margin:0;background:#fff}'
  const trs = []
  for (const c of cards) {
    const qrText = locationCardQrText(c)
    let qr = ''
    try {
      const lib = qrLib()
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M' })
    } catch (e) { console.warn('[print-formats] 库位二维码生成失败:', e?.message || e) }
    const f = (label, value) => `<div class="f"><span class="lb">${label}：</span><span class="v">${esc(value || '')}</span></div>`
    trs.push('<div class="card">'
      + f('仓　　库', c['仓库']) + f('库位地址', c['库位地址']) + f('库位编码', c['库位编码'])
      + `<div class="qr">${qr ? `<img src="${qr}"/>` : ''}</div>`
      + '</div>')
  }
  const body = '<style>' + pageCss + cardCss + '</style>' + trs.join('')
  if (!openPrintWindow('库位标识卡', body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

/**
 * 生产任务单(打印工单) — 横向 A4,一行=一张工单,行尾二维码;工单排产看板与生产工单面板共用本实现。
 * 二维码内容=公司代码@工单号@(1000+工单行号)(woQrText,2026-10-09 规则改版;扫码报工/领料入口口径)。
 * @param rows [{加工单号,公司代码?,工单行号?,客户,产品名称,批号,规格型号,重点管控,客户PO,排产数量,每箱数量,箱数,计划完工日期,备注,生产线}]
 * @param opts {line?:string, preparedBy?:string}
 * @return Promise<boolean> true=已送出打印(窗口未被拦截)
 */
export async function printProductionTask(rows, opts = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r['加工单号'])
  if (!list.length) return false
  const line = opts.line || list[0]['生产线'] || ''
  const user = opts.preparedBy || ''
  const now = new Date()
  const stamp = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} `
    + `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const trs = []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    let qr = ''
    try {
      const lib = qrLib()
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(woQrText(r), { margin: 1, errorCorrectionLevel: 'M' })
    } catch (e) { console.warn('[print-formats] 工单二维码生成失败:', e?.message || e) }
    trs.push('<tr>'
      + `<td>${i + 1}</td>`
      + `<td>${esc(r['客户'])}</td><td>${esc(r['产品名称'])}</td><td>${esc(r['批号'])}</td>`
      + `<td>${esc(r['规格型号'])}</td><td>${esc(r['重点管控'])}</td><td>${esc(r['客户PO'])}</td>`
      + `<td>${esc(fmtNum(r['排产数量']))}</td><td>${esc(fmtNum(r['每箱数量']))}</td><td>${esc(fmtNum(r['箱数']))}</td>`
      + `<td>${esc(r['计划完工日期'])}</td><td>${esc(r['备注'])}</td>`
      + `<td class="qr">${qr ? `<img src="${qr}"/>` : ''}</td></tr>`)
  }
  const body = '<style>'
    + '@page{size:A4 landscape;margin:8mm}'
    + 'body{font-family:system-ui,"Microsoft YaHei",sans-serif;margin:0;color:#111}'
    + '.hd{display:flex;align-items:baseline;gap:18px;margin-bottom:6px}'
    + '.hd .t{flex:1;text-align:center;font-size:20px;font-weight:700;letter-spacing:6px}'
    + '.hd .s{font-size:12px;color:#333;white-space:nowrap}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.qr{text-align:center;padding:2px}td.qr img{width:64px;height:64px}'
    + '</style>'
    + '<div class="hd"><span class="s">' + esc(COMPANY.woLineLabel) + ': ' + esc(line) + '</span>'
    + '<span class="t">' + esc(COMPANY.woTitle) + '</span>'
    + '<span class="s">' + esc(COMPANY.woPreparedBy) + ': ' + esc(user) + '　' + esc(stamp) + '</span></div>'
    + '<table><thead><tr>'
    + COMPANY.woColumns.map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs.join('') + '</tbody></table>'
  if (!openPrintWindow(COMPANY.woTitle, body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}
