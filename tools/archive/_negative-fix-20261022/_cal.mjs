/**
 * 校准:真实渲染下,各字号在 553px 宽里每行能放多少汉字
 * (我的估算 availW=520 明显偏乐观)
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_cal'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

const SAMPLE = '来'.repeat(200)   // 200 个汉字,看它折成几行 → 反推每行字数
console.log('字号  可用宽  行高   200字→行数  每行汉字  两行容量\n')
for (const fs of [14, 13, 12, 11, 10, 9, 8]) {
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
          <div class="as-ro-text" ${S} id="txt" style="font-size:${fs}px !important;line-height:1.7 !important">${SAMPLE}</div>
        </div>
      </div>
    </div>
  </div>
</div></div></div></body></html>`
  writeFileSync(`${WORK}/c.html`, html, 'utf8')
  await cdp.send('Page.navigate', { url: `file:///${WORK}/c.html` })
  await sleep(900)
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
  await sleep(250)
  const r = JSON.parse(await cdp.ev(`(() => {
    const t = document.getElementById('txt');
    const cs = getComputedStyle(t);
    const lh = parseFloat(cs.lineHeight);
    const w = t.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = t.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return JSON.stringify({ w: Math.round(w), lh: +lh.toFixed(2), lines: Math.round(h / lh), fsize: parseFloat(cs.fontSize) });
  })()`))
  const perLine = Math.floor(200 / r.lines)
  console.log(`${String(fs).padStart(4)}px ${String(r.w).padStart(5)}px ${String(r.lh).padStart(6)}px ${String(r.lines).padStart(9)} ${String(perLine).padStart(8)} ${String(perLine * 2).padStart(8)}`)
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
