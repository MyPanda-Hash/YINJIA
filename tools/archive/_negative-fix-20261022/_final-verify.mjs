/**
 * 最终验证:用真实浏览器在 print 媒体下渲染特采申请单版式,量纸面尺寸并生成 PDF 数页数
 *
 * 由于沙箱拦截浏览器访问 127.0.0.1,这里把**真实的生产构建产物**(PanelxList CSS+JS)
 * 拷到本地,构造一份与原页面同结构的 HTML,再在 print 媒体下测量。
 * 这样量到的是真浏览器的真实排版结果。
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_testpage'
mkdirSync(WORK, { recursive: true })

// ① 找 PanelxList 的 css
const cssName = readFileSync('D:/YINJIA-main/frontend/dist/index.html', 'utf8')
let panelCss = null
for (const f of ['PanelxList-MP_b-Sv8.css']) {
  try { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); panelCss = f; break } catch { /* */ }
}
if (!panelCss) {
  const { readdirSync } = await import('node:fs')
  for (const f of readdirSync(DIST)) {
    if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); panelCss = f; break }
  }
}
console.log('使用 CSS:', panelCss)

/** 构造与 DocSheet 同结构的纸面 HTML,套上真实的打印样式 */
const rows = [
  ['pairs', 52, [['供应商', 105, 243, '供应商名称示例'], ['采购单号', 172, 338, 'YJ-20260915-06'], ['产品名称', 130, 292, '硫酸氧钛']]],
  ['pairs', 63, [['总数量', 105, 243, '1kg'], ['不合格品数量', 172, 338, '1'], ['不合格品比例', 130, 292, '100%']]],
]

let body = ''
// 页眉
body += `<div class="as-topbar"><div class="as-company">惠州市银嘉环保科技有限公司</div><div class="as-docno">YJ-QR-60</div></div>`
body += `<div class="as-title-row"><div class="as-title">特采申请单</div></div>`
// 表体(vcell 段 → q-vrun/q-vrows)
body += `<div class="as-table"><div class="q-vrun"><div class="q-vlabel" style="width:65px">` +
  '<span class="q-vchar">申</span><span class="q-vchar">请</span><span class="q-vchar">单</span><span class="q-vchar">位</span>' +
  `</div><div class="q-vrows">`
for (const [kind, h, cells] of rows) {
  body += `<div class="as-row q-pairs" style="min-height:${h}px">`
  for (const [label, lw, flex, val] of cells) {
    body += `<div class="q-pair" style="flex:${flex}"><div class="q-label" style="width:${lw}px">${label}</div>` +
      `<div class="q-value"><div class="as-ref-ctl"><span class="as-ref-text">${val}</span></div></div></div>`
  }
  body += '</div>'
}
// 再补几个典型行凑高度
const more = [
  ['不良说明', 63], ['严重程度', 61], ['特采理由', 185],
]
for (const [label, h] of more) {
  body += `<div class="as-row q-pairs" style="min-height:${h}px"><div class="q-pair" style="flex:1">` +
    `<div class="q-label" style="width:105px">${label}</div><div class="q-value"></div></div></div>`
}
body += `</div></div></div>`   // q-vrows / q-vrun / as-table

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${panelCss}">
<style>
  body { margin:0; padding:0; background:#fff; }
  .approval-sheet { background:#fff; }
</style>
</head><body class="approval-printing">
<div class="approval-sheet">
${body}
</div>
</body></html>`
writeFileSync(`${WORK}/sheet.html`, html, 'utf8')
console.log('测试页已生成:', `${WORK}/sheet.html`)

// ② 用 CDP 打开并测量
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
const cdp = await attachCdp(PORT, page.id)
const ev = cdp.ev
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

await cdp.send('Page.navigate', { url: 'file:///' + `${WORK}/sheet.html`.replace(/\\/g, '/') })
await sleep(2500)

const m = await ev(`(() => {
  const s = document.querySelector('.approval-sheet');
  const cs = getComputedStyle(s);
  const r = s.getBoundingClientRect();
  const clipped = [];
  s.querySelectorAll('.as-ref-text').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 1) clipped.push({ t: el.textContent, cw: el.clientWidth, sw: el.scrollWidth });
  });
  return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height),
    width: cs.width, zoom: cs.zoom, textOverflow: getComputedStyle(s.querySelector('.as-ref-text')).textOverflow,
    clipped, hasQvrows: !!s.querySelector('.q-vrows') });
})()`)
console.log('\n=== 屏幕媒体下测量 ===')
console.log(m)

// ③ 切 print 媒体再量
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(800)
const mp = await ev(`(() => {
  const s = document.querySelector('.approval-sheet');
  const cs = getComputedStyle(s);
  const r = s.getBoundingClientRect();
  const t = s.querySelector('.as-ref-text');
  const clipped = [];
  s.querySelectorAll('.as-ref-text').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 1) clipped.push({ t: el.textContent, cw: el.clientWidth, sw: el.scrollWidth });
  });
  return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height),
    cssWidth: cs.width, zoom: cs.zoom,
    textOverflow: getComputedStyle(t).textOverflow,
    whiteSpace: getComputedStyle(t).whiteSpace,
    overflow: getComputedStyle(t).overflow,
    breakInside: cs.breakInside,
    clipped });
})()`)
console.log('\n=== 打印媒体下测量 ===')
const mpj = JSON.parse(mp)
console.log(JSON.stringify(mpj, null, 2))

const MM = 3.7795275591
const PRINT_W = 210 * MM - 16 * MM
const PRINT_H = 297 * MM - 16 * MM
console.log('\n=== 判定 ===')
console.log('   A4 可打印区:', PRINT_W.toFixed(1), 'x', PRINT_H.toFixed(1), 'px')
console.log('   纸面:', mpj.w, 'x', mpj.h, 'px  (zoom', mpj.zoom + ')')
console.log('   宽度:', mpj.w <= PRINT_W + 1 ? '✅ 不超' : '❌ 超出')
console.log('   高度:', mpj.h <= PRINT_H ? '✅ 一页放得下' : `❌ 超 ${(mpj.h - PRINT_H).toFixed(0)}px`)
console.log('   省略号:', mpj.textOverflow === 'clip' ? '✅ 已关闭' : '❌ 仍为 ' + mpj.textOverflow)
console.log('   被截断的值:', mpj.clipped.length === 0 ? '✅ 无' : '❌ ' + JSON.stringify(mpj.clipped))

// ④ 生成 PDF 数页数
const pdf = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: false })
const data = pdf.data || (pdf.result && pdf.result.data)
if (data) {
  const buf = Buffer.from(data, 'base64')
  writeFileSync(`${WORK}/out.pdf`, buf)
  const raw = buf.toString('latin1')
  const cnt = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length
  console.log('\n=== printToPDF 结果 ===')
  console.log('   PDF 大小:', buf.length, 'bytes')
  console.log('   页数:', cnt, cnt === 1 ? '✅ 一页' : `❌ ${cnt} 页`)
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
