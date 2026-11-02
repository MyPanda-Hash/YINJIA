/**
 * 「不良说明」打印态截图:看真实渲染长什么样
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_bad'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

const LONG = '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采'
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S} style="background:#fff;width:938px;zoom:.78">
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>单</span><span class="q-vchar" ${S}>位</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} id="row" style="min-height:63px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">不良说明</div>
        <div class="q-value" ${S} id="val">
          <div class="el-input el-input--small as-cell-input" ${S}><div class="el-input__wrapper"><input class="el-input__inner" value="${LONG}" /></div></div>
        </div>
      </div>
    </div>
    <div class="as-row q-pairs" ${S} style="min-height:61px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">严重程度</div>
        <div class="q-value" ${S}><div class="q-checks spread" ${S}><span class="q-check" ${S}>□ 严重</span><span class="q-check" ${S}>□ 一般</span><span class="q-check" ${S}>□ 轻微</span></div></div>
      </div>
    </div>
  </div>
</div></div></div>
<style>
  .el-input__wrapper{display:flex;align-items:center;box-shadow:0 0 0 1px #dcdfe6 inset;border-radius:4px;background:#fff;padding:1px 11px;width:100%;box-sizing:border-box}
  .el-input__inner{width:100%;border:none;outline:none;font-size:14px;height:32px;background:transparent}
  .as-cell-input{width:100%}
  body{margin:0;padding:8px;background:#fff}
</style>
</body></html>`
writeFileSync(`${WORK}/shot.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 300, deviceScaleFactor: 2, mobile: false })
await cdp.send('Page.navigate', { url: `file:///${WORK}/shot.html` })
await sleep(1500)
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
const data = shot.data || (shot.result && shot.result.data)
writeFileSync(`${WORK}/bad.png`, Buffer.from(data, 'base64'))
await cdp.send('Emulation.clearDeviceMetricsOverride')
console.log('截图:', `${WORK}/bad.png`)
cdp.close()
