/**
 * 验证「不良说明」改成多行文本后:长文本完整显示、不溢出、行高不变
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_bad2'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]
console.log('作用域:', S)

const LONG = '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采'
// textarea 分支:q-value 带 q-col,内含 el-textarea.as-fill-input.as-fill-area
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S} style="background:#fff;width:938px;zoom:.78">
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>单</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} id="row" style="min-height:63px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">不良说明</div>
        <div class="q-value q-col" ${S} id="val">
          <div class="el-textarea as-fill-input as-fill-area" ${S}><textarea class="el-textarea__inner" id="ta" rows="2">${LONG}</textarea></div>
        </div>
      </div>
    </div>
    <div class="as-row q-pairs" ${S} style="min-height:61px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">严重程度</div>
        <div class="q-value" ${S}>x</div>
      </div>
    </div>
  </div>
</div></div></div>
<style>
  .el-textarea__inner{width:100%;box-sizing:border-box;border:1px solid #dcdfe6;border-radius:4px;padding:5px 11px;font-family:inherit;font-size:14px;line-height:1.7;resize:none;overflow-y:hidden}
  body{margin:0;padding:8px;background:#fff}
</style>
</body></html>`
writeFileSync(`${WORK}/t.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 260, deviceScaleFactor: 2, mobile: false })
await cdp.send('Page.navigate', { url: `file:///${WORK}/t.html` })
await sleep(1500)

const r = await cdp.ev(`(() => {
  const row = document.getElementById('row');
  const ta = document.getElementById('ta');
  const cs = getComputedStyle(ta);
  return JSON.stringify({
    rowH: Math.round(row.getBoundingClientRect().height),
    taH: Math.round(ta.getBoundingClientRect().height),
    taW: Math.round(ta.getBoundingClientRect().width),
    scrollH: ta.scrollHeight, clientH: ta.clientHeight,
    verticalFits: ta.scrollHeight <= ta.clientHeight + 2,
    horizontalOverflow: ta.scrollWidth > ta.clientWidth + 1,
    whiteSpace: cs.whiteSpace, wrap: cs.whiteSpace !== 'nowrap'
  });
})()`)
console.log('\n测量:', r)

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
const data = shot.data || (shot.result && shot.result.data)
writeFileSync(`${WORK}/shot.png`, Buffer.from(data, 'base64'))
console.log('截图:', `${WORK}/shot.png`)
await cdp.send('Emulation.clearDeviceMetricsOverride')
cdp.close()
