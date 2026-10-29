/**
 * _q-docno2.mjs —— 补查上一轮没抓到的那两格(RD_ASM_PROC / RD_PROD_DOCLIST)+ RD_INSP_PLAN 空值复现
 * 用法: node _q-docno2.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

async function getFirst(p) {
  const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 1, condition: {} }),
  })).json()
  const row = (r?.data?.list || [])[0] || {}
  return { no: String(row['单据编号'] || row['编号'] || ''), row: JSON.stringify(row).slice(0, 300) }
}

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin'); set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit')
  btn && btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9464 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)

  for (const p of ['RD_ASM_PROC', 'RD_PROD_DOCLIST', 'RD_INSP_PLAN']) {
    const f = await getFirst(p)
    log(p + '.firstNo', f.no)
    const q = f.no ? '?docNo=' + encodeURIComponent(f.no) : ''
    await s.navigate(`${BASE}/#/panelx/list/${p}${q}`); await sleep(8000)
    const r = await s.evaluate(`(() => {
      const t = (e) => e ? (e.textContent || '').replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim() : null
      const cells = [...document.querySelectorAll('.rs-docno')].map(t)
      const pres = [...document.querySelectorAll('.rs-docno-prefix')].map(t)
      const tabs = [...document.querySelectorAll('.el-tabs__item')].map(t)
      const pds = [...document.querySelectorAll('.pds-docno')].map(t)
      const titles = [...document.querySelectorAll('.rs-title, .pds-title, .rs-static-title')].map(t).slice(0, 3)
      return { nCells: cells.length, cells, pres, tabs, pds, titles,
               bodyHead: t(document.body).slice(0, 200) }
    })()`)
    log(p, r)
  }
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-docno2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
