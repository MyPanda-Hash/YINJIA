/** v4 验证:划选(mouseup)即弹色盘,无需第二次点击 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`) }

const s = await launch({ port: 9432 })
await s.navigate(BASE + '/#/login'); await sleep(3000)
await s.evaluate(`(()=>{const p=(ph)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));const set=(el,v)=>{el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};set(p('登录账号'),'admin');set(p('登录密码'),'123456');return true})()`)
await sleep(400); await s.evaluate(`document.querySelector('.login-submit').click(); true`); await sleep(5000)
log('登录', await s.evaluate(`location.hash`))
await s.evaluate("location.hash='#/panelx/list/RD_APPROVAL?docNo=LXA-2026-10-0030'; true"); await sleep(5000)

// ① 单纯点击（无划选）不应弹盘
const r1 = await s.evaluate(`(() => {
  const h=[...document.querySelectorAll('.ann-host')].find(x=>(x.textContent||'').trim().length>=4)
  const seg=h.querySelector('.ann-seg')||h
  window.getSelection().removeAllRanges()
  h.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,composed:true,view:window,clientX:300,clientY:300}))
  return new Promise(res=>setTimeout(()=>res({palette:!!document.querySelector('.ann-palette')}),300))
})()`)
log('① 单纯点击(无选区)', r1)
log('① 断言 = 不弹盘', r1.palette === false ? 'PASS' : 'FAIL')

// ② 划选 + mouseup → 立刻弹盘（不等第二次点击）
const r2 = await s.evaluate(`(() => {
  const h=[...document.querySelectorAll('.ann-host')].find(x=>(x.textContent||'').trim().length>=4)
  const seg=h.querySelector('.ann-seg')||h; const tn=seg.firstChild
  const r=document.createRange(); r.setStart(tn,0); r.setEnd(tn,2)
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r)
  h.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,composed:true,view:window,clientX:320,clientY:320}))
  return new Promise(res=>setTimeout(()=>{
    const pal=document.querySelector('.ann-palette')
    res({palette:!!pal, swatches: pal?pal.querySelectorAll('i').length:0,
         selectionCleared: window.getSelection().isCollapsed})
  },400))
})()`)
log('② 划选 + mouseup', r2)
log('② 断言 = 立刻弹盘', r2.palette ? 'PASS' : 'FAIL')
log('② 断言 = 8 个色块', r2.swatches === 8 ? 'PASS' : `FAIL(${r2.swatches})`)
log('② 断言 = 弹盘后选区已清', r2.selectionCleared ? 'PASS' : 'FAIL')

// ③ 点一个颜色 → 落库
const r3 = await s.evaluate(`(() => {
  const pal=document.querySelector('.ann-palette')
  if(!pal) return Promise.resolve({err:'no palette'})
  const sw=pal.querySelectorAll('i')[0]
  sw.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}))
  return new Promise(res=>setTimeout(()=>{
    const colored=[...document.querySelectorAll('.ann-seg[data-ann="1"]')].length
    res({paletteClosed:!document.querySelector('.ann-palette'), coloredSegs:colored})
  },1500))
})()`)
log('③ 点色落库', r3)
log('③ 断言 = 色盘关闭', r3.paletteClosed ? 'PASS' : 'FAIL')
log('③ 断言 = 出现着色段', r3.coloredSegs > 0 ? 'PASS' : 'FAIL')

const fs = await import('node:fs/promises')
await fs.writeFile(new URL('./out-ann-v4.json', import.meta.url), JSON.stringify(out,null,2),'utf8')
await s.close?.(); process.exit(0)
