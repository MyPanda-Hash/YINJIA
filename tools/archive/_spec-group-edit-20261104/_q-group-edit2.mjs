/**
 * _q-group-edit2.mjs —— 定点打开指定单据,验证「检验项目/检验子项」两列能否编辑
 *
 * 上一版靠点列表行,打不开目标单(面板默认停在列表第一张)。
 * 这里改用面板自带「查询单据」输入框定位,失败则退回点行。
 *
 * 用法:node _q-group-edit2.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || 'ZZ-PROBE-SPEC'

async function main() {
  const s = await launch({ port: 9535 })
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

  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(11000)

  // 用侧栏「查询单据」框定位
  const q = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const ins=[...document.querySelectorAll('input')].filter(vis)
    const box=ins.find(i=>{
      const ph=i.placeholder||''
      return /模糊搜索|查看单据|单据编号/.test(ph)
    }) || ins[ins.length-1]
    if(!box) return {ok:false, n:ins.length, phs:ins.map(i=>i.placeholder||'')}
    const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
    d.call(box, ${JSON.stringify(DOC)})
    box.dispatchEvent(new Event('input',{bubbles:true}))
    box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}))
    return {ok:true, ph:box.placeholder||''}
  })()`)
  console.log('查询框 = ' + JSON.stringify(q))
  await sleep(6000)

  const head = await s.evaluate(`(() => {
    const b=(document.body.innerText||'').replace(/\\s+/g,' ')
    const m=b.match(/单据编号：\\s*(\\S+)/)
    return {docno:m?m[1]:null}
  })()`)
  console.log('当前单据 = ' + JSON.stringify(head))

  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const tds=[...document.querySelectorAll('.rs-t td')].filter(vis)
    return {
      docno: (document.body.innerText||'').match(/单据编号：\\s*(\\S+)/)?.[1] || null,
      textareaCount: tas.length,
      firstValues: tas.slice(0,6).map(t=>t.value),
      cellTexts: tds.slice(0,10).map(td=>(td.textContent||'').trim().slice(0,14)),
    }
  })()`)
  console.log('页2 = ' + JSON.stringify(d, null, 1))

  // 试打字第一个 textarea(组名)
  const typed = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    if(!tas.length) return {ok:false}
    const t=tas[0]
    const before=t.value
    const dd=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    dd.call(t,'PROBE_文字')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, before, afterInput:t.value}
  })()`)
  console.log('打字 = ' + JSON.stringify(typed))
  await sleep(1500)
  const after = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    return ([...document.querySelectorAll('.rs-t textarea')].filter(vis)).slice(0,4).map(t=>t.value)
  })()`)
  console.log('1.5s 后 = ' + JSON.stringify(after))
  console.log('')
  console.log(after[0] === 'PROBE_文字' ? '=> 打字保住了' : '=> 打字被回弹(确认坏)')

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })