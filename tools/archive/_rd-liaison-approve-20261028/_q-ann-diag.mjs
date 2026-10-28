/**
 * _q-ann-diag.mjs —— 诊断:只读立项单页面上为什么没有 .ann-host
 * 用法: node _q-ann-diag.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOCNO = process.argv[3] || 'LXA-2026-10-0012'

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const lj = await lr.json()
const token = lj?.data?.token || ''
const userInfo = lj?.data?.user || {}

const s = await launch({ port: 9414 })
const inject = `(() => {
  localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(userInfo))});
  localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ factory: 'YJ' }))});
  return true
})()`
await s.navigate(BASE + '/')
await sleep(1000)
await s.evaluate(inject)
await s.navigate(`${BASE}/#/panelx/list/RD_APPROVAL?docNo=${encodeURIComponent(DOCNO)}`)
await sleep(1500)
await s.evaluate(inject)
await s.navigate(`${BASE}/#/panelx/list/RD_APPROVAL?docNo=${encodeURIComponent(DOCNO)}`)
await sleep(5000)

const d = await s.evaluate(`(() => {
  const r = {
    url: location.hash,
    annHost: document.querySelectorAll('.ann-host').length,
    annSeg: document.querySelectorAll('.ann-seg').length,
    approvalSheet: document.querySelectorAll('.approval-sheet').length,
    rsTable: document.querySelectorAll('.rs-table, table.rs-t').length,
    inputs: document.querySelectorAll('input, textarea').length,
    docSideBtns: [...document.querySelectorAll('.as-side-btn')].map(b => (b.textContent || '').trim()).slice(0, 30),
    hint: [...document.querySelectorAll('.as-side-hint')].map(b => (b.textContent || '').trim()).slice(0, 5),
    bodyTxt: (document.body.innerText || '').slice(0, 500),
  }
  return r
})()`)
console.log(JSON.stringify(d, null, 2))
await s.close?.()
process.exit(0)
