/**
 * print-formats.js — 固定版式纸质单据打印(2026-09-23)
 * 现有版式:
 *   ① 银嘉采购订单(用户截图,PU_ORDER 打印):头部信息+物料行表+总计+注意事项+供/需方签章框;
 *   ② 退货单(用户截图,QC_RETURN 暂收退料单 打印):公司抬头+供应商/退货日期+行表+说明+签章行;
 *   ③ 二维码标签(2026-09-24,INV 勾选即打):75×100mm 七字段标签;
 *     ③b 仓位标识卡(2026-09-28 建为「库位标识卡」,2026-10-08 正名):同款 75×100mm,
 *        卡面=仓库/仓位地址/仓位编码,二维码=仓库编码@仓位编码(2026-10-18 去地址段);
 *   ④ 生产任务单(打印工单,2026-09-24):横向 A4 一表多行+行尾二维码=公司代码@工单号@1000+行号(2026-10-09 规则改版,woQrText)。
 * 打印通道:**页面内打印层 + window.print()**(`@core/panel/printChannel`,2026-10-20 全系统统一;
 *   旧「新窗口 HTML + 子窗口 print」已删除 —— 同源弹窗与主页面共用渲染进程,打印预览一卡就整页卡死);
 * 版面文字(公司抬头/注意事项/需方联系/生产任务单表头)为固定版式常量,改文案只动本文件。
 * 业务单据为纸面事实格式,不入 tt() 翻译层(ADR-0001)。
 * 纸面「总　计」的位数与明细一致(2026-10-03 用户口径,见 @core/panel/sumTotals):
 * 明细 decimal(18,4) 的 4 位不再被 2 位截断,也不出现 0.30000000000000004 这类浮点尾巴。
 */
import * as QRCodeMod from 'qrcode'
// ⚠ 这里写**相对路径**而不是 Vite 别名 `@core/panel/sumTotals`(2026-10-07):
//   本文件被 `node --test` 直接加载(print-formats.test.js / wo-qr.test.js),
//   而 node 不认 Vite 的 resolve.alias ⇒ 用别名会 ERR_MODULE_NOT_FOUND 把两条测试打挂。
//   测试可见的模块一律用相对路径;只走打包链路的模块才用别名。
//   另外 node ESM 必须写**扩展名**(Vite 可省),所以是 '../core/panel/sumTotals.js'。
import { sumKeepScale } from '../core/panel/sumTotals.js'
// 打印通道(2026-10-20):与面板单据打印同一条路 —— 主页面打印层 + window.print(),不弹窗。
// 与 sumTotals 同理写相对路径 + 扩展名:`node --test` 直接加载本文件时不认 Vite 别名。
import { printInPage } from '../core/panel/printChannel.js'
// 公司代码常量(2026-10-21 抽出到 core/panel/companyCode.js):三处二维码同源,别再写字面量 '0'。
import { COMPANY_CODE } from '../core/panel/companyCode.js'

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
  // 公司代码(2026-09-28 物料二维码口径):取旧系统 plang.comm,全库唯一值 '0'(常量已下沉到
  // core/panel/companyCode.js,材料仓条码二维码也用同一份);标识卡二维码前缀=公司代码@物料编码[@批号],
  // 与旧系统扫码解析口径一致
  companyCode: COMPANY_CODE,
  // 需方签章框
  buyer: { 单位名称: '惠州市银嘉环保科技有限公司', 联系人: '孙郝聪', 联系方式: '13718162430' },
  // 生产任务单(打印工单)固定表头文字:纸面页头只有标题
  //  (2026-10-21 用户口径:不印打印日期、不印制单人、线体也不印 ⇒ 原 woPreparedBy / woLineLabel 两常量已删)
  woTitle: '生产任务单',
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

/** 出纸失败的统一提示(页面内打印不再依赖"允许弹出窗口",只可能被浏览器禁掉打印对话框) */
const PRINT_FAIL_MSG = '打印失败:浏览器阻止了打印,请允许本页面弹出打印对话框'

// ⚠ 2026-10-20:旧的子窗口打印函数(`openPrintWindow`)已**整段删除** ——
//   原因与替代见 `../core/panel/printChannel.js` 头部;本文件一律 printInPage(...),
//   **不要再往回加 window.open 打印**(单测里没有 window.open,写回去立刻 TypeError)。

