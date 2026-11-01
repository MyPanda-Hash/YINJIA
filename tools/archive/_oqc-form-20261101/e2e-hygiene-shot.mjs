/**
 * e2e-hygiene-shot.mjs —— 卫生安全结果「可填写」界面截图(填 15 项 → 滚到卫生安全表截图 → 清空还原)
 * 用法: node e2e-hygiene-shot.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || 'OQC-2026-11-0003'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const VALUES = ['0.12', '无', '无', '1.79', '20', '0.46', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND']

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
const user = login?.data?.user

const s = await launch({ port: 9485 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN'); return 1
  })()`)
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + DOC)}; location.reload(); return 1 })()`)
  await sleep(9000)
  const filled = await s.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.oqc-hygiene-input input')]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const vals = ${JSON.stringify(VALUES)}
    inputs.forEach((inp, i) => { setter.call(inp, vals[i]); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) })
    return inputs.length
  })()`)
  console.log('[filled inputs]', filled)
  await sleep(400)
  // 滚到卫生安全表
  const scrolled = await s.evaluate(`(() => {
    const t = document.querySelector('.oqc-hygiene')
    const sc = document.querySelector('.approval-layout .sheet-scroll') || document.querySelector('.approval-layout')
    if (!t) return 'no-table'
    if (sc) sc.scrollTop = t.offsetTop - 60
    t.scrollIntoView({ block: 'center' })
    return 'scrolled'
  })()`)
  console.log('[scroll]', scrolled)
  await sleep(1200)
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r?.result?.data) { await fs.writeFile(HERE + 'e2e-hygiene-screen-filled.png', Buffer.from(r.result.data, 'base64')); console.log('[shot] e2e-hygiene-screen-filled.png') }
  // 清空还原
  await s.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.oqc-hygiene-input input')]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    inputs.forEach((inp) => { setter.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) })
    return 1
  })()`)
  await sleep(400)
  await s.evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存'); if (b) b.click(); return 1 })()`)
  await sleep(3500)
  console.log('[restored]', await s.evaluate(`(() => [...document.querySelectorAll('.oqc-hygiene-input input')].map(x => x.value).join('|'))()`))
  await s.close?.()
} finally { process.exit(0) }
