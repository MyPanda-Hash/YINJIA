/**
 * shot-board.mjs —— 截图复核「工单排产」页(WorkOrderBoard)日期列:今/过去分段 + 计划与报工分清 + 产能列头
 * 用法: node shot-board.mjs [base] [outName]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const NAME = process.argv[3] || 'shot-board.png'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin')
  set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const PICK_LINE = (name) => `(() => {
  const items = [...document.querySelectorAll('.wb-line')]
  const hit = items.find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === '${name}')
  if (!hit) return 'no-node:' + items.slice(0, 6).map(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim()).join('|')
  const nameEl = hit.querySelector('.wb-line-name') || hit
  nameEl.click(); return 'clicked:' + (hit.innerText || '').trim().split('\\n')[0]
})()`

const SCROLL_JS = (left) => `(() => {
  const wraps = [...document.querySelectorAll('.el-table__body-wrapper .el-scrollbar__wrap')]
  if (!wraps.length) return 'no-wrap'
  const w = wraps[0]
  w.scrollLeft = ${left}
  w.dispatchEvent(new Event('scroll', { bubbles: true }))
  const past = document.querySelectorAll('.el-table__header th.dp-col-past').length
  const today = document.querySelectorAll('.el-table__header th.dp-col-today').length
  const days = [...document.querySelectorAll('.el-table__header th .dp-date')].map(x => x.innerText.trim())
  const caps = [...document.querySelectorAll('.el-table__header th .dp-cap')].slice(0, 4).map(x => x.innerText.trim())
  const acts = [...document.querySelectorAll('.el-table__body .dp-act')].map(x => x.innerText.trim())
  return JSON.stringify({ max: w.scrollWidth, left: w.scrollLeft, past, today, days, caps, acts })
})()`

const s = await launch({ port: 9468 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS))
  await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard'); await sleep(7000)
  console.log('选线', await s.evaluate(PICK_LINE(process.env.LINE || '2号车间')))
  await sleep(6000)
  const p0 = await s.evaluate(SCROLL_JS(0))
  console.log('滚动0', p0)
  const j = JSON.parse(p0 || '{}')
  // 先把「第一列日期」滚到视口 x≈320 处(自动量距,不靠猜比例)
  console.log('对齐日期列', await s.evaluate(`(() => {
    const wraps = [...document.querySelectorAll('.el-table__body-wrapper .el-scrollbar__wrap')]
    if (!wraps.length) return 'no-wrap'
    const w = wraps[0]
    const first = document.querySelector('.el-table__header th.dp-col-today')
    if (!first) return 'no-date-head'
    const rect = first.getBoundingClientRect()
    const delta = Math.round(rect.left - 830)
    w.scrollLeft = Math.max(0, w.scrollLeft + delta)
    w.dispatchEvent(new Event('scroll', { bubbles: true }))
    return JSON.stringify({ delta, left: w.scrollLeft })
  })()`))
  await sleep(1400)
  console.log('状态', await s.evaluate(`(() => {
    const wraps = [...document.querySelectorAll('.el-table__body-wrapper .el-scrollbar__wrap')]
    const w = wraps[0] || {}
    const past = document.querySelectorAll('.el-table__header th.dp-col-past').length
    const today = document.querySelectorAll('.el-table__header th.dp-col-today').length
    const days = [...document.querySelectorAll('.el-table__header th .dp-date')].map(x => x.innerText.trim())
    return JSON.stringify({ left: w.scrollLeft, past, today, days })
  })()`))
  const shot = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const b64 = shot?.result?.data
  if (!b64) console.log('截图失败', JSON.stringify(shot).slice(0, 300))
  else { await fs.writeFile(new URL('./' + NAME, import.meta.url), Buffer.from(b64, 'base64')); console.log('[written]', NAME) }
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
