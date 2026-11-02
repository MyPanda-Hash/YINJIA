/** 诊断:测试页里 CSS 是否真的生效 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_t7'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
console.log('CSS 文件:', cssName)

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" data-v-b3f5515f>
<div class="as-table" data-v-b3f5515f><div class="q-vrun" data-v-b3f5515f>
  <div class="q-vlabel" data-v-b3f5515f style="width:65px"><span class="q-vchar" data-v-b3f5515f>申</span></div>
  <div class="q-vrows" data-v-b3f5515f>
    <div class="as-row q-pairs" data-v-b3f5515f style="min-height:52px">
      <div class="q-pair" data-v-b3f5515f style="flex:243"><div class="q-label" data-v-b3f5515f style="width:105px">供应商</div><div class="q-value" data-v-b3f5515f><div class="as-ref-ctl" data-v-b3f5515f><span class="as-ref-text" data-v-b3f5515f>伊诺凯化学试剂有限公司</span></div></div></div>
      <div class="q-pair" data-v-b3f5515f style="flex:338"><div class="q-label" data-v-b3f5515f style="width:172px">采购单号</div><div class="q-value" data-v-b3f5515f><div class="as-ref-ctl" data-v-b3f5515f><span class="as-ref-text" data-v-b3f5515f>YJ-20260915-11</span></div></div></div>
      <div class="q-pair" data-v-b3f5515f style="flex:292"><div class="q-label" data-v-b3f5515f style="width:130px">产品名称</div><div class="q-value" data-v-b3f5515f><div class="as-ref-ctl" data-v-b3f5515f><span class="as-ref-text" data-v-b3f5515f>硫酸氧钛</span></div></div></div>
    </div>
  </div>
</div></div></div></body></html>`
writeFileSync(`${WORK}/t.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: 'file:///' + `${WORK}/t.html`.replace(/\\/g, '/') })
await sleep(2500)

const dbg = await cdp.ev(`JSON.stringify({
  sheets: [...document.styleSheets].map(s => s.href),
  qpairsDisplay: getComputedStyle(document.querySelector('.q-pairs')).display,
  qpairFlex: getComputedStyle(document.querySelector('.q-pair')).flex,
  qpairW: Math.round(document.querySelector('.q-pair').getBoundingClientRect().width),
  ctlWidth: getComputedStyle(document.querySelector('.as-ref-ctl')).width,
  rowDisplay: getComputedStyle(document.querySelector('.as-row')).display
})`)
console.log('诊断:', dbg)
cdp.close()