/**
 * 生产任务单模板(2026-09-27 用户截图版式,生产工单列表/工单排产看板共用;2026-10-21 加「切炭」):
 *   成型生产任务单——横向 A4,列含 成型折算后数量;切炭 / 组装生产任务单——同列结构、无折算列(只差标题);
 *   行尾二维码 = 公司代码@工单号@(1000+工单行号)(woQrText,2026-10-09 规则改版;旧 工单号|批号|物料编码|排产数量|生产线 作废)。
 *   🔴 纸面页头只有标题(2026-10-21 用户口径:不印打印日期、不印制单人、线体也不印)。
 * @param title '成型生产任务单' | '切炭生产任务单' | '组装生产任务单'
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
  // 切炭(2026-10-21 用户口径「增加一种打印为切炭打印」):与组装同列结构,只差标题;
  //   要印「切炭工序量」是另一个口径(像成型那样按工艺路线折算),需要时再加列。
  '切炭生产任务单': ['单据编号', '是否重点管控产品', '商品编码', '商品名称', '规格型号', '订单数量', '计划完工日期'],
  '组装生产任务单': ['单据编号', '是否重点管控产品', '商品编码', '商品名称', '规格型号', '订单数量', '计划完工日期'],
}

export async function printWorkTaskSheet(title, rows) {
  const cols = TASK_SHEET_COLUMNS[title]
  if (!cols) return false
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r['单据编号'])
  if (!list.length) return false
  // 纸面页头只有标题(2026-10-21 用户口径):不印打印日期、不印制单人、**线体也不印**——
  //   原来那行 `线体: xxx … 制单: 用户名 yyyy/M/d HH:mm:ss` 整行都没了。
  //   ⚠ 别加回来(单测 wo-qr.test.js 有守门断言);打印留痕另有去处:
  //     plang.打印人/打印时间 + asp_print(见 printStamp 接口),纸面不需要。
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
    + '.hd{text-align:center;margin-bottom:6px}'
    + '.hd .t{font-size:20px;font-weight:700;letter-spacing:6px}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.qr{text-align:center;padding:2px}td.qr img{width:64px;height:64px}'
    + '</style>'
    + '<div class="hd"><span class="t">' + esc(title) + '</span></div>'
    + '<table><thead><tr>' + ths + '</tr></thead><tbody>' + trs.join('') + '</tbody></table>'
  // 🔴 2026-10-19:改走**页面内打印**(与面板单据打印同一条路),不再弹窗。
  //   现场实测:打印工单(哪怕只有 1 张)后整页僵死、刷新无效、只能关标签 —— 弹窗与主页面共用渲染进程,
  //   打印预览/虚拟打印机一卡就一起死。页面内打印走 window.print(),和"打单据"完全一致。
  if (!printInPage(title, body)) { alert(PRINT_FAIL_MSG); return false }
  return true
}

/**
 * ⚠ 2026-10-14 已删除 `printFeedingSheet`(生产投料单版式):它的物料明细行全部来自
 *   自建 BOM(/px/workOrderBom → bs_bom),随 MES 自建「物料清单(BOM)」功能整体下线,
 *   两个调用点(工单列表 / 工单排产看板)的「生产投料单」打印项同步移除。若将来有了新的
 *   投料数据源,按原截图版式重新实现即可(纵向 A4、每工单一页、物料表=定额×需求数量)。
 */

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
  const totalQty = sumKeepScale(rows.map((l) => l['数量'])) ?? 0
  const totalAmt = sumKeepScale(rows.map((l) => l['金额'])) ?? 0
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
  if (!printInPage('银嘉采购订单-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert(PRINT_FAIL_MSG)
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
  const totalQty = sumKeepScale(rows.map((l) => l['数量'])) ?? 0
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
  if (!printInPage('银嘉采购订单(无金额)-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert(PRINT_FAIL_MSG)
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
  if (!printInPage('退货单-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert(PRINT_FAIL_MSG)
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

export async function printProductCards(rows, opts) {
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
  // opts.onDone:打印结束(afterprint)后才回调 —— 调用方用它把「刷新数据」推迟到打印层摘掉之后,
  // 避免打印对话框打开期间还去重绘界面(2026-10-29 供应商现场「打印卡死」)
  if (!printInPage('产品标识卡', body, opts)) { alert(PRINT_FAIL_MSG); return false }
  return true
}

/**
 * 仓位标识卡(WHLOC 仓位档案「二维码标签」勾选即打,2026-09-28;2026-10-08 库位→仓位术语统一)
 * ——与商品标识卡同款 75×100mm 版式,
 * 卡面只放仓位字段(仓库/仓位地址/仓位编码),不含商品标识卡的 订单编号/供应商/数量/批次/生产日期 等字段
 * (用户口径:仓位卡只服务定位)。二维码=仓库编码@仓位编码(2026-10-18 用户口径:仓位地址含中文且会漂,
 * 不再进码;卡面仍显示地址)。空段保留占位,扫码端按 @ 切分后取首段=仓库编码、末段=仓位编码;
 * 兼容 2026-09-28 起已打印的旧三段码 仓库编码@仓位地址@仓位编码(取首段与末段即可)。
 * 卡面 CSS 与 printProductCards 同构:标签恒不折行(.lb),值区过长自动转行,二维码右下角 20×20mm。
 * @param rows [{仓库, 仓库编码, 仓位地址, 仓位编码}](仓位编码=行身份,缺码行跳过)
 */
/** 仓位标识卡二维码内容:仓库编码@仓位编码(两段固定顺序,空段保留占位) */
export function locationCardQrText(loc) {
  return [loc?.['仓库编码'], loc?.['仓位编码']].map((s) => String(s ?? '').trim()).join('@')
}

export async function printLocationCards(rows) {
  const cards = (Array.isArray(rows) ? rows : []).filter((r) => r && r['仓位编码'])
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
    } catch (e) { console.warn('[print-formats] 仓位二维码生成失败:', e?.message || e) }
    const f = (label, value) => `<div class="f"><span class="lb">${label}：</span><span class="v">${esc(value || '')}</span></div>`
    trs.push('<div class="card">'
      + f('仓　　库', c['仓库']) + f('仓位地址', c['仓位地址']) + f('仓位编码', c['仓位编码'])
      + `<div class="qr">${qr ? `<img src="${qr}"/>` : ''}</div>`
      + '</div>')
  }
  const body = '<style>' + pageCss + cardCss + '</style>' + trs.join('')
  if (!printInPage('仓位标识卡', body)) { alert(PRINT_FAIL_MSG); return false }
  return true
}

/**
 * 生产任务单(打印工单) — 横向 A4,一行=一张工单,行尾二维码;工单排产看板与生产工单面板共用本实现。
 * 二维码内容=公司代码@工单号@(1000+工单行号)(woQrText,2026-10-09 规则改版;扫码报工/领料入口口径)。
 * @param rows [{加工单号,公司代码?,工单行号?,客户,产品名称,批号,规格型号,重点管控,客户PO,排产数量,每箱数量,箱数,计划完工日期,备注,生产线}]
 * 纸面页头只有标题(2026-10-21 用户口径:不印打印日期/制单人/线体);原 opts(line/preparedBy)参数已删。
 * @return Promise<boolean> true=已交给浏览器打印(页面内打印层,不弹窗)
 */
export async function printProductionTask(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r['加工单号'])
  if (!list.length) return false
  // 纸面页头只有标题(同 printWorkTaskSheet 的 2026-10-21 用户口径):不印打印日期/制单人/线体。
  //   打印留痕仍在后端:plang.打印人/打印时间 + asp_print(调用方打印后打 /px/scheduleBoard/printStamp)。
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
    + '.hd{text-align:center;margin-bottom:6px}'
    + '.hd .t{font-size:20px;font-weight:700;letter-spacing:6px}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.qr{text-align:center;padding:2px}td.qr img{width:64px;height:64px}'
    + '</style>'
    + '<div class="hd"><span class="t">' + esc(COMPANY.woTitle) + '</span></div>'
    + '<table><thead><tr>'
    + COMPANY.woColumns.map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs.join('') + '</tbody></table>'
  if (!printInPage(COMPANY.woTitle, body)) { alert(PRINT_FAIL_MSG); return false }
  return true
}

/**
 * 工单二维码单张标签(2026-10-30,「手机扫码 · 生产领料」用)。
 *
 * 用户口径:「打印就先只是先打印工单二维码,在生成生产领料单的时候自动打印一次」。
 * ⇒ 只出一张 75×100mm 标签,卡面 = 标题 / 工单号 #行号 / 产品 / 规格,右下角二维码。
 * 二维码内容走 {@link woQrText} 的同一口径(公司代码@工单号@1000+行号)——
 * 现场用同一个扫码入口继续扫(生产领料、工序报工都认这个码)。
 *
 * @param {{工单号?:string, 工单行号?:number, 产品名称?:string, 规格型号?:string,
 *          标题?:string, 二维码内容?:string}} payload
 *        也接受后端 `/mobilePick/generate` 直接回的那份 `打印` 对象(字段名一致)。
 * @param {{onDone?:Function}} [opts]
 * @return {Promise<boolean>} true = 已交给页面内打印层(不弹新窗口)
 */
export async function printWoQr(payload, opts = {}) {
  const p = payload || {}
  const woNo = String(p['工单号'] ?? '').trim()
  if (!woNo) return false
  const qrText = String(p['二维码内容'] ?? '').trim() || woQrText(p)
  let qr = ''
  try {
    const lib = qrLib()
    if (!lib) throw new Error('qrcode lib unavailable')
    qr = await lib.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M' })
  } catch (e) { console.warn('[print-formats] 工单二维码生成失败:', e?.message || e) }

  const title = String(p['标题'] ?? '').trim() || '领料单'
  const line = Number(p['工单行号']) || 0
  const outNo = String(p['领料单号'] ?? '').trim()
  const dept = String(p['领料部门'] ?? '').trim()
  const printDate = String(p['打印日期'] ?? '').trim() || new Date().toISOString().slice(0, 10)
  // 明细行(纸表七列);后端 /mobilePick/reprint 已带「明细」,旧载荷没有就当空表
  const rows = Array.isArray(p['明细']) ? p['明细'] : []
  const cell = (v) => (v === 0 || v ? esc(String(v)) : '')
  const fmtQty = (v) => (Number(v) > 0 ? String(Math.round(Number(v) * 10000) / 10000) : '')
  const bodyRows = []
  for (let i = 0; i < Math.max(8, Math.min(12, rows.length)); i++) {
    const r = rows[i] || {}
    bodyRows.push('<tr>'
      + `<td>${esc(woNo + (line ? '#' + line : ''))}</td>`
      + `<td>${cell(r['材料名称'])}</td>`
      + `<td>${cell(r['规格'])}</td>`
      + `<td>${cell(r['单位'])}</td>`
      + `<td class="num">${fmtQty(r['请领数量'])}</td>`
      + `<td class="num">${fmtQty(r['实发数量'])}</td>`
      + `<td>${cell(r['备注'])}</td>`
      + '</tr>')
  }
  // 🔴 2026-11-02 用户口径:照**纸质领料单**的样子出(用户给了样张照片)——
  //   左上角放二维码、标题「领 料 单」+ 右上 No 单号、七列明细表格、底部四栏签名。
  //   纸张 = 中一刀 210mm x 148.5mm 横打。
  const body = '<style>'
    + '@page{size:210mm 148.5mm;margin:0}'
    + '.card{width:210mm;height:148.5mm;box-sizing:border-box;padding:5mm 6mm;'
    + 'position:relative;page-break-after:always;background:#fff;'
    + 'font-family:"Microsoft YaHei",system-ui,sans-serif;color:#000}'
    + '.card:last-child{page-break-after:auto}'
    + '.qr{position:absolute;left:6mm;top:5mm;width:34mm;height:34mm;border:0.35mm solid #000}'
    + '.qr img{width:100%;height:100%;display:block}'
    + '.t{text-align:center;font-size:22pt;font-weight:700;letter-spacing:5mm;margin:1mm 0 0}'
    + '.no{position:absolute;right:8mm;top:7mm;font-size:12pt;font-weight:700}'
    + '.meta{margin:2mm 0 1.5mm 38mm;font-size:10.5pt}'
    + '.meta .d{float:right;margin-right:2mm}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:0.3mm solid #000;padding:0.8mm 1.2mm;font-size:9.5pt;'
    + 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
    + 'th{font-weight:700;text-align:center;height:7mm}'
    + 'td{height:6.4mm}'
    + 'td.num{text-align:right}'
    + '.sign{margin-top:2.5mm;font-size:10.5pt;display:flex;justify-content:space-between}'
    + 'body{margin:0;background:#fff}'
    + '</style>'
    + '<div class="card">'
    + `<div class="qr">${qr ? `<img src="${qr}"/>` : ''}</div>`
    + `<div class="no">No ${esc(outNo || '-')}</div>`
    + `<div class="t">${esc(title)}</div>`
    + `<div class="meta">领料部门:${esc(dept)}<span class="d">日期:${esc(printDate)}</span></div>`
    + '<table>'
    + '<colgroup><col style="width:20%"><col style="width:22%"><col style="width:15%">'
    + '<col style="width:6%"><col style="width:12%"><col style="width:12%"><col style="width:13%"></colgroup>'
    + '<thead><tr><th>订单号</th><th>材料名称</th><th>规格</th><th>单位</th>'
    + '<th>请领数量</th><th>实发数量</th><th>备注</th></tr></thead>'
    + `<tbody>${bodyRows.join('')}</tbody>`
    + '</table>'
    + '<div class="sign"><span>部门主管:</span><span>仓库主管:</span><span>领料人:</span><span>仓管员:</span></div>'
    + '</div>'

  // 与其它标签同一条打印通道(页面内打印层 + window.print);opts.onDone 在 afterprint 后回调
  if (!printInPage(title, body, opts)) { alert(PRINT_FAIL_MSG); return false }
  return true
}

/**
 * 排单计划纸表(2026-10-31;2026-11-04 标题/车间列头改为**按工序产线动态**)—— 照纸表出的整张报表。
 *
 * <p>用户口径演化:
 * <ul>
 *   <li>2026-10-31「这个需要能打出这样的报表形式,就在当前工单排产处实现即可,
 *       这样就不需要根据那个产线进行处理了」⇒ 取数走 `/px/scheduleBoard/planSheet`;</li>
 *   <li>2026-11-04「**当前在不同的工序产线显示的这个工序名称也要不同**」⇒ 纸表标题与「车间」列头
 *       不再写死「成型车间」,而是跟着**所打印产线的 生产车间**走:
 *       成型车间排单计划 / 切炭车间排单计划 / 组装车间排单计划…,列头同理(成型车间/切炭车间/组装车间)。
 *       解析见 {@link planSheetShop} / {@link planSheetTitle};取不到唯一车间时退回通用的
 *       「排单计划 / 生产车间」,不冒充某个车间。</li>
 * </ul>
 *
 * <p>版式照纸表:客户等级 / 客户名称 / 产品编号 / 型号 / 车间(产线) / 未完成总数 / 生产计划数量 /
 * 实际完成数量 / 交期 / 交期紧迫度 / 7天 / 15天 / 大于15 / 日期列(手写那几列 = 我们的日计划)。
 *
 * <p>纸面是**固定版式事实**,文字不入 tt() 翻译层(ADR-0001);日期列默认从**今天起 7 天**
 * (纸表也只印 3~5 天;列太多会挤成一团,可用 opts.days 调)。
 */

/**
 * 排单计划该印哪个「车间/工序」名称(2026-11-04)。
 *
 * <p>取值优先级:① 调用方显式 `opts.shop`(工单排产页按**选中产线**的 `生产车间` 传,最准);
 * ② 行内若**唯一**有产线/工序归属(`生产车间` → `当前工序` → `工序` 依次取第一个非空值);
 * ③ 都取不到(或混打多个工序)⇒ 空串,由 {@link planSheetTitle} 退回通用标题 —— 不写死「成型」。
 *
 * @param {Array} rows 要打印的行
 * @param {Object} [opts] { shop }
 * @returns {string} 车间名(如「成型」「切炭」「组装」);未知时 ''
 */
export function planSheetShop(rows, opts = {}) {
  const explicit = String(opts?.shop ?? '').trim()
  if (explicit) return explicit
  const set = new Set()
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r) continue
    for (const k of ['生产车间', '当前工序', '工序']) {
      const v = String(r[k] ?? '').trim()
      if (v) { set.add(v); break }
    }
  }
  return set.size === 1 ? [...set][0] : ''
}

/** 车间词的**裸名**:去掉可能自带的「车间」后缀(档案里两种写法都出现过),避免「成型车间车间排单计划」 */
function planSheetShopWord(shop) {
  const s = String(shop || '').trim()
  return s.endsWith('车间') ? s.slice(0, -2).trim() : s
}

/** 纸表标题:车间已知 ⇒ 「<车间>车间排单计划」(例:切炭车间排单计划);未知 ⇒ 通用「排单计划」 */
export function planSheetTitle(shop) {
  const w = planSheetShopWord(shop)
  return w ? `${w}车间排单计划` : '排单计划'
}

/** 纸表「车间」列头:车间已知 ⇒ 切炭车间;未知 ⇒ 生产车间 */
function planSheetShopColumn(shop) {
  const w = planSheetShopWord(shop)
  return w ? `${w}车间` : '生产车间'
}

const PLAN_SHEET_BASE_COLS = [
  { t: '客户等级', w: 2, k: (r) => r['客户等级'] },
  { t: '客户名称', w: 9, k: (r) => r['客户'] },
  // 主要信息(2026-11-01 用户口径「不是两张纸,当前同一行融合起来」):工单号融进本行
  { t: '单据编号', w: 10, k: (r) => r['加工单号'] },
  { t: '产品编号', w: 6, k: (r) => r['物料编码'] },
  { t: '型号', w: 6, k: (r) => r['规格型号'] },
  // 车间(产线)列:表头随所打印的工序产线变 —— 成型车间 / 切炭车间 / 组装车间(2026-11-04)
  { t: '生产车间', w: 5, k: (r) => r['生产线'], tOf: planSheetShopColumn },
  { t: '未完成总数', w: 5, k: (r) => fmtNum(r['未交量'] ?? r['需求数量']), n: true },
  { t: '生产计划数量', w: 5, k: (r) => fmtNum(r['排产数量']), n: true },
  { t: '实际完成数量', w: 5, k: (r) => fmtNum(r['当前工序完工量']), n: true },
  // 交期两列标题也随工序走(成型交期/切炭交期/组装交期…),旧写死「成型」会让切炭/组装的纸对不上
  { t: '交期', w: 5, k: (r) => monthDay(r['交期'] || r['计划完工日期']), tOf: (shop) => { const w = planSheetShopWord(shop); return w ? `${w}交期` : '交期' } },
  { t: '交期紧迫度', w: 5, k: (r) => (r['交期紧迫度'] == null ? '' : String(r['交期紧迫度'])), n: true, tOf: (shop) => { const w = planSheetShopWord(shop); return w ? `${w}交期紧迫度` : '交期紧迫度' } },
  { t: '7天', w: 3, k: (r) => fmtNum(r['7天已排']), n: true },
  { t: '15天', w: 3, k: (r) => fmtNum(r['15天已排']), n: true },
  { t: '大于15', w: 4, k: (r) => fmtNum(r['大于15天已排']), n: true },
]

/** yyyy-MM-dd → M月D日(纸表写法);非法/空 → '' */
function monthDay(v) {
  const s = String(v ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${Number(m[2])}月${Number(m[3])}日` : s
}

/** yyyy-MM-dd → M/D(日期列多时的紧凑表头,例:10/29 —— 列宽只有 2%~3% 时"M月D日"排不下) */
function shortMonthDay(v) {
  const s = String(v ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${Number(m[2])}/${Number(m[3])}` : s
}

/**
 * yyyy-MM-dd 加/减 N 天 → yyyy-MM-dd。
 * ⚠ 用 Date.UTC 算,**别**用 `new Date(s)` + 本地时区再 `toISOString().slice(0,10)`
 *   —— 东八区会差一天(`toISOString` 是 UTC;页面「开工日期」的默认值就踩过这个坑)。
 */
export function ymdAddDays(v, n) {
  const s = String(v ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return ''
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  dt.setUTCDate(dt.getUTCDate() + Number(n || 0))
  return dt.toISOString().slice(0, 10)
}

/** 一张排单计划最多印多少天(防脏数据/超长交期把表撑爆;正常工单 1~16 天) */
export const MAX_SHEET_DAYS = 31

/** 连续日期窗口:start 起 days 天;start 非法 → 空数组 */
export function planSheetWindow(start, days = 5) {
  const s = String(start || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return []
  const n = Math.min(Math.max(Math.trunc(Number(days) || 5), 1), MAX_SHEET_DAYS)
  const out = []
  for (let i = 0; i < n; i++) out.push(ymdAddDays(s, i))
  return out
}

/**
 * 排单计划要印的日期列(2026-11-04 用户口径:「**打印的就按这些勾选的表中最前面的日期到最后的一个日期就行**」)。
 *
 * <p>= 勾选行(`pickPlanSheetRows` 之后的行)的 `日计划` 里出现过的日期,取**最前一个 → 最后一个**,
 * 中间没计划的日子也保留(空列,纸表可手填);**不再从今天起算**,所以历史计划(例:0227 的
 * 10-29~10-31)、跨月、以及未来都按数据自己说话。
 *
 * <p>边界:
 * <ul>
 *   <li>勾选行一个日计划都没有(例如刚排产、数量全空) ⇒ 退回「今天起 days 天」,不打出没有日期列的空表;</li>
 *   <li>跨度超过 {@link MAX_SHEET_DAYS} 天(脏数据/超长交期) ⇒ 截到**最近</b>的 31 天(保留最新进度);</li>
 *   <li>只认非零计划值:被清空的格子不算日期(与格子里显示的空一致)。</li>
 * </ul>
 *
 * @param {Array} rows  勾选后的行(每行带 `日计划`)
 * @param {string} today 后端返回的 `今天`(仅空计划时兜底用)
 * @param {number} days  兜底窗口天数(默认 5)
 */
export function planSheetDatesFromRows(rows, today = '', days = 5) {
  const ds = new Set()
  for (const r of Array.isArray(rows) ? rows : []) {
    const plan = r?.['日计划'] || {}
    for (const [d, v] of Object.entries(plan)) {
      const s = String(d || '').slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(s) && Number(v || 0) !== 0) ds.add(s)
    }
  }
  const list = [...ds].sort()
  if (!list.length) return planSheetWindow(String(today || '').slice(0, 10), days)
  const first = list[0]
  const last = list[list.length - 1]
  // 跨度超上限 ⇒ 从"最后一个日期"往回取 MAX_SHEET_DAYS 天(保留最新进度,而不是最早那一段)
  const span = Math.round((Date.parse(last + 'T00:00:00Z') - Date.parse(first + 'T00:00:00Z')) / 86400000) + 1
  const start = span > MAX_SHEET_DAYS ? ymdAddDays(last, -(MAX_SHEET_DAYS - 1)) : first
  const out = []
  for (let d = start; out.length < MAX_SHEET_DAYS && d && d <= last; d = ymdAddDays(d, 1)) out.push(d)
  return out
}

/** 取要打印的日期列:从今天起(含)最多 days 天;今天以后没有就退化成最后 days 天
 *  (2026-11-04 起出纸改走 {@link planSheetDatesFromRows};本函数保留给旧调用/兜底) */
export function planSheetDates(dates, today, days = 5) {
  const list = (Array.isArray(dates) ? dates : []).filter(Boolean).slice().sort()
  if (!list.length) return []
  const from = list.filter((d) => !today || d >= today)
  const pick = (from.length ? from : list).slice(0, days)
  return pick
}

/**
 * 排单计划·**勾选打印**(2026-11-03 用户口径「不是点击排单计划把目前生产线的所有单据打印,
 * 而是选择勾选几个打印几个」)—— 从接口返回的行里挑出**勾选的那些行**再出纸。
 *
 * <p>保持接口返回的行序(= 页面排产明细的顺序),不按勾选顺序重排;勾选为空 ⇒ 返回空数组
 * (由调用方提示"请先勾选",绝不悄悄退回"整条产线全打")。
 *
 * @param {Array} rows /px/scheduleBoard/planSheet 的 `行`(每行带 `行id`)
 * @param {Array} ids  勾选行的 `行id`(数字/字符串都认)
 */
export function pickPlanSheetRows(rows, ids) {
  const set = new Set((Array.isArray(ids) ? ids : [])
    .filter((x) => x != null && x !== '')
    .map((x) => String(x)))
  if (!set.size) return []
  return (Array.isArray(rows) ? rows : []).filter((r) => r && set.has(String(r['行id'])))
}

/**
 * 生成排单计划 HTML(纯函数,便于单测;真正出纸见 {@link printSchedPlanSheet})。
 * @param {Array} rows  /px/scheduleBoard/planSheet 的 `行`
 * @param {Array} dates 日期列(`日期`)
 * @param {Object} [opts] { today, days, shop, title } —— shop = 工序/车间名(2026-11-04 标题与车间列头随之变);
 *   title 可整串覆盖;都不传时从行内唯一 生产车间/当前工序/工序 推导,推导不到用通用标题
 */
export async function schedPlanSheetHtml(rows, dates, opts = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean)
  // 2026-11-04 用户口径「当前在不同的工序产线显示的这个工序名称也要不同」⇒ 纸表标题/车间列头跟着工序产线走
  const shop = planSheetShop(list, opts)
  const title = String(opts?.title ?? '').trim() || planSheetTitle(shop)
  // 2026-11-04 用户口径:日期列 = **勾选行「最前一个日期 → 最后一个日期」**(不再从今天起)。
  //   opts.dates 由 WorkOrderBoard 用 planSheetDatesFromRows() 算好传进来(逐字用);
  //   不传时保留旧行为(今天起 days 天)—— 旧调用/单测不受影响。
  const ds = Array.isArray(opts.dates) && opts.dates.length
    ? opts.dates.filter(Boolean).slice()
    : planSheetDates(dates, opts.today || '', opts.days || 5)
  const n = ds.length

  // 二维码列宽/像素(2026-11-04 用户口径「二维码太小」):按**物理尺寸**给,不跟着列数缩 ——
  //   行少(≤5)给 60px≈15.9mm 最好扫,行多逐渐收到 52/44/36px。
  const qrPx = list.length <= 5 ? 60 : list.length <= 8 ? 52 : list.length <= 14 ? 44 : 36
  const rowH = Math.max(38, qrPx + 6)

  // ── A4 横向自动拆页(2026-11-04 用户口径「日期列太窄 / 纸张大小固定怎么办」)────────────
  //   纸张宽度是硬的:日期列数一多,单页必然把日期列压到 7mm 上下(表头和 4 位数字挤成一竖条)。
  //   做法 = 横向分页:每页「固定列 + 二维码 + 一页日期列(每列 ≥ ~9mm)」,跨页重复标题与固定列,
  //   页眉标「第 x/y 页 · 本期日期区间」;日期列总数不超过一页容量时仍是单页(与之前完全一样)。
  const BASE_W = PLAN_SHEET_BASE_COLS.reduce((a, c) => a + c.w, 0)   // 73
  const PAGED_FIXED_SCALE = 0.85                                      // 拆页时固定列收紧到这个比例
  // A4 横向的"一页到底能放几天"是固定的:固定列(0.85×73%≈62%)+二维码(6.5~7.5%)
  //   ⇒ 剩 ~30%,按每日期列 ≥3.3%(≈9.4mm)算,一页最多 9 天。
  //   ≤10 天时单页仍够看(每列 7.7mm 以上),不无谓拆页;>10 天才按 9 天/页拆、各页尽量平均。
  const SINGLE_MAX_DAYS = 10
  const DAYS_PER_PAGE = 9
  const pages = []
  if (n > SINGLE_MAX_DAYS) {
    const pageCount = Math.ceil(n / DAYS_PER_PAGE)
    const per = Math.ceil(n / pageCount)                             // 16 天 ⇒ 8+8,22 天 ⇒ 8+8+6,11 天 ⇒ 6+5
    for (let i = 0; i < n; i += per) pages.push(ds.slice(i, i + per))
  } else {
    pages.push(ds)
  }
  const multipage = pages.length > 1

  // 每页的列宽:单页沿用原自适应;多页按 0.85 收紧固定列,日期列均分剩余宽度
  function layout(pageDates) {
    const m = pageDates.length
    const compact = multipage ? true : m > 7
    const fixedScale = multipage ? PAGED_FIXED_SCALE : (compact ? Math.max(0.52, 1 - (m - 7) * 0.035) : 1)
    const baseW = BASE_W * fixedScale
    const qrW = list.length <= 5 ? 7.5 : (compact ? 6.5 : 6)
    const dateW = m ? Math.max(compact ? 2 : 4, (100 - baseW - qrW) / m) : 0
    return { m, compact, fixedScale, baseW, qrW, dateW }
  }

  // 二维码与「打印工单」同内容(公司代码@工单号@1000+行号),但**融进同一行**,不再另起一张纸
  const qrs = await Promise.all(list.map((r) => woQrImg({
    公司代码: r['公司代码'] || '', 工单号: r['加工单号'], 工单行号: r['工单行号'],
  })))

  /** 渲染一页(固定列 + 该页日期列 + 二维码);多页时页眉带页码与日期区间 */
  function pageHtml(pageDates, pageIdx) {
    const L = layout(pageDates)
    const colgroup = '<colgroup>'
      + PLAN_SHEET_BASE_COLS.map((c) => `<col style="width:${(c.w * L.fixedScale).toFixed(2)}%"/>`).join('')
      + pageDates.map(() => `<col style="width:${L.dateW.toFixed(2)}%"/>`).join('')
      + `<col style="width:${L.qrW}%"/>`                            // 二维码(行尾)
      + '</colgroup>'
    // 表头:固定列支持 tOf(shop) 动态列名(2026-11-04:成型车间 / 切炭车间 / 组装车间 + 交期两列 同理)
    const ths = PLAN_SHEET_BASE_COLS.map((c) => `<th>${esc(c.tOf ? c.tOf(shop) : c.t)}</th>`).join('')
      + pageDates.map((d) => (L.compact
        ? `<th title="${esc(d)}">${esc(shortMonthDay(d))}</th>`
        : `<th>${esc(monthDay(d))}</th>`)).join('')
      + '<th>二维码</th>'
    const trs = list.map((r, i) => {
      const plan = r['日计划'] || {}
      return '<tr>'
        + PLAN_SHEET_BASE_COLS.map((c) => {
          const v = c.k(r)
          return `<td${c.n ? ' class="r"' : ''}>${esc(v == null ? '' : v)}</td>`
        }).join('')
        + pageDates.map((d) => `<td class="r">${esc(fmtNum(plan[d]))}</td>`).join('')
        + `<td class="qr">${qrs[i] ? `<img src="${qrs[i]}"/>` : ''}</td>`
        + '</tr>'
    }).join('')
    const period = pageDates.length
      ? `${monthDay(pageDates[0])}~${monthDay(pageDates[pageDates.length - 1])}`
      : ''
    const sub = multipage
      ? `<span class="hd-sub">第 ${pageIdx + 1}/${pages.length} 页 · ${esc(period)}</span>`
      : ''
    return '<div class="pg"><div class="hd"><span class="t">' + esc(title) + '</span>' + sub + '</div>'
      + '<table>' + colgroup + '<thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table></div>'
  }

  // 字号/内边距随列数微调(compact 时 8px / 表头 7px,否则保持原版 9.5px / 9px)
  const first = layout(pages[0])
  const fs = first.compact ? '8px' : '9.5px'
  const thFs = first.compact ? '7px' : '9px'
  const pad = first.compact ? '2px 1px' : '2px 3px'
  return '<style>'
    + '@page{size:A4 landscape;margin:6mm}'
    + 'body{font-family:"Microsoft YaHei",system-ui,sans-serif;margin:0;color:#111}'
    + '.hd{text-align:center;margin:0 0 4px}'
    + '.hd .t{font-size:18px;font-weight:700;letter-spacing:6px}'
    + '.hd-sub{margin-left:10px;font-size:10px;font-weight:400;letter-spacing:0;color:#555}'
    + '.pg{break-after:page;page-break-after:always}'
    + '.pg:last-child{break-after:auto;page-break-after:auto}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'thead{display:table-header-group}'                     // 行多跨页时表头重复
    + `th,td{border:1px solid #333;padding:${pad};font-size:${fs};line-height:1.25;word-break:break-all;vertical-align:middle}`
    + `th{background:#f2f2f2;font-weight:600;text-align:center;font-size:${thFs};line-height:1.15}`
    + 'td.r{text-align:right;white-space:nowrap}'
    + `td.qr{text-align:center;padding:1px}td.qr img{width:${qrPx}px;height:${qrPx}px}`
    + `tbody tr{height:${rowH}px}`
    + '</style>'
    + pages.map((pds, i) => pageHtml(pds, i)).join('')
}

/** 工单二维码(与「打印工单」同一内容:公司代码@工单号@1000+行号);失败返回 '' */
async function woQrImg(row) {
  try {
    const lib = qrLib()
    if (!lib) throw new Error('qrcode lib unavailable')
    return await lib.toDataURL(woQrText(row), { margin: 1, errorCorrectionLevel: 'M' })
  } catch (e) {
    console.warn('[print-formats] 排单计划二维码生成失败:', e?.message || e)
    return ''
  }
}

/**
 * 排单计划整张 HTML(**单张纸**:纸表列 + 单据编号 + 行尾二维码,主要信息全融在同一行);
 * 单独导出便于单测/预览。用户口径:「不是这样实现,是当前同一行融合起来」。
 */
export async function schedPlanPrintHtml(rows, dates, opts = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean)
  if (!list.length) return ''
  return await schedPlanSheetHtml(list, dates, opts)
}

export async function printSchedPlanSheet(rows, dates, opts = {}) {
  const body = await schedPlanPrintHtml(rows, dates, opts)
  if (!body) return false
  // 2026-11-04:浏览器打印标题也跟工序产线走(与纸表标题同一份推导),不再固定「成型车间排单计划」
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean)
  const title = String(opts?.title ?? '').trim() || planSheetTitle(planSheetShop(list, opts))
  if (!printInPage(title, body)) {
    alert(PRINT_FAIL_MSG)
    return false
  }
  return true
}
