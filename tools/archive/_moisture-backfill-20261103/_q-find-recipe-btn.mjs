/**
 * _q-find-recipe-btn.mjs —— 找配方计算器的入口(按钮/菜单项)与弹窗结果区
 * 用法:node _q-find-recipe-btn.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function main() {
  const s = await launch({ port: 9467 })
  await s.navigate(BASE + '/#/login'); await sleep(4000)
  await s.evaluate(`(() => {
    const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];
    const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];
    const p=ins.find(i=>i.type==='password'); setV(a,'admin');setV(p,'123456');return true })()`)
  await sleep(700)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(6000)

  await s.navigate(`${BASE}/#/panelx/list/RD_MOLD_PROC`); await sleep(10000)

  // 列出所有可点元素(含 title/aria-label/带图标的),找配方相关入口
  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const all=[...document.querySelectorAll('button,[role=button],.el-button,span[title],i[title],[class*=btn]')].filter(vis)
    const hits=[]
    for(const el of all){
      const t=(el.textContent||'').trim()
      const ti=el.getAttribute('title')||''
      const al=el.getAttribute('aria-label')||''
      const cl=el.className&&el.className.toString?el.className.toString():''
      const tag=t+'|'+ti+'|'+al+'|'+cl
      if(/配方|计算|🧮|recipe|Recipe|calc|Calc/.test(tag)) hits.push({t:t.slice(0,30), ti, al, cl:cl.slice(0,60), tag:el.tagName})
    }
    return {
      hits,
      allButtons: [...document.querySelectorAll('button')].filter(vis).map(b=>({t:(b.textContent||'').trim().slice(0,20), ti:b.getAttribute('title')||'', cl:(b.className||'').toString().slice(0,50)})).slice(0,40)
    }
  })()`)
  console.log(JSON.stringify(d, null, 1))
  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
