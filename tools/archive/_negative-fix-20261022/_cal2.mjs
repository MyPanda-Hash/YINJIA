/**
 * 精确标定:每行能放多少汉字 = 可用宽 / 字号(向下取整,中文全角约等于 1 个字号宽)
 * 用 JS 精确量一次(单行不换行时的实际宽度)。
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_cal2'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S}>
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>单</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} style="min-height:63px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">不良说明</div>
        <div class="q-value q-col" ${S}>
          <div class="as-ro-text" ${S} id="box" style="font-size:14px;line-height:1.7;white-space:nowrap">
            <span id="probe">来</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div></div></div></body></html>`
writeFileSync(`${WORK}/c.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: `file:///${WORK}/c.html` })
await sleep(1200)
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(300)

const r = JSON.parse(await cdp.ev(`(() => {
  const box = document.getElementById('box');
  const probe = document.getElementById('probe');
  const cs = getComputedStyle(box);
  const w = box.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // 量单个汉字在 14px 下的实际宽度
  const ch14 = probe.getBoundingClientRect().width;
  return JSON.stringify({ availW: Math.round(w), charW14: +ch14.toFixed(3) });
})()`))
console.log('可用宽:', r.availW, 'px   14px 单字宽:', r.charW14, 'px')
console.log('\n字号  单字宽(按比例)  每行汉字  两行容量(汉字)')
for (const fs of [14, 13, 12, 11, 10, 9, 8]) {
  const cw = r.charW14 * fs / 14
  const perLine = Math.floor(r.availW / cw)
  console.log(`${String(fs).padStart(4)}px ${String(cw.toFixed(2)).padStart(13)} ${String(perLine).padStart(9)} ${String(perLine * 2).padStart(13)}`)
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
