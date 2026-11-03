import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = process.argv[2] || 'http://36.140.66.163:8090'
async function main() {
  const s = await launch({ port: 9455 })
  await s.navigate(BASE + '/#/login'); await sleep(4000)
  await s.evaluate(`(() => { const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];const p=ins.find(i=>i.type==='password');setV(a,'admin');setV(p,'123456');return true })()`)
  await sleep(600)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(6000)
  await s.navigate(BASE + '/#/panelx/list/RD_DOM_TEST'); await sleep(9000)
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').includes('销售端')); t&&t.click(); return true })()`)
  await sleep(2000)
  const m = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const cell=[...document.querySelectorAll('td.rs-docno')].filter(vis)[0]
    if(!cell) return {err:'no cell'}
    const inner=cell.querySelector('.rs-docno-in')||cell
    const cs=getComputedStyle(inner)
    const b=inner.getBoundingClientRect()
    const tw=document.createTreeWalker(inner,NodeFilter.SHOW_TEXT)
    let node=null
    while(tw.nextNode()){ if((tw.currentNode.textContent||'').trim()){ node=tw.currentNode; break } }
    let textRects=0, tops=[]
    if(node){ const rg=document.createRange(); rg.selectNodeContents(node); const rs=[...rg.getClientRects()].filter(r=>r.width>0&&r.height>0); textRects=rs.length; tops=[...new Set(rs.map(r=>Math.round(r.top)))] }
    return {
      html: inner.innerHTML.slice(0,120),
      innerW: Math.round(b.width), innerH: Math.round(b.height),
      scrollW: inner.scrollWidth, clientW: inner.clientWidth,
      lineHeight: cs.lineHeight, fontSize: cs.fontSize, whiteSpace: cs.whiteSpace,
      text: node ? node.textContent.trim() : '',
      textRects, textLineTops: tops,
    }
  })()`)
  console.log(JSON.stringify(m,null,1))
  await s.close?.()
}
main().catch(e=>{console.error('FATAL',e.message);process.exit(1)})