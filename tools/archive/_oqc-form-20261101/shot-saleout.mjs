/**
 * shot-saleout.mjs —— 截图「销售出库单」面板,确认「勾选」的交互形态(2026-11-01)
 * 用法: node shot-saleout.mjs [base] [outName]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const NAME = process.argv[3] || 'shot-saleout.png'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9461 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS))
  await sleep(5000)
  await s.navigate(BASE + '/#/panelx/list/SALE_OUT'); await sleep(7000)
  const info = await s.evaluate(`(() => {
    const txt = (el) => (el?.textContent || '').trim()
    const groups = [...document.querySelectorAll('.tb-group .tb-main')].map(txt)
    const firstRow = document.querySelector('.el-table__body tr')
    const headers = [...document.querySelectorAll('.el-table__header th')].map(x => txt(x)).slice(0, 40)
    const selCols = [...document.querySelectorAll('.el-table__header th')].filter(x => x.querySelector('.el-checkbox')).length
    return { groups, headers, selCols, hasDocPicker: !!document.querySelector('.doc-chip'), docChip: txt(document.querySelector('.doc-chip')) }
  })()`)
  console.log(JSON.stringify(info, null, 2))
  const shot = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const b64 = shot?.result?.data
  if (!b64) console.log('截图失败', JSON.stringify(shot).slice(0, 300))
  else { await fs.writeFile(new URL('./' + NAME, import.meta.url), Buffer.from(b64, 'base64')); console.log('[written]', NAME) }
  await s.close?.()
} finally { process.exit(0) }
