/**
 * 用 scrollHeight 判断自然行数(不受 line-clamp 影响)
 * 对每个字号:去掉 clamp → 量 scrollHeight/lineHeight = 自然行数
 * 同时给出「用了 fitFontSize 后最终选中哪个字号」
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_sh'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

// 与 DocSheet.vue 一致的算法
const SIZES = [14, 13, 12, 11, 10, 9, 8]
const AVAIL_W = 545, RATIO = 0.78
function fitFontSize(text, lines = 2) {
  if (!text) return 14
  const units = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : 0.55), 0)
  for (const fs of SIZES) {
    const perLine = Math.floor(AVAIL_W / (fs * RATIO))
    if (Math.ceil(units / perLine) <= lines) return fs
  }
  return 8
}

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

const texts = {
  '52字': '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采',
  '80字': '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采。该批物料储存条件不达标',
  '102字': '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采。另外该批物料生产日期为2026年9月，保质期至2027年3月，需尽快安排使用以避免过期报废造成损失',
  '200字': '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采。'.repeat(3),
}

console.log('字数  选定字号  该字号自然行数  是否≤2行\n')
for (const [label, txt] of Object.entries(texts)) {
  const fs = fitFontSize(txt)
  // 不带 clamp,量自然行数
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
          <div class="as-ro-text" ${S} id="txt" style="font-size:${fs}px">${txt}</div>
        </div>
      </div>
    </div>
  </div>
</div></div></div></body></html>`
  writeFileSync(`${WORK}/t.html`, html, 'utf8')
  await cdp.send('Page.navigate', { url: `file:///${WORK}/t.html` })
  await sleep(850)
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
  await sleep(220)
  const r = JSON.parse(await cdp.ev(`(() => {
    const t = document.getElementById('txt');
    const cs = getComputedStyle(t);
    const lh = parseFloat(cs.lineHeight);
    // 去掉高度限制,让内容自然展开
    t.style.display='block'; t.style.height='auto'; t.style.overflow='visible';
    const naturalH = t.scrollHeight;
    return JSON.stringify({ lh:+lh.toFixed(2), naturalH, naturalLines: Math.round(naturalH/lh) });
  })()`))
  console.log(`${label.padEnd(6)} ${String(fs).padStart(6)}px ${String(r.naturalLines).padStart(12)} ${r.naturalLines <= 2 ? '  ✅' : '  ❌'}`)
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
