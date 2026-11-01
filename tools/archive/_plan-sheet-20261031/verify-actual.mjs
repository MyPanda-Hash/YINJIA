/**
 * verify-actual.mjs —— 复核「当天有报工的格子必须显示实际完成数」(2026-10-31 晚)
 * 检查:10-20 那格(GD-2026-10-0223,计划10/实报10)显示的是实际值、带 actual 标色、无双值小字。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9483 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard'); await sleep(7000)
  console.log('选线', await s.evaluate(`(() => {
    const items = [...document.querySelectorAll('.wb-line')]
    const hit = items.find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === '1号机')
    if (!hit) return 'no-node'
    ;(hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`))
  await sleep(6000)
  await s.evaluate(`(() => {
    const w = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
    const today = document.querySelector('.el-table__header th.dp-col-today')
    if (w && today) { w.scrollLeft = Math.max(0, w.scrollLeft + Math.round(today.getBoundingClientRect().left - 900)); w.dispatchEvent(new Event('scroll', { bubbles: true })) }
    return 1
  })()`)
  await sleep(1200)
  console.log('10-20 列状态', await s.evaluate(`(() => {
    const heads = [...document.querySelectorAll('.el-table__header th')].map(th => (th.innerText||'').trim().split('\\n')[0])
    const idx = heads.findIndex(h => h === '10-20')
    const rows = [...document.querySelectorAll('.el-table__body tr.el-table__row')]
    const out = rows.map((tr) => {
      const td = tr.children[idx]
      const span = td && td.querySelector('.dp-plan')
      return span ? { 文本: span.innerText.replace(/\\s+/g, ' '), 是实际: span.classList.contains('actual') } : null
    }).filter(Boolean)
    return JSON.stringify({ 列头: heads[idx], 有双值小字: !!document.querySelector('.dp-act'), 行: out })
  })()`))
  const png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-actual.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-actual.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
