import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = 'http://127.0.0.1:8090'
const s = await launch({ port: 9431 })
await s.navigate(BASE + '/#/login'); await sleep(3000)
await s.evaluate(`(()=>{const p=(ph)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));const set=(el,v)=>{el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};set(p('登录账号'),'admin');set(p('登录密码'),'123456');return true})()`)
await sleep(400); await s.evaluate(`document.querySelector('.login-submit').click(); true`); await sleep(5000)
await s.evaluate("location.hash='#/panelx/list/RD_APPROVAL?docNo=LXA-2026-10-0030'; true"); await sleep(5000)
const d = await s.evaluate(`(() => {
  const h=[...document.querySelectorAll('.ann-host')].find(x=>(x.textContent||'').trim().length>=4)
  const seg=h.querySelector('.ann-seg')||h; const tn=seg.firstChild
  const r=document.createRange(); r.setStart(tn,0); r.setEnd(tn,2)
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r)
  h.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,composed:true,view:window,clientX:300,clientY:300}))
  return new Promise(res=>setTimeout(()=>{
    sel.removeAllRanges()
    h.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window,clientX:320,clientY:320}))
    setTimeout(()=>{
      const pal=document.querySelector('.ann-palette')
      // 全页面找任何 fixed 浮层（色盘可能渲染在别处）
      const fixed=[...document.querySelectorAll('div')].filter(x=>{
        const st=getComputedStyle(x); return st.position==='fixed' && x.querySelectorAll('i').length>=6
      }).map(x=>({cls:x.className, i:x.querySelectorAll('i').length}))
      res({palette:!!pal, fixedCandidates:fixed, bodyTail:(document.body.innerText||'').slice(-120)})
    },600)
  },300))
})()`)
console.log(JSON.stringify(d,null,2))
await s.close?.(); process.exit(0)
