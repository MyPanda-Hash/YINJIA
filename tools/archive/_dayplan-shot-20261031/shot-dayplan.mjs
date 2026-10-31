/**
 * shot-dayplan.mjs —— 截图复核「生产工单」页日期列(2026-10-31 计划/报工分清 + 今天/过去分段)
 *
 * 用法: node shot-dayplan.mjs [base] [outName]
 * 产出: shot-dayplan.png(表体横向滚到日期列区域)
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const NAME = process.argv[3] || 'shot-dayplan.png'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

/** 把表格横向滚到「日期列」一带(左侧固定列会跟着走) */
const SCROLL_JS = (left) => `(() => {
  const wraps = [...document.querySelectorAll('.el-table__body-wrapper .el-scrollbar__wrap')]
  if (!wraps.length) return 'no-wrap'
  const w = wraps[0]
  w.scrollLeft = ${left}
  w.dispatchEvent(new Event('scroll', { bubbles: true }))
  const heads = [...document.querySelectorAll('.el-table__header th')].map(th => th.innerText.trim().replace(/\\s+/g, ' '))
  const past = document.querySelectorAll('.el-table__header th.dp-col-past').length
  const today = document.querySelectorAll('.el-table__header th.dp-col-today').length
  const days = [...document.querySelectorAll('.el-table__header th .dp-date')].map(x => x.innerText.trim())
  const todayMark = document.querySelector('.el-table__header .dp-today')?.innerText || ''
  const acts = [...document.querySelectorAll('.el-table__body .dp-act')].map(x => x.innerText.trim())
  return JSON.stringify({ max: w.scrollWidth, left: w.scrollLeft, past, today, days, todayMark, acts, heads: heads.slice(0, 6) })
})()`

const s = await launch({ port: 9467 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS))
  await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderList'); await sleep(7000)
  console.log('概览', await s.evaluate(`JSON.stringify({ rows: document.querySelectorAll('.el-table__body tr.el-table__row').length, title: document.title })`))
  // 先量一下可滚动宽度,再滚到「日期列」附近
  const probe1 = await s.evaluate(SCROLL_JS(0))
  console.log('滚动0', probe1)
  const j = JSON.parse(probe1 || '{}')
  const target = Math.max(0, Math.round((j.max || 0) * 0.62))
  console.log('滚动到', target, await s.evaluate(SCROLL_JS(target)))
  await sleep(1200)
  const shot = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const b64 = shot?.result?.data
  if (!b64) console.log('截图失败', JSON.stringify(shot).slice(0, 300))
  else { await fs.writeFile(new URL('./' + NAME, import.meta.url), Buffer.from(b64, 'base64')); console.log('[written]', NAME) }
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
