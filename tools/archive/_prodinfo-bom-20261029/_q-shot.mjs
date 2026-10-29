/**
 * _q-shot.mjs —— 指定单据面板 + 页签截图(表单登录,后期用于版式比对)
 * 用法: node _q-shot.mjs <base> <panelCode> <docNo> <out.png> [tabName]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
import fs from 'node:fs/promises'

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = process.argv[3] || 'RD_PROD_INFO'
const DOC = process.argv[4] || ''
const NAME = process.argv[5] || 'shot.png'
const TAB = process.argv[6] || ''

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  btn && btn.click(); return 'clicked'
})()`

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''

let docNo = DOC
if (!docNo) {
  const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: PANEL, pageNo: 1, pageSize: 5, condition: {} }),
  })).json()
  docNo = String((list?.data?.list || [])[0]?.['单据编号'] || '')
}
console.log('面板/单据 =', PANEL, docNo || '(无)')

const s = await launch({ port: 9461 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)
  await s.navigate(`${BASE}/#/panelx/list/${PANEL}${docNo ? '?docNo=' + encodeURIComponent(docNo) : ''}`)
  await sleep(6500)
  if (TAB) {
    console.log('切页签', await s.evaluate(`(() => {
      const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').trim() === ${JSON.stringify(TAB)})
      if (!t) return false; t.click(); return true
    })()`))
    await sleep(1500)
  }
  const info = await s.evaluate(`(() => ({
    hash: location.hash,
    bars: [...document.querySelectorAll('.rs-sectionbar')].map(x => (x.textContent||'').trim().slice(0, 30)),
    coverLabels: [...document.querySelectorAll('.rsp-cover-lb')].map(x => (x.textContent||'').trim()),
    ths: [...document.querySelectorAll('.rs-t th')].map(x => (x.textContent||'').trim()).filter(Boolean),
    widths: [...new Set([...document.querySelectorAll('.rs-t')].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().width)))],
  }))()`)
  console.log(JSON.stringify(info, null, 2))
  const shot = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const b64 = shot?.result?.data
  if (b64) { await fs.writeFile(new URL('./' + NAME, import.meta.url), Buffer.from(b64, 'base64')); console.log('[written]', NAME) }
  else console.log('截图失败')
  await s.close?.()
} finally { process.exit(0) }