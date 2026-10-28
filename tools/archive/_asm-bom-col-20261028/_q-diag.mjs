/**
 * _q-diag.mjs —— 诊断 RD_ASM_PROC 单据页为什么没渲染(单轮:登录→打开→打印正文/关键选择器)
 * 用法: node _q-diag.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || ''

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const lj = await lr.json()
const token = lj?.data?.token || ''
const user = lj?.data?.user || {}
console.log('token?', !!token)

const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode: 'RD_ASM_PROC', pageNo: 1, pageSize: 5, condition: {} }),
})).json()
const rows = list?.data?.list || []
console.log('rows =', rows.map((r) => r['单据编号']).join(','))
const docNo = DOC || String(rows[0]?.['单据编号'] || '')

const s = await launch({ port: 9452 })
const inject = `(() => {
  localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ factory: 'YJ' }))});
  return true
})()`
await s.navigate(BASE + '/'); await sleep(800)
await s.evaluate(inject)
// 先看列表页本身能不能渲染
await s.navigate(BASE + '/#/panelx/list/RD_ASM_PROC'); await sleep(1500)
await s.evaluate(inject)
await s.navigate(BASE + '/#/panelx/list/RD_ASM_PROC'); await sleep(5000)

const d1 = await s.evaluate(`(() => ({
  href: location.href,
  bodyLen: document.body ? document.body.innerText.length : -1,
  head: document.body ? document.body.innerText.slice(0, 300) : '',
  hasList: !!document.querySelector('.panelx-list, .as-list, .el-table'),
  token: (localStorage.getItem('mes_token') || '').slice(0, 6),
  btns: [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(Boolean).slice(0, 25),
}))()`)
console.log('列表页诊断 =', JSON.stringify(d1, null, 2))

// 再看单据页
const docUrl = `${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(docNo)}`
await s.navigate(docUrl); await sleep(5500)
const d2 = await s.evaluate(`(() => ({
  href: location.href,
  bodyLen: document.body ? document.body.innerText.length : -1,
  head: document.body ? document.body.innerText.slice(0, 400) : '',
  tabs: [...document.querySelectorAll('.rsp-page-tab')].map(x => (x.textContent||'').trim()),
  hasRsT: document.querySelectorAll('.rs-t').length,
  hasRecSheet: !!document.querySelector('.rsp-page, .rsp-dt-wrap'),
  msg: [...document.querySelectorAll('.el-message, .el-message__content')].map(x => (x.textContent||'').trim()),
}))()`)
console.log('单据页诊断 =', JSON.stringify(d2, null, 2))

await s.close?.()
process.exit(0)
