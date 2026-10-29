/**
 * _q-shot.mjs —— 截图组装工艺清单「组装BOM表」页签(用 CDP Page.captureScreenshot)
 * 用法: node _q-shot.mjs [base] [docNo] [outName]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
import fs from 'node:fs/promises'

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const DOC = process.argv[3] || ''
const NAME = process.argv[4] || 'shot-bom.png'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const lj = await lr.json()
const token = lj?.data?.token || ''

let docNo = DOC
if (!docNo) {
  const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'RD_ASM_PROC', pageNo: 1, pageSize: 5, condition: {} }),
  })).json()
  docNo = String((list?.data?.list || [])[0]?.['单据编号'] || '')
}
console.log('单据 =', docNo)

const s = await launch({ port: 9454 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS))
  await sleep(4500)
  await s.navigate(`${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(docNo)}`); await sleep(6000)
  console.log('切页签', await s.evaluate(`(() => {
    const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').includes('组装BOM表'))
    if (!t) return false; t.click(); return true
  })()`))
  await sleep(1500)

  const shot = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const b64 = shot?.result?.data
  if (!b64) { console.log('截图失败', JSON.stringify(shot).slice(0, 300)) }
  else {
    await fs.writeFile(new URL('./' + NAME, import.meta.url), Buffer.from(b64, 'base64'))
    console.log('[written]', NAME)
  }
  await s.close?.()
} finally {
  process.exit(0)
}
