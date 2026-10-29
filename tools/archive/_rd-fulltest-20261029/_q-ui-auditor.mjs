/**
 * _q-ui-auditor.mjs —— 实机验证:产品信息表纸面「审核人（一级审核）/（二级审核）」显示默认值
 * 用法: node _q-ui-auditor.mjs [base]
 *
 * 验收点(纯界面,不查库):
 *   ① 新建一张产品信息表 ⇒ 纸面上两级审核人应直接显示 冯敏 / 陈秀丽;
 *   ② 该单据在「已归档」状态下重新打开,这两格仍要显示(不是一存就空)。
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

/** 读纸面上「审核人（一级审核）/（二级审核）」两行的值 */
const READ_AUDITORS = `(() => {
  const rows=[...document.querySelectorAll('table.rs-t tr, table tr')]
  const hit=(kw)=>{
    for(const tr of rows){
      const t=(tr.textContent||'')
      if(!t.includes(kw)) continue
      const tds=[...tr.children]
      const last=tds[tds.length-1]
      if(!last) continue
      const inp=last.querySelector('input,textarea')
      const v=(inp?inp.value:last.textContent||'').trim()
      if(v!==undefined) return v
    }
    return '(未找到该行)'
  }
  return { 一级: hit('审核人（一级审核）') || hit('一级审批人'), 二级: hit('审核人（二级审核）') || hit('二级审批人') }
})()`

const s = await launch({ port: 9494 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  // ① 新建
  await s.navigate(BASE + '/#/panelx/list/RD_PROD_INFO')
  for (let i = 0; i < 15; i++) {
    await sleep(1500)
    if (await s.evaluate(`document.querySelectorAll('button').length>0`)) break
  }
  log('点新增', await s.evaluate(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='新增')
    if(!b) return 'not-found'
    b.click(); return 'clicked'
  })()`))
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    const t = await s.evaluate(`document.body.textContent||''`)
    if (t.includes('五、文件与签署') || t.includes('审核人（一级审核）')) break
  }
  log('① 新建单纸面审核人', await s.evaluate(READ_AUDITORS))

  // 双击表格里的行打开已有单据(归档态)再读
  log('返回列表', await s.evaluate(`(() => { location.hash = '#/panelx/list/RD_PROD_INFO'; return 'ok' })()`))
  for (let i = 0; i < 15; i++) {
    await sleep(1500)
    if (await s.evaluate(`document.querySelectorAll('.el-table__body tr').length>0`)) break
  }
  log('打开首行', await s.evaluate(`(() => {
    const tr=document.querySelector('.el-table__body tr')
    if(!tr) return 'no-row'
    const td=tr.querySelector('td')
    if(td) td.click()
    return 'clicked'
  })()`))
  await sleep(3000)
  log('② 已有单纸面审核人', await s.evaluate(READ_AUDITORS))

  await fs.writeFile(new URL('./out-ui-auditor.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
} finally {
  process.exit(0)
}