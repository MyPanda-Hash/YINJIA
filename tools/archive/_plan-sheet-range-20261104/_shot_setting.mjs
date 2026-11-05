import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const LOGIN = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  btn && btn.click(); return 'ok'
})()`
const s = await launch({ port: 9491 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 950, deviceScaleFactor: 1.4, mobile: false })
  await s.navigate(BASE + '/#/login', 2000); await sleep(2500)
  await s.evaluate(LOGIN); await sleep(4500)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 3000); await sleep(9000)
  await s.evaluate(`(() => { const hit=[...document.querySelectorAll('.wb-line')].find(x=>((x.querySelector('.wb-line-name')||{}).innerText||'').trim()==='2号车间'); if(hit)(hit.querySelector('.wb-line-name')||hit).click(); return 'ok' })()`); await sleep(6500)
  await s.evaluate(`(() => { const box=document.querySelector('.wb-block .el-table__body tbody tr td:first-child .el-checkbox'); if(box)(box.querySelector('input')||box).click(); return 'ok' })()`); await sleep(600)
  await s.evaluate(`(() => { const b=document.querySelector('.wb-print-set'); if(b)b.click(); return 'ok' })()`); await sleep(1200)
  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await fs.writeFile('shot-print-setting.png', Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-print-setting.png')
} finally { try { s.close?.() } catch {} }
