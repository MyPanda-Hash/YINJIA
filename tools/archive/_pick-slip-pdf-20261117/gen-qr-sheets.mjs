/**
 * gen-qr-sheets.mjs — 「物料编码 → 二维码」两张纸(组装 / 混料),A4 竖版。
 *
 * 用户口径(2026-11-17 追问):「我要的是物料编码对应的二维码」——
 *   即每个**物料编码**自己的材料仓条码,不是领料单抬头那个工单码。
 *
 * 码内容口径(**与系统扫码端完全一致**,别自创):
 *   `公司代码@存货编码[@批号]` = `0@<物料编码>`(本单所有明细的批号都为空 ⇒ 两段)。
 *   依据:`core/panel/companyCode.js`(公司代码常量 '0')、
 *        `print-formats.productCardQrText()`(标识卡)、
 *        `scanPick.parseBarcode()`(条码管理刚改的新码式)、
 *        `MobilePick.vue.applyScan()` 注释「物料码 0@YJ-ZZ-001 → 物料编码,不带批次 ⇒ 列出该物料全部批次」。
 *
 * 输出:qr-组装.html / qr-混料.html(由 ego 浏览器 Page.printToPDF 落 A4 PDF)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire('D:/YINJIA-main/frontend/package.json')
const QRCode = require('qrcode')

const COMPANY_CODE = '0'   // core/panel/companyCode.js
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtQty = (v) => (Number(v) > 0 ? String(Math.round(Number(v) * 10000) / 10000) : '')

function readPayload() {
  const raw = readFileSync(join(HERE, '04-payload.out.txt'), 'utf8')
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith('| ['))
  if (!line) throw new Error('04-payload.out.txt 里找不到 JSON 行')
  return JSON.parse(line.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, ''))
}

const PRINT_DATE = '2026-11-17'

function sheetHtml({ title, lines, doc, qrByCode }) {
  const cards = lines.map((r) => {
    const code = String(r['物料编码'] || '').trim()
    const qr = qrByCode.get(code) || ''
    const semi = code.toUpperCase().includes('**TB')
    return '<div class="card">'
      + `<div class="q"><img src="${qr}"/></div>`
      + '<div class="txt">'
      + `<div class="code">${esc(code)}</div>`
      + `<div class="name">${esc(r['材料名称'] || '')}${semi ? '<span class="semi">半成品·免领</span>' : ''}</div>`
      + `<div class="meta">${r['规格'] ? '规格 ' + esc(r['规格']) + ' · ' : ''}单位 ${esc(r['单位'] || '')}</div>`
      + `<div class="qty">请领 ${fmtQty(r['请领数量']) || '—'}</div>`
      + `<div class="qrtext">码内容 ${esc(COMPANY_CODE + '@' + code)}</div>`
      + '</div>'
      + '</div>'
  })
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>'
    + '@page{size:A4 portrait;margin:0}'
    + '.sheet{width:210mm;height:297mm;box-sizing:border-box;padding:12mm;background:#fff;'
    + 'font-family:"Microsoft YaHei",system-ui,sans-serif;color:#000}'
    + '.hd{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:0.6mm solid #000;padding-bottom:3mm}'
    + '.hd .t{font-size:21pt;font-weight:700;letter-spacing:2mm}'
    + '.hd .r{text-align:right;font-size:10pt;line-height:1.5}'
    + '.sub{margin:3mm 0 6mm;font-size:10.5pt}'
    + '.sub b{font-weight:700}'
    + '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5mm}'
    + '.card{width:auto;height:52mm;box-sizing:border-box;border:0.4mm solid #000;'
    + 'display:flex;align-items:center;gap:4mm;padding:3mm}'
    + '.q{flex:none;width:40mm;height:40mm}.q img{width:40mm;height:40mm;display:block}'
    + '.txt{flex:1;min-width:0}'
    + '.code{font-family:Consolas,"Courier New",monospace;font-size:13pt;font-weight:700;'
    + 'word-break:break-all;line-height:1.25}'
    + '.name{font-size:10.5pt;margin-top:1mm;word-break:break-all}'
    + '.semi{margin-left:1.5mm;font-size:8pt;border:0.3mm solid #000;padding:0 1mm;white-space:nowrap}'
    + '.meta{font-size:8.5pt;color:#222;margin-top:1mm;word-break:break-all}'
    + '.qty{font-size:10pt;margin-top:1mm}'
    + '.qrtext{font-size:7.5pt;color:#444;margin-top:1mm;font-family:Consolas,"Courier New",monospace;word-break:break-all}'
    + '.ft{margin-top:7mm;font-size:8.5pt;color:#333;line-height:1.6;border-top:0.3mm dashed #666;padding-top:2mm}'
    + '</style></head><body><div class="sheet">'
    + '<div class="hd"><div class="t">物料编码二维码</div>'
    + `<div class="r">工单 ${esc(doc['工单号'] + '#' + doc['工单行号'])}<br/>领料单号 ${esc(doc['领料单号'])}<br/>日期 ${PRINT_DATE}</div></div>`
    + `<div class="sub">${esc(title)} · 产品 <b>${esc(doc['产品编号'])}</b> ${esc(doc['产品名称'])} · 共 ${lines.length} 个物料编码</div>`
    + '<div class="grid">' + cards.join('') + '</div>'
    + '<div class="ft">码内容口径 = 公司代码@物料编码(批号为空时只两段),与「条码管理 · 材料仓条码」'
    + '和「商品标识卡」同一个口径;扫「生产领料」页的物料输入框即可带出该物料及其全部批次。</div>'
    + '</div></body></html>'
}

const docs = readPayload()
const out = []
for (const d of docs) {
  const mix = d['领料类型'] === '混料'
  const lines = d['明细JSON']
  const qrByCode = new Map()
  for (const r of lines) {
    const code = String(r['物料编码'] || '').trim()
    const text = COMPANY_CODE + '@' + code
    qrByCode.set(code, await QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: 'M' }))
  }
  const file = join(HERE, `qr-${mix ? '混料' : '组装'}.html`)
  writeFileSync(file, sheetHtml({
    title: '生产领料单（' + (mix ? '混料' : '组装') + '）',
    lines, doc: d, qrByCode,
  }), 'utf8')
  out.push({ file, 类型: d['领料类型'], 编码: lines.map((r) => COMPANY_CODE + '@' + r['物料编码']) })
}
console.log(JSON.stringify(out, null, 2))
