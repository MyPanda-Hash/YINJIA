/**
 * shot-print-layer.mjs —— 验证「工单排产 → 排单计划」按钮链路,并截**页面内打印层**(2026-10-31)
 *
 * 做法:先把 window.print 打桩(无头环境不弹系统打印对话框,也不会触发 afterprint),
 *      点按钮 → 打印层留在页面上 → 直接截图,看到的就是真正会打出去的版式。
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

const s = await launch({ port: 9480 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard'); await sleep(7000)
  // 选 1号机(2026-11-01:打印跟随选中产线)
  console.log('选线', await s.evaluate(`(() => {
    const items = [...document.querySelectorAll('.wb-line')]
    const hit = items.find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === '1号机')
    if (!hit) return 'no-node'
    ;(hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`))
  await sleep(6000)

  // 打桩 window.print:无头浏览器不会弹系统打印框,也避免 afterprint 立刻摘掉打印层
  console.log('打桩', await s.evaluate(`(() => { window.print = function () { window.__printed = (window.__printed || 0) + 1 } ; return 'ok' })()`))
  console.log('点按钮', await s.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === '排单计划')
    if (!btn) return 'no-button:' + [...document.querySelectorAll('button')].map(b => (b.innerText||'').trim()).filter(Boolean).slice(-12).join('|')
    btn.click(); return 'clicked'
  })()`))
  await sleep(2500)
  console.log('状态', await s.evaluate(`(() => {
    const host = document.getElementById('yj-print-host')
    return JSON.stringify({
      printed: window.__printed || 0,
      hasLayer: !!host,
      title: document.title,
      rows: host ? host.querySelectorAll('tbody tr').length : 0,
      heads: host ? [...host.querySelectorAll('thead th')].map(t => (t.innerText||'').trim()) : [],
    })
  })()`))
  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./shot-print-layer.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-print-layer.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
