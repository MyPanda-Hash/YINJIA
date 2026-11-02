/**
 * _q-dom-check.mjs —— 页面加载诊断(为什么 .rsp-page-tab 一个都没有)
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const PANEL = process.argv[3] || 'RD_DOM_TEST'

async function main() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  const token = j?.data?.token || ''
  const user = j?.data?.user || {}
  console.log('tokenLen=' + token.length)

  const s = await launch({ port: 9453 })
  const inject = `(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0,10));
    localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ factory: 'YJ' }))});
    return true
  })()`
  const url = `${BASE}/#/panelx/list/${PANEL}`
  await s.navigate(BASE + '/'); await sleep(1200)
  await s.evaluate(inject)
  await s.navigate(url); await sleep(1500)
  await s.evaluate(inject)
  await s.navigate(url); await sleep(9000)

  const d = await s.evaluate(`(() => {
    const q = (sel) => document.querySelectorAll(sel).length
    return {
      hash: location.hash,
      title: document.title,
      hasPanelxList: q('.panelx-list'),
      rspTabs: q('.rsp-page-tab'),
      rsPages: q('.rs-page'),
      rows: q('.el-table__row'),
      rsTd: q('.rs-td'),
      docno: q('td.rs-docno'),
      alert: (document.querySelector('.el-message, .el-alert') || {}).textContent || '',
      bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 260),
    }
  })()`)
  console.log(JSON.stringify(d, null, 1))
  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
