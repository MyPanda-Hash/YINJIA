/**
 * gen-slips.mjs — 生成「生产领料单（组装 / 混料）」纸面 HTML(中一刀 210×148.5mm 横打)。
 *
 * 数据来源:04-payload.sql 从 **HSDZ_MES_TEST** 取 `wo_pick_doc` + `wo_pick_line`
 *   (工单 GD-2026-11-0009 行 1;正式库 HSDZ_MES 里没有这张单)。
 *
 * 版式来源:frontend/src/business/print-formats.js 的 `pickSlipHtml()`(浏览器打印层,
 *   与打印代理同一张纸)。本脚本按**同一张纸**复刻,唯一改动 = 用户 2026-11-17 要求
 *   「包括组装和混料的物料编码都打印」⇒ 在「订单号」右侧加一列 **物料编码**
 *   (页面明细里本来就显示 物料编码/规格型号/计量单位,见 MobilePickDoc.vue §明细)。
 *
 * 输出:slip-组装.html / slip-混料.html(由 ego 浏览器 Page.printToPDF 落 PDF)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire('D:/YINJIA-main/frontend/package.json')
const QRCode = require('qrcode')

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtQty = (v) => (Number(v) > 0 ? String(Math.round(Number(v) * 10000) / 10000) : '')

/** 读 SqlRunner 的输出、剥掉装饰行,拿回 JSON 数组 */
function readPayload() {
  const raw = readFileSync(join(HERE, '04-payload.out.txt'), 'utf8')
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith('| [') || l.trim().startsWith('| [{'))
  if (!line) throw new Error('04-payload.out.txt 里找不到 JSON 行')
  const json = line.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '')
  return JSON.parse(json)
}

/**
 * 一张纸的 HTML(与 pickSlipHtml 同版式,列多一列 物料编码)。
 * @param {object} p {标题,领料单号,工单号,工单行号,打印日期,明细:[{物料编码,材料名称,规格,单位,请领数量,实发数量,备注}]}
 * @param {string} qr 二维码 dataURL
 */
function slipHtml(p, qr) {
  const title = String(p['标题'] ?? '').trim() || '生产领料单'
  const outNo = String(p['领料单号'] ?? '').trim()
  const printDate = String(p['打印日期'] ?? '').trim() || new Date().toISOString().slice(0, 10)
  const woTag = String(p['工单号'] ?? '').trim() + (Number(p['工单行号']) ? '#' + Number(p['工单行号']) : '')
  const rows = Array.isArray(p['明细']) ? p['明细'] : []
  const heads = ['订单号', '物料编码', '材料名称', '规格', '单位', '请领数量', '实发数量', '备注']
  const signs = ['部门主管:', '仓库主管:', '领料人:', '仓管员:']
  const cell = (v) => (v === 0 || v ? esc(String(v)) : '')

  const perPage = 10
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage))
  const cards = []
  for (let pg = 0; pg < pageCount; pg++) {
    const slice = rows.slice(pg * perPage, (pg + 1) * perPage)
    const n = Math.max(8, slice.length)          // 纸表固定 8 行格子;空行连单号都不印
    let tbody = ''
    for (let i = 0; i < n; i++) {
      const r = slice[i]
      if (!r) {
        tbody += '<tr><td></td><td></td><td></td><td></td><td></td><td class="num"></td><td class="num"></td><td></td></tr>'
        continue
      }
      tbody += '<tr>'
        + `<td class="nw wo">${esc(woTag)}</td>`
        + `<td class="nw code">${cell(r['物料编码'])}</td>`
        + `<td>${cell(r['材料名称'])}</td>`
        + `<td>${cell(r['规格'])}</td>`
        + `<td class="nw">${cell(r['单位'])}</td>`
        + `<td class="num nw">${fmtQty(r['请领数量'])}</td>`
        + `<td class="num nw">${fmtQty(r['实发数量'])}</td>`
        + `<td class="nw">${cell(r['备注'])}</td>`
        + '</tr>'
    }
    cards.push('<div class="card">'
      + '<div class="hd">'
      + (qr ? `<div class="qr"><img src="${qr}"/></div>` : '')
      + '<div class="hm">'
      + `<div class="no">No ${esc(outNo || '-')}</div>`
      + `<div class="t">${esc(title)}</div>`
      + `<div class="meta"><span>领料部门:${esc(p['领料部门'] || '')}</span><span>日期:${esc(printDate)}</span></div>`
      + '</div>'
      + '</div>'
      + '<table>'
      + '<colgroup><col style="width:20%"><col style="width:16%"><col style="width:18.5%">'
      + '<col style="width:10.5%"><col style="width:5%"><col style="width:10%"><col style="width:10%"><col style="width:10%"></colgroup>'
      + `<thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>`
      + `<tbody>${tbody}</tbody>`
      + '</table>'
      + `<div class="sign">${signs.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`
      + (pageCount > 1 ? `<div class="pg">第 ${pg + 1}/${pageCount} 页</div>` : '')
      + '</div>')
  }

  const style = '<style>'
    + '@page{size:210mm 148.5mm;margin:0}'
    + '.card{width:210mm;height:148.5mm;box-sizing:border-box;padding:5mm 6mm;'
    + 'position:relative;page-break-after:always;background:#fff;'
    + 'font-family:"Microsoft YaHei",system-ui,sans-serif;color:#000}'
    + '.card:last-child{page-break-after:auto}'
    + '.hd{display:flex;gap:3mm;align-items:flex-start}'
    + '.qr{flex:none;width:24mm;height:24mm;border:0.35mm solid #000}'
    + '.qr img{width:100%;height:100%;display:block}'
    + '.hm{flex:1;min-width:0;position:relative}'
    + '.t{text-align:center;font-size:19pt;font-weight:700;letter-spacing:3mm;margin:1mm 0 0}'
    + '.no{position:absolute;right:0;top:2mm;font-size:11pt;font-weight:700}'
    + '.meta{display:flex;justify-content:space-between;margin-top:4mm;font-size:10.5pt}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:1mm}'
    + 'th,td{border:0.3mm solid #000;padding:0.8mm 1.2mm;font-size:8.5pt}'
    + 'th{font-weight:700;text-align:center;height:7mm}'
    + 'td{height:6.4mm;word-break:break-all}'
    + 'td.code{font-family:Consolas,"Courier New",monospace;font-size:8pt}'
    + 'td.wo{font-size:7.6pt}'
    + 'td.nw{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + 'td.num{text-align:right}'
    + '.sign{margin-top:2.5mm;font-size:10.5pt;display:flex;justify-content:space-between}'
    + '.pg{position:absolute;right:6mm;bottom:3.5mm;font-size:9pt}'
    + 'body{margin:0;background:#fff}'
    + '</style>'
  return style + cards.join('')
}

const PRINT_DATE = '2026-11-17'
const docs = readPayload()
const out = []
for (const d of docs) {
  const mix = d['领料类型'] === '混料'
  const payload = {
    标题: '生产领料单（' + (mix ? '混料' : '组装') + '）',
    领料单号: d['领料单号'],
    工单号: d['工单号'],
    工单行号: d['工单行号'],
    领料部门: '',
    打印日期: PRINT_DATE,
    明细: d['明细JSON'],
  }
  const qrText = '0@' + d['工单号'] + '@' + (1000 + Math.max(1, d['工单行号'])) + '@' + (mix ? 'M' : 'A')
  const qr = await QRCode.toDataURL(qrText, { margin: 1, width: 260, errorCorrectionLevel: 'M' })
  const file = join(HERE, `slip-${mix ? '混料' : '组装'}.html`)
  writeFileSync(file, '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>'
    + payload.标题 + '</title></head><body>' + slipHtml(payload, qr) + '</body></html>', 'utf8')
  out.push({ file, 类型: d['领料类型'], 领料单号: d['领料单号'], 明细行: d['明细JSON'].length, 二维码: qrText })
}
console.log(JSON.stringify(out, null, 2))
