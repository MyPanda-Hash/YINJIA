/**
 * 检查 102 字在 14px / 2 行下:是否被 line-clamp 截掉内容
 * 若有截断,需要让字号继续下降
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_trunc'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

const cases = [
  ['52字', '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采'],
  ['80字', '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采。该批物料储存条件不达标'],
  ['102字', '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采。另外该批物料生产日期为2026年9月，保质期至2027年3月，需尽快安排使用以避免过期报废造成损失'],
]

for (const [label, txt] of cases) {
  for (const fs of [14, 13, 12]) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S}>
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>单</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} id="row" style="min-height:63px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">不良说明</div>
        <div class="q-value q-col" ${S}>
          <div class="as-ro-text" ${S} id="txt" class="as-ro-text" style="font-size:${fs}px !important">${txt}</div>
        </div>
      </div>
    </div>
  </div>
</div></div></div></body></html>`
    writeFileSync(`${WORK}/t.html`, html, 'utf8')
    await cdp.send('Page.navigate', { url: `file:///${WORK}/t.html` })
    await sleep(800)
    await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
    await sleep(220)
    const r = JSON.parse(await cdp.ev(`(() => {
      const t = document.getElementById('txt');
      const cs = getComputedStyle(t);
      const lh = parseFloat(cs.lineHeight);
      // 用 Range 量实际渲染高度(不受 line-clamp 的 clientHeight 影响)
      const range = document.createRange(); range.selectNodeContents(t);
      const naturalH = range.getBoundingClientRect().height;
      const boxH = t.getBoundingClientRect().height;
      const naturalLines = Math.round(naturalH / lh);
      return JSON.stringify({
        naturalLines, boxLines: Math.round(boxH / lh),
        truncated: naturalH > boxH + 1
      });
    })()`))
    console.log(`${label.padEnd(6)} ${fs}px → 自然 ${r.naturalLines} 行 / 显示 ${r.boxLines} 行 → ${r.truncated ? '❌ 被截断' : '✅ 完整'}`)
  }
  console.log('')
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
