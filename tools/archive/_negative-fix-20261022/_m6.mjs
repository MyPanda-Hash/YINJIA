/**
 * 六格实测(带正确的 SFC 作用域属性)
 * 目标:量出供应商/采购单号/产品名称 + 总数量/不合格品数量/不合格品比例 的真实宽度
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_t8'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }

const S = (() => {
  const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
  const m = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)
  if (!m) throw new Error('CSS 里找不到 .q-pairs 作用域属性')
  console.log('作用域:', m[1])
  return m[1]
})()
const L = (t, w) => `<div class="q-label" ${S} style="width:${w}px">${t}</div>`
const R = (v) => `<div class="q-value" ${S}><div class="as-ref-ctl" ${S}><span class="as-ref-text" ${S}>${v}</span></div></div>`
const P = (lbl, lw, flex, val, id) => `<div class="q-pair" ${S} style="flex:${flex}" id="${id}">${L(lbl, lw)}${R(val)}</div>`

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S} id="sheet">
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>申</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} id="row1" style="min-height:52px">
      ${P('供应商', 130, 292, '伊诺凯化学试剂有限公司', 'a1')}
      ${P('采购单号', 130, 292, 'YJ-20260915-11', 'a2')}
      ${P('产品名称', 130, 292, '硫酸氧钛', 'a3')}
    </div>
    <div class="as-row q-pairs" ${S} id="row2" style="min-height:63px">
      ${P('总数量', 130, 292, '1kg', 'b1')}
      ${P('不合格品数量', 130, 292, '1', 'b2')}
      ${P('不合格品比例', 130, 292, '100%', 'b3')}
    </div>
  </div>
</div></div></div></body></html>`
writeFileSync(`${WORK}/t.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: 'file:///' + `${WORK}/t.html`.replace(/\\/g, '/') })
await sleep(2000)
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(600)

const res = await cdp.ev(`JSON.stringify({
  sheet: Math.round(document.getElementById('sheet').getBoundingClientRect().width),
  cells: ['a1','a2','a3','b1','b2','b3'].map(id => {
    const p = document.getElementById(id);
    const pr = p.getBoundingClientRect();
    const lab = p.querySelector('.q-label').getBoundingClientRect();
    const val = p.querySelector('.q-value').getBoundingClientRect();
    const ctl = p.querySelector('.as-ref-ctl').getBoundingClientRect();
    const txt = p.querySelector('.as-ref-text');
    return { id, label: p.querySelector('.q-label').textContent,
      pairW: Math.round(pr.width), labelW: Math.round(lab.width), valueW: Math.round(val.width),
      ctlW: Math.round(ctl.width),
      ctlSpillLeft: Math.round(pr.left - ctl.left), ctlSpillRight: Math.round(ctl.right - pr.right),
      txtW: txt.clientWidth, txtSW: txt.scrollWidth, txtH: Math.round(txt.getBoundingClientRect().height), ws: getComputedStyle(txt).whiteSpace, ow: getComputedStyle(txt).overflowWrap, ov: getComputedStyle(txt).overflow, ctlH: Math.round(ctl.height), clipped: txt.scrollWidth > txt.clientWidth + 1 };
  })
})`)
const r = JSON.parse(res)
console.log('纸面宽:', r.sheet, 'px\n')
console.log('格  标签          组宽   标签宽  值区宽  控件宽  左溢出  右溢出  文字(容/需) 截断')
for (const c of r.cells) {
  console.log(`${c.id}  ${c.label.padEnd(8)} ${String(c.pairW).padStart(5)} ${String(c.labelW).padStart(6)} ${String(c.valueW).padStart(7)} ${String(c.ctlW).padStart(7)} ${String(c.ctlSpillLeft).padStart(7)} ${String(c.ctlSpillRight).padStart(7)}  ${String(c.txtW).padStart(5)}/${String(c.txtSW).padStart(5)} ${c.clipped ? '❌' : '✅'}`)
}

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
const data = shot.data || (shot.result && shot.result.data)
writeFileSync(`${WORK}/shot.png`, Buffer.from(data, 'base64'))
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
console.log('\n截图:', `${WORK}/shot.png`)
cdp.close()
