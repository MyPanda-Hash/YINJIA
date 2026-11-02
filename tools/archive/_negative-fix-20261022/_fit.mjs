/**
 * 验证「不良说明」自动缩字号:不同字数下,打印态是否都 ≤ 2 行、且不溢出格子、行高不变
 * 用 build 里的 fitFontSize 档位(与前端同一套算法)按字数推字号,再用真实 CSS 渲染量行数。
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_fit'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

// 与 DocSheet.vue fitFontSize 完全一致的算法
const FIT_FONT_SIZES = [14, 13, 12, 11, 10, 9, 8]
function fitFontSize(text, fitLines = 2) {
  if (!text) return FIT_FONT_SIZES[0]
  const availW = 545
  const chars = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : 0.55), 0)
  for (const fs of FIT_FONT_SIZES) {
    const perLine = Math.max(1, Math.floor((availW / (fs * 0.78))))
    if (Math.ceil(chars / perLine) <= fitLines) return fs
  }
  return FIT_FONT_SIZES[FIT_FONT_SIZES.length - 1]
}

const short = '含量偏低'
const mid = '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象'
const long = '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采'
const vlong = '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采。另外该批物料生产日期为2026年9月，保质期至2027年3月，需尽快安排使用以避免过期报废造成损失'

const cases = [['短文本', short], ['中等', mid], ['长', long], ['很长', vlong]]

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

console.log('字数 → 字号 → 渲染行数 → 是否 ≤2 行 → 是否溢出格子\n')
let allOk = true
for (const [label, txt] of cases) {
  const fs = fitFontSize(txt)
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
          <div class="as-ro-text as-ro-fit" ${S} id="txt" style="font-size:${fs}px;--fit-lines:2">${txt}</div>
        </div>
      </div>
    </div>
  </div>
</div></div></div></body></html>`
  writeFileSync(`${WORK}/t.html`, html, 'utf8')
  await cdp.send('Page.navigate', { url: `file:///${WORK}/t.html` })
  await sleep(1100)
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
  await sleep(300)
  const r = JSON.parse(await cdp.ev(`(() => {
    const t = document.getElementById('txt');
    const row = document.getElementById('row');
    const cs = getComputedStyle(t);
    const lh = parseFloat(cs.lineHeight);
    const h = t.getBoundingClientRect().height;
    return JSON.stringify({
      fontSize: parseFloat(cs.fontSize), lineHeight: lh,
      renderedLines: Math.round(h / lh),
      textH: Math.round(h), rowH: Math.round(row.getBoundingClientRect().height),
      scrollH: t.scrollHeight, clientH: t.clientHeight,
      clamp: cs.webkitLineClamp || cs.lineClamp
    });
  })()`))
  const okLines = r.renderedLines <= 2
  // 不溢出:滚动高不超过可视高(用 line-clamp 时 scrollH 可能大于 clientH,属预期收掉)
  const okRow = r.rowH <= 63 * 0.78 + 4   // 行高不被撑大(zoom .78)
  if (!okLines || !okRow) allOk = false
  console.log(`${label.padEnd(4)} ${String([...txt].length).padStart(3)}字 → ${String(fs).padStart(2)}px → 渲染 ${r.renderedLines} 行 (行高${r.lineHeight}px) → ${okLines ? '✅' : '❌'} → 格高 ${r.rowH}px ${okRow ? '✅' : '❌'}`)
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
console.log(`\n${allOk ? '✅ 全部收在两行内且未撑高行' : '❌ 有超出行数/撑高行的情况'}`)
cdp.close()
