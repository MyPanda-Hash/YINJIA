/**
 * 测「不良说明」在 63px 行高下、两行文本的容量:
 * 能显示多少字?超出两行会怎样(截断 / 滚动)?
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_cap'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

const mk = (txt) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S}>
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>单</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} id="row" style="min-height:63px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">不良说明</div>
        <div class="q-value q-col" ${S} id="val">
          <div class="el-textarea as-fill-input as-fill-area" ${S}><textarea class="el-textarea__inner" id="ta" rows="2">${txt}</textarea></div>
        </div>
      </div>
    </div>
  </div>
</div></div></div></body></html>`

const texts = [
  ['30字', '来料检验发现该批硫酸氧钛含量低于标准要求外观有结块现象'],
  ['52字', '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采'],
  ['80字', '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采。另外该批物料生产日期为2026年9月，保质期至2027年3月，需尽快使用避免过期报废处理造成损失'],
]

for (const [label, txt] of texts) {
  writeFileSync(`${WORK}/t.html`, mk(txt), 'utf8')
  await cdp.send('Page.navigate', { url: `file:///${WORK}/t.html` })
  await sleep(1200)
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
  await sleep(300)
  const r = await cdp.ev(`(() => {
    const ta = document.getElementById('ta');
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight);
    const inner = ta.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const linesVisible = Math.floor(inner / lh);
    return JSON.stringify({
      chars: ta.value.length,
      clientH: ta.clientHeight, scrollH: ta.scrollHeight,
      linesVisible, linesNeeded: Math.ceil(ta.scrollHeight / lh),
      truncated: ta.scrollHeight > ta.clientHeight + 2,
      overflowY: cs.overflowY
    });
  })()`)
  console.log(`【${label}】`, r)
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
