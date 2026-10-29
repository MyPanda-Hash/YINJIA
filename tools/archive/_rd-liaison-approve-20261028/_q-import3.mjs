import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = 'http://127.0.0.1:8090'
const s = await launch({ port: 9443 })
await s.navigate(BASE + '/#/login'); await sleep(3000)
await s.evaluate(`(()=>{const p=(ph)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));const set=(el,v)=>{el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};set(p('登录账号'),'admin');set(p('登录密码'),'123456');return true})()`)
await sleep(400); await s.evaluate(`document.querySelector('.login-submit').click(); true`); await sleep(5000)
await s.evaluate("location.hash='#/panelx/list/PU_ORDER'; true"); await sleep(6000)
const r = await s.evaluate(`(() => {
  // 整个页面正文前 1200 字,看工具栏到底有哪些按钮文字
  const txt = (document.body.innerText||'')
  const lines = txt.split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean)
  return {
    first60: lines.slice(0, 60),
    hasImportWord: txt.includes('导入'),
  }
})()`)
console.log(JSON.stringify(r, null, 1))
await s.close?.(); process.exit(0)
