/**
 * 整页验证:用真实构建 CSS + 完整纸面结构,在 print 媒体下
 * ① 量纸面总高 vs A4 可打印高
 * ② printToPDF 数页数
 * ③ 「不良说明」长文本是否完整显示
 */
import { attachCdp } from '../_cdp.mjs'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_full'
mkdirSync(WORK, { recursive: true })
let cssName = null
for (const f of readdirSync(DIST)) if (/^PanelxList-.*\.css$/.test(f)) { copyFileSync(`${DIST}/${f}`, `${WORK}/${f}`); cssName = f; break }
const css = readFileSync(`${WORK}/${cssName}`, 'utf8')
const S = css.match(/\.q-pairs\[(data-v-[a-z0-9]+)\]/)[1]

const LONG = '来料检验发现该批硫酸氧钛含量低于标准要求，外观有结块现象，经复核确认属供应商运输储存不当导致，现申请特采'

// 按 docSheetConfigs.QC_TC_IN 的真实行结构铺满整张纸
const row = (h, inner) => `<div class="as-row q-pairs" ${S} style="min-height:${h}px">${inner}</div>`
const pair = (label, lw, flex, val, kind = '') =>
  `<div class="q-pair" ${S} style="flex:${flex}"><div class="q-label" ${S} style="width:${lw}px">${label}</div>` +
  `<div class="q-value${kind === 'ta' ? ' q-col' : ''}" ${S}>` +
  (kind === 'ta'
    ? `<div class="el-textarea as-fill-input as-fill-area" ${S}><textarea class="el-textarea__inner" id="ta" rows="4">${val}</textarea></div>`
    : val) + `</div></div>`

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S} id="sheet">
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px">
    <span class="q-vchar" ${S}>申</span><span class="q-vchar" ${S}>请</span><span class="q-vchar" ${S}>单</span><span class="q-vchar" ${S}>位</span>
  </div>
  <div class="q-vrows" ${S}>
    ${row(52, pair('供应商',130,292,'伊诺凯化学试剂有限公司') + pair('采购单号',130,292,'YJ-20260915-11') + pair('产品名称',130,292,'硫酸氧钛'))}
    ${row(63, pair('总数量',130,292,'1kg') + pair('不合格品数量',130,292,'1') + pair('不合格品比例',130,292,'100%'))}
    ${row(150, pair('不良说明',130,1,LONG,'ta'))}
    ${row(61, pair('严重程度',130,1,'□ 严重　□ 一般　□ 轻微'))}
    ${row(185, pair('特采理由',130,1,'（理由填写区）'))}
    ${row(34, '<div style="width:100%;padding:4px">一．相关部门处理意见</div>')}
    ${row(225, pair('产品开发部意见',130,1,'性能 / 工艺'))}
    ${row(124, pair('品质部意见',130,1,''))}
    ${row(122, pair('销售部意见',130,1,''))}
    ${row(92, pair('研发意见',130,1,''))}
    ${row(36, '<div style="width:100%;padding:4px">二．最终处理结果</div>')}
    ${row(71, pair('',0,1,'□ 正常使用　□ 管控使用　□ 挑选使用'))}
  </div>
</div></div></div>
</body></html>`
writeFileSync(`${WORK}/full.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: `file:///${WORK}/full.html` })
await sleep(1800)
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(500)

const m = await cdp.ev(`(() => {
  const s = document.getElementById('sheet');
  const r = s.getBoundingClientRect();
  const ta = document.getElementById('ta');
  const cs = getComputedStyle(s);
  return JSON.stringify({
    sheetW: Math.round(r.width), sheetH: Math.round(r.height), zoom: cs.zoom,
    taFits: ta.scrollHeight <= ta.clientHeight + 2,
    taScrollH: ta.scrollHeight, taClientH: ta.clientHeight,
    taText: ta.value.length
  });
})()`)
const j = JSON.parse(m)
const MM = 3.7795275591
const PW = 210 * MM - 16 * MM, PH = 297 * MM - 16 * MM
console.log('=== 打印媒体实测 ===')
console.log(JSON.stringify(j, null, 1))
console.log(`\nA4 可打印区: ${PW.toFixed(1)} x ${PH.toFixed(1)} px`)
console.log(`纸面:        ${j.sheetW} x ${j.sheetH} px (zoom ${j.zoom})`)
console.log(`宽度: ${j.sheetW <= PW + 1 ? '✅' : '❌'}`)
console.log(`高度: ${j.sheetH <= PH ? '✅ 一页' : `❌ 超 ${(j.sheetH - PH).toFixed(0)}px`}`)
console.log(`不良说明完整显示: ${j.taFits ? '✅' : '❌'} (需 ${j.taScrollH} / 给 ${j.taClientH})`)

const pdf = await cdp.send('Page.printToPDF', { printBackground: true })
const b64 = pdf.data || (pdf.result && pdf.result.data)
if (b64) {
  const buf = Buffer.from(b64, 'base64')
  const raw = buf.toString('latin1')
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length
  console.log(`\nprintToPDF: ${pages} 页 ${pages === 1 ? '✅' : '❌'}`)
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
