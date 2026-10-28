/** 验证:表格工具条上不再有"点了只弹提示"的按钮 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`) }

const s = await launch({ port: 9440 })
await s.navigate(BASE + '/#/login'); await sleep(3000)
await s.evaluate(`(()=>{const p=(ph)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(ph));const set=(el,v)=>{el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};set(p('登录账号'),'admin');set(p('登录密码'),'123456');return true})()`)
await sleep(400); await s.evaluate(`document.querySelector('.login-submit').click(); true`); await sleep(5000)
log('登录', await s.evaluate(`location.hash`))

// 打开一个单据面板(采购入库单,有明细工具条)
await s.evaluate("location.hash='#/panelx/list/PURCHASE_IN'; true"); await sleep(5000)
const r = await s.evaluate(`(() => {
  const ics = [...document.querySelectorAll('.dt-ic')].map(x => (x.textContent || '').trim())
  const banned = ['更多', '更多▼', 'Ctrl+V列粘贴', '☑ Ctrl+V列粘贴', '从剪贴板粘贴', '批量修改', '销售订单查询', '存货中心']
  return {
    icons: ics,
    bannedPresent: ics.filter(t => banned.some(b => t.includes(b.replace('▼','').replace('☑ ','').trim()))),
  }
})()`)
log('工具条图标', r.icons)
log('残留的未实现项', r.bannedPresent)
log('断言 = 无未实现按钮', r.bannedPresent.length === 0 ? 'PASS' : 'FAIL')

const fs = await import('node:fs/promises')
await fs.writeFile(new URL('./out-toolbar.json', import.meta.url), JSON.stringify(out,null,2),'utf8')
await s.close?.(); process.exit(0)
