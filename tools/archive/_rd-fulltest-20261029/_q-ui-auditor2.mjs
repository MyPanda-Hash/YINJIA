/**
 * _q-ui-auditor2.mjs —— 实机验证 v2:直连一张**新建**单据,转储纸面含「审核」的行
 * 用法: node _q-ui-auditor2.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log('\n' + k + ' ='); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

// 把纸面里所有含「审核」的 tr 都转储出来(标签 + 值),不猜选择器
const DUMP = `(() => {
  const res=[]
  for(const tr of document.querySelectorAll('tr')){
    const t=(tr.textContent||'')
    if(!t.includes('审核')) continue
    const tds=[...tr.children]
    if(tds.length<2) continue
    const label=(tds[0].textContent||'').replace(/\\s+/g,' ').trim()
    const cell=tds[tds.length-1]
    const inp=cell.querySelector('input,textarea')
    const val=(inp?inp.value:cell.textContent||'').replace(/\\s+/g,' ').trim()
    res.push(label.slice(0,24)+' => '+val.slice(0,40))
  }
  return res
})()`

// 页面上「新增」按钮(可能是 el-button / 工具栏)
const CLICK_NEW = `(() => {
  const cands=[...document.querySelectorAll('button,.el-button,[class*=btn]')]
  const b=cands.find(x=>{const t=(x.textContent||'').trim(); return t==='新增'||t==='＋新增'||t==='+ 新增'})
  if(!b) return 'not-found:'+cands.map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,10).join('|')
  b.click(); return 'clicked:'+(b.textContent||'').trim()
})()`

const s = await launch({ port: 9495 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1400, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(BASE + '/#/panelx/list/RD_PROD_INFO')
  await sleep(6000)
  log('页面里有「审核」吗(打开列表时)', await s.evaluate(DUMP))

  log('点新增', await s.evaluate(CLICK_NEW))
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    const t = await s.evaluate(`(document.body.textContent||'').includes('文件与签署')`)
    if (t) break
  }
  await sleep(2500)
  log('新建单纸面含「审核」的行', await s.evaluate(DUMP))

  await fs.writeFile(new URL('./out-ui-auditor2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
} finally {
  process.exit(0)
}