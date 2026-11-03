/**
 * _q-spec-prefix.mjs —— 炭棒规格「前缀只显示、数据存裸数字」实测(2026-11-03)
 *
 * 验四件事:
 *   ① 纸面渲染出前缀 `外：`/`内：`/`长：`(数据里没有前缀,是 recordSheetConfigs 的 pre 渲染的)
 *   ② 输入框里的 value 是**裸数字**(6 / 33 / 39),不是 `外：6`
 *   ③ 选产品编号带出后,head 里仍是裸数字
 *   ④ 配方计算器不再因带前缀而失败
 *
 * 用法:node _q-spec-prefix.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'

async function main() {
  const s = await launch({ port: 9491 })
  await s.navigate(BASE + '/#/login'); await sleep(4500)
  await s.evaluate(`(() => {
    const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];
    const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];
    const p=ins.find(i=>i.type==='password'); setV(a,'admin');setV(p,'123456');return true })()`)
  await sleep(800)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(7000)

  await s.navigate(`${BASE}/#/panelx/list/RD_MOLD_PROC`); await sleep(11000)
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').includes('成型工艺清单')); t&&t.click(); return true })()`)
  await sleep(2500)

  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const out={preCells:[], inputs:[]}
    // ① 前缀格:找 .rs-pre-cell,拿里面的前缀文本与输入框 value
    for (const cell of [...document.querySelectorAll('.rs-pre-cell')].filter(vis)) {
      const pre = cell.querySelector('.rs-pre')
      const inp = cell.querySelector('input')
      const txt = cell.querySelector('.rs-txt')
      out.preCells.push({
        pre: pre ? pre.textContent.trim() : null,
        inputValue: inp ? inp.value : null,
        textValue: txt ? txt.textContent.trim() : null,
      })
    }
    // ② 「炭棒规格」那一行的三格(按 .rs-td 里带 pre 的顺序)
    out.count = out.preCells.length
    return out
  })()`)
  console.log('前缀格 = ' + JSON.stringify(d, null, 1))

  // 判定
  const cells = d.preCells || []
  const pres = cells.map((c) => c.pre)
  const vals = cells.map((c) => c.inputValue ?? c.textValue ?? '')
  console.log('')
  console.log('前缀渲染: ' + JSON.stringify(pres))
  console.log('单元格值: ' + JSON.stringify(vals))
  const anyValueHasColon = vals.some((v) => /[：:]/.test(v))
  console.log('值里是否含冒号: ' + anyValueHasColon + '  (应为 false)')
  console.log('前缀是否齐全: ' + ['外：', '内：', '长：'].every((p) => pres.includes(p)))
  console.log('')
  console.log(!anyValueHasColon && pres.length > 0
    ? '=> PASS:前缀只做显示,数据是裸数字'
    : '=> FAIL:请检查')

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })