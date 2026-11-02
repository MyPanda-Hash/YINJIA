/**
 * 实测特采申请单六格(供应商/采购单号/产品名称 + 总数量/不合格品数量/不合格品比例)
 * 在打印媒体下的实际宽度,定位「窜出去」与「占位不一致」
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_t6'
mkdirSync(WORK, { recursive: true })

let panelCss = null
for (const f of readdirSync(DIST)) {
  if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); panelCss = f; break }
}

const L = (t, w) => `<div class="q-label" style="width:${w}px">${t}</div>`
const R = (v) => `<div class="q-value"><div class="as-ref-ctl"><span class="as-ref-text">${v}</span></div></div>`
const P = (lbl, lw, flex, val) => `<div class="q-pair" style="flex:${flex}">${L(lbl, lw)}${R(val)}</div>`

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${panelCss}">
<style>body{margin:0;background:#fff}</style></head>
<body class="approval-printing"><div class="approval-sheet" id="sheet">
<div class="as-table"><div class="q-vrun">
  <div class="q-vlabel" style="width:65px"><span class="q-vchar">申</span></div>
  <div class="q-vrows">
    <div class="as-row q-pairs" id="row1" style="min-height:52px">
      ${P('供应商', 105, 243, '伊诺凯化学试剂有限公司')}
      ${P('采购单号', 172, 338, 'YJ-20260915-11')}
      ${P('产品名称', 130, 292, '硫酸氧钛')}
    </div>
    <div class="as-row q-pairs" id="row2" style="min-height:63px">
      ${P('总数量', 105, 243, '1kg')}
      ${P('不合格品数量', 172, 338, '1')}
      ${P('不合格品比例', 130, 292, '100%')}
    </div>
  </div>
</div></div></div></body></html>`
writeFileSync(`${WORK}/t.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
const cdp = await attachCdp(PORT, page.id)
const ev = cdp.ev
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: 'file:///' + `${WORK}/t.html`.replace(/\\/g, '/') })
await sleep(2000)
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' }); const dbg = await ev(`JSON.stringify({ cssLoaded: [...document.styleSheets].map(s=>s.href), qpairFlex: getComputedStyle(document.querySelector('.q-pair')).flex, qpairsDisplay: getComputedStyle(document.querySelector('.q-pairs')).display, ctlW: getComputedStyle(document.querySelector('.as-ref-ctl')).width })`)
console.log('调试:', dbg)
await sleep(600)

const res = await ev(`(() => {
  const out = { sheetW: Math.round(document.getElementById('sheet').getBoundingClientRect().width), rows: [] };
  for (const id of ['row1','row2']) {
    const row = document.getElementById(id);
    const pairs = [...row.querySelectorAll('.q-pair')];
    out.rows.push({ id, rowW: Math.round(row.getBoundingClientRect().width), pairs: pairs.map(p => {
      const lab = p.querySelector('.q-label');
      const val = p.querySelector('.q-value');
      const ctl = p.querySelector('.as-ref-ctl');
      const txt = p.querySelector('.as-ref-text');
      const pr = p.getBoundingClientRect(), vr = val.getBoundingClientRect(), cr = ctl.getBoundingClientRect();
      return {
        label: lab.textContent,
        pairW: Math.round(pr.width),
        labelW: Math.round(lab.getBoundingClientRect().width),
        valueW: Math.round(vr.width),
        ctlW: Math.round(cr.width),
        ctlOverflowX: Math.round(cr.left - pr.left) < 0 ? 'L' : (Math.round(cr.right - pr.right) > 1 ? 'R' : 'ok'),
        txtScrollW: txt.scrollWidth, txtClientW: txt.clientWidth,
        textClipped: txt.scrollWidth > txt.clientWidth + 1,
      };
    })});
  }
  return JSON.stringify(out);
})()`)
const r = JSON.parse(res)
console.log('纸面宽:', r.sheetW, 'px  (打印媒体 + 938px + zoom .78 =', Math.round(938*0.78), ')')
for (const row of r.rows) {
  console.log(`\n=== ${row.id} 行宽 ${row.rowW}px ===`)
  for (const p of row.pairs) {
    console.log(`   ${p.label.padEnd(7)} 组宽${String(p.pairW).padStart(4)}  标签${String(p.labelW).padStart(4)}  值区${String(p.valueW).padStart(4)}  控件${String(p.ctlW).padStart(4)}  溢出:${p.ctlOverflowX}  文字${p.txtClientW}/${p.txtScrollW}${p.textClipped?' ❌截断':''}`)
  }
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })

// 截图看实际
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
const data = shot.data || (shot.result && shot.result.data)
writeFileSync(`${WORK}/shot.png`, Buffer.from(data, 'base64'))
console.log('\n截图:', `${WORK}/shot.png`)
cdp.close()
