/**
 * 精确复刻 DocSheet 的 DOM(含 as-row / q-pairs / q-value.q-col 全部层级),
 * 用真实构建 CSS 量「不良说明」行在打印态的实际高度。
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_bad3'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

// 先从 CSS 里把 .q-value / .q-col / .as-row / .as-fill-area 的真实规则打印出来
function ruleOf(sel) {
  const i = css.indexOf(sel + '[')
  const j = css.indexOf(sel + '{')
  const at = i >= 0 && (j < 0 || i < j) ? i : j
  if (at < 0) return '(未找到)'
  const end = css.indexOf('}', at)
  return css.slice(at, end + 1)
}
console.log('=== 真实 CSS 规则 ===')
for (const sel of ['.as-row', '.q-pairs', '.q-pair', '.q-value', '.q-value.q-col', '.as-fill-input', '.as-fill-area']) {
  console.log(ruleOf(sel))
}

const LONG = '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采'
// 严格复刻 DocSheet 的层级:as-table > q-vrun > q-vrows > as-row.q-pairs > q-pair > q-label + q-value.q-col
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S}>
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>申</span><span class="q-vchar" ${S}>请</span><span class="q-vchar" ${S}>单</span><span class="q-vchar" ${S}>位</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} style="min-height:52px">
      <div class="q-pair" ${S} style="flex:292"><div class="q-label" ${S} style="width:130px">供应商</div><div class="q-value" ${S}>x</div></div>
    </div>
    <div class="as-row q-pairs" ${S} id="row" style="min-height:63px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">不良说明</div>
        <div class="q-value q-col" ${S} id="val">
          <div class="el-textarea as-fill-input as-fill-area" ${S}><textarea class="el-textarea__inner" id="ta" rows="2">${LONG}</textarea></div>
        </div>
      </div>
    </div>
    <div class="as-row q-pairs" ${S} style="min-height:61px">
      <div class="q-pair" ${S} style="flex:1"><div class="q-label" ${S} style="width:130px">严重程度</div><div class="q-value" ${S}>x</div></div>
    </div>
  </div>
</div></div></div>
</body></html>`
writeFileSync(`${WORK}/t.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 400, deviceScaleFactor: 2, mobile: false })
await cdp.send('Page.navigate', { url: `file:///${WORK}/t.html` })
await sleep(1500)
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(400)

const r = await cdp.ev(`(() => {
  const row = document.getElementById('row');
  const val = document.getElementById('val');
  const ta = document.getElementById('ta');
  const rs = getComputedStyle(row), vs = getComputedStyle(val), ts = getComputedStyle(ta);
  return JSON.stringify({
    rowH: Math.round(row.getBoundingClientRect().height),
    rowStyleMinH: rs.minHeight, rowDisplay: rs.display,
    valH: Math.round(val.getBoundingClientRect().height), valMinH: vs.minHeight, valPad: vs.padding, valFlexDir: vs.flexDirection,
    taH: Math.round(ta.getBoundingClientRect().height), taScrollH: ta.scrollHeight, taClientH: ta.clientHeight,
    taLineH: ts.lineHeight, taFontSize: ts.fontSize, taWhiteSpace: ts.whiteSpace,
    fits: ta.scrollHeight <= ta.clientHeight + 2,
    sheetZoom: getComputedStyle(document.querySelector('.approval-sheet')).zoom
  });
})()`)
console.log('\n=== 打印态实测 ===')
console.log(r)

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
const data = shot.data || (shot.result && shot.result.data)
writeFileSync(`${WORK}/shot.png`, Buffer.from(data, 'base64'))
console.log('截图:', `${WORK}/shot.png`)
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
await cdp.send('Emulation.clearDeviceMetricsOverride')
cdp.close()
