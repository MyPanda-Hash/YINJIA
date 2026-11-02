/**
 * shot-en.mjs —— 多语言自检(AGENTS.md:提交前切 en 走查新增 UI 文案)
 * 把 locale 切到 en 后截「生产工单」页日期列:应显示 Act.(报工) / Today(今天)。
 * 用法: node shot-en.mjs [base] [outName]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const NAME = process.argv[3] || 'shot-dayplan-en.png'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('Login account'), 'admin')
  set(ph('登录密码') || ph('Password'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统') || (b.textContent||'').includes('Sign in') || (b.textContent||'').includes('Login'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const ALIGN_JS = `(() => {
  const w = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
  const today = document.querySelector('.el-table__header th.dp-col-today')
  if (!w || !today) return JSON.stringify({ ok: false, hasToday: !!today })
  w.scrollLeft = Math.max(0, w.scrollLeft + Math.round(today.getBoundingClientRect().left - 830))
  w.dispatchEvent(new Event('scroll', { bubbles: true }))
  return JSON.stringify({
    ok: true,
    days: [...document.querySelectorAll('.el-table__header th .dp-date')].map(x => x.innerText.trim()),
    todayMark: document.querySelector('.el-table__header .dp-today')?.innerText || '',
    acts: [...document.querySelectorAll('.el-table__body .dp-act')].map(x => x.innerText.trim()),
  })
})()`

const s = await launch({ port: 9470 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS))
  await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderList'); await sleep(6000)
  // 切英语(真源是 localStorage 的 mes_locale,见 stores/locale.js)
  await s.evaluate(`(() => { localStorage.setItem('mes_locale', 'en'); location.reload(); return 'reload' })()`)
  await sleep(8000)
  console.log('en', await s.evaluate(ALIGN_JS))
  await sleep(1200)
  const shot = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const b64 = shot?.result?.data
  if (!b64) console.log('截图失败', JSON.stringify(shot).slice(0, 300))
  else { await fs.writeFile(new URL('./' + NAME, import.meta.url), Buffer.from(b64, 'base64')); console.log('[written]', NAME) }
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
