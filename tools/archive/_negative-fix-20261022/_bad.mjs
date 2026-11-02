/**
 * 实测「不良说明」行:单行输入在行高 63px 的格子里是什么表现
 * 分别测:空值 / 短文本 / 长文本(需要滚动的长度)
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
console.log('作用域:', S)

// 用真实的结构:as-row q-pairs > q-pair > q-label + q-value > el-input(渲染成原生 input 简化)
const mk = (val) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./${cssName}"></head>
<body class="approval-printing"><div class="approval-sheet" ${S} style="background:#fff">
<div class="as-table" ${S}><div class="q-vrun" ${S}>
  <div class="q-vlabel" ${S} style="width:65px"><span class="q-vchar" ${S}>单</span></div>
  <div class="q-vrows" ${S}>
    <div class="as-row q-pairs" ${S} id="row" style="min-height:63px">
      <div class="q-pair" ${S} style="flex:1">
        <div class="q-label" ${S} style="width:130px">不良说明</div>
        <div class="q-value" ${S} id="val">
          <div class="el-input el-input--small as-cell-input" ${S}>
            <div class="el-input__wrapper"><input class="el-input__inner" value="${val}" /></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div></div></div>
<style>
  /* 模拟 Element Plus 基础样式(真实环境由 element-plus.css 提供) */
  .el-input__wrapper{display:flex;align-items:center;box-shadow:0 0 0 1px #dcdfe6 inset;border-radius:4px;background:#fff;padding:1px 11px;width:100%}
  .el-input__inner{width:100%;border:none;outline:none;font-size:14px;line-height:1;height:32px;background:transparent}
  .as-cell-input{width:100%}
</style>
</body></html>`

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')

const LONG = '来料检验发现该批硫酸氧钛含量低于标准要求,外观有结块现象,经复核确认属供应商运输储存不当导致,现申请特采'
const cases = [
  ['空值', ''],
  ['短文本', '含量偏低'],
  ['长文本', LONG],
]

for (const [label, val] of cases) {
  writeFileSync(`${WORK}/t.html`, mk(val), 'utf8')
  await cdp.send('Page.navigate', { url: `file:///${WORK}/t.html` })
  await sleep(1200)
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
  await sleep(300)
  const r = await cdp.ev(`(() => {
    const row = document.getElementById('row');
    const val = document.getElementById('val');
    const inp = row.querySelector('.el-input__inner');
    const rr = row.getBoundingClientRect(), vr = val.getBoundingClientRect(), ir = inp.getBoundingClientRect();
    return JSON.stringify({
      rowH: Math.round(rr.height), rowW: Math.round(rr.width),
      valH: Math.round(vr.height), inputH: Math.round(ir.height),
      inputW: Math.round(ir.width), scrollW: inp.scrollWidth, clientW: inp.clientWidth,
      textLen: inp.value.length,
      overflow: inp.scrollWidth > inp.clientWidth + 1
    });
  })()`)
  console.log(`\n【${label}】`, r)
}

await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
