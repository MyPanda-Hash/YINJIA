import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = 'http://127.0.0.1:8090'
const s = await launch({ port: 9442 })
await s.navigate(BASE + '/#/login'); await sleep(3000)
await s.evaluate(`(()=>{const p=(ph)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));const set=(el,v)=>{el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};set(p('登录账号'),'admin');set(p('登录密码'),'123456');return true})()`)
await sleep(400); await s.evaluate(`document.querySelector('.login-submit').click(); true`); await sleep(5000)
await s.evaluate("location.hash='#/panelx/list/PU_ORDER'; true"); await sleep(5000)
const r = await s.evaluate(`(() => {
  // 抓所有可见的可点元素文字(限定在页面上半部工具栏区)
  const all = [...document.querySelectorAll('button, .el-button, [class*=btn], [class*=tool]')]
    .filter(e => e.offsetParent !== null)
    .map(e => ({ cls: String(e.className).slice(0,50), txt: (e.textContent||'').trim().slice(0,20) }))
    .filter(x => x.txt)
  return {
    total: all.length,
    sample: all.slice(0, 40),
    hasImport: all.filter(x => x.txt.includes('导入')),
    hasMore: all.filter(x => x.txt.includes('更多')),
  }
})()`)
console.log(JSON.stringify(r, null, 1))
await s.close?.(); process.exit(0)
