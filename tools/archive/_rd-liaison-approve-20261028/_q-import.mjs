/** 核实:导入按钮在界面上还在不在(后端 buttonGroups 的「更多」组 vs 明细图标条的「更多▼」) */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`) }

const s = await launch({ port: 9441 })
await s.navigate(BASE + '/#/login'); await sleep(3000)
await s.evaluate(`(()=>{const p=(ph)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));const set=(el,v)=>{el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};set(p('登录账号'),'admin');set(p('登录密码'),'123456');return true})()`)
await sleep(400); await s.evaluate(`document.querySelector('.login-submit').click(); true`); await sleep(5000)

for (const panel of ['PU_ORDER', 'PURCHASE_IN', 'WLBOM']) {
  await s.evaluate(`location.hash='#/panelx/list/${panel}'; true`); await sleep(4500)
  const r = await s.evaluate(`(() => {
    const sideBtns = [...document.querySelectorAll('.as-side-btn')].map(b=>(b.textContent||'').trim())
    const topBtns = [...document.querySelectorAll('.tools button, .tools .el-button, .toolbar-query-btn')].map(b=>(b.textContent||'').trim()).filter(Boolean)
    const dtIc = [...document.querySelectorAll('.dt-ic')].map(x=>(x.textContent||'').trim())
    const all = [...sideBtns, ...topBtns, ...dtIc]
    return {
      hasImportAnywhere: all.some(t=>t==='导入'||t.includes('导入')),
      imports: all.filter(t=>t.includes('导入')),
      hasMore: all.filter(t=>t.includes('更多')),
    }
  })()`)
  log(panel, r)
}

const fs = await import('node:fs/promises')
await fs.writeFile(new URL('./out-import.json', import.meta.url), JSON.stringify(out,null,2),'utf8')
await s.close?.(); process.exit(0)
