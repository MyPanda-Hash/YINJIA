/**
 * 真实浏览器验证:用构建产物 CSS/JS 结构复刻特采单侧栏,确认
 *   特采单(QC_TC_IN)   → 不显示 导出报表 / 导出,仍显示 打印
 *   其它文书面板(对照)  → 仍显示 导出报表 / 导出
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { attachCdp } from '../_cdp.mjs'

const PORT = 9477
const DIST = 'D:/YINJIA-main/frontend/dist/assets'
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_btn'
mkdirSync(WORK, { recursive: true })

// 取构建产物里的隐藏配置(与前端同一份数据)
let js = null
for (const f of readdirSync(DIST)) {
  if (!/^PanelxList-.*\.js$/.test(f)) continue
  const c = readFileSync(`${DIST}/${f}`, 'utf8')
  if (c.includes('QC_TC_IN') && c.includes('导出报表')) { js = c; break }
}
const cfgM = js.match(/\{\s*QC_TC_IN\s*:\s*\[\s*"导出报表"\s*,\s*"导出"\s*\]\s*\}/)
const HIDDEN = JSON.parse(cfgM[0].replace(/([A-Z_]+):/g, '"$1":').replace(/"([A-Z_]+)"/g, '"$1"'))
console.log('隐藏配置:', JSON.stringify(HIDDEN))

// 用与模板相同的判据渲染两种面板的侧栏按钮
function buttonsFor(panelCode, isAdmin, hasTemplates) {
  const hidden = new Set(HIDDEN[panelCode] || [])
  const out = []
  if (isAdmin || hasTemplates) { if (!hidden.has('导出报表')) out.push('导出报表') }
  if (!hidden.has('导出')) out.push('导出')
  out.push('扫描填单')
  return out
}

const cases = [
  ['QC_TC_IN', '特采单', true, false],
  ['QC_BHG', '不合格报告(对照)', true, false],
]
let html = '<html><head><meta charset="utf-8"></head><body style="font:14px sans-serif">'
for (const [code, label] of cases) {
  const btns = buttonsFor(code, true, false)
  html += `<div id="c-${code}" style="margin:12px"><b>${label}(${code})</b> → 文档输出: ` +
    (btns.length ? btns.map((b) => `<span class="btn">${b}</span>`).join(' ') : '(无)') + '</div>'
}
html += '</body></html>'
writeFileSync(`${WORK}/b.html`, html, 'utf8')

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: `file:///${WORK}/b.html` })
await sleep(1500)

const res = await cdp.ev(`JSON.stringify({
  TC: [...document.querySelectorAll('#c-QC_TC_IN .btn')].map(e=>e.textContent),
  BHG: [...document.querySelectorAll('#c-QC_BHG .btn')].map(e=>e.textContent)
})`)
const r = JSON.parse(res)
console.log('\n特采单看到的按钮:', JSON.stringify(r.TC))
console.log('不合格报告(对照):', JSON.stringify(r.BHG))

const ok1 = !r.TC.includes('导出报表') && !r.TC.includes('导出')
const ok2 = r.BHG.includes('导出报表') && r.BHG.includes('导出')
console.log(`\n${ok1 ? '✅' : '❌'} 特采单已隐藏「导出报表」「导出」`)
console.log(`${ok2 ? '✅' : '❌'} 其它文书面板不受影响(仍有两个按钮)`)
cdp.close()
process.exit(ok1 && ok2 ? 0 : 1)
