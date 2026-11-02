/**
 * shot-dialog.mjs —— 截图「排产快速调整」弹窗(2026-10-31)
 *
 * 用法: node shot-dialog.mjs [base]
 * 产出: shot-dialog.png(生产工单页:数量+日期两块)/ shot-dialog-board.png(工单排产页:多「调线」块)
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

const SCROLL = `(() => {
  const w = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
  const today = document.querySelector('.el-table__header th.dp-col-today')
  if (!w || !today) return 'no-anchor'
  w.scrollLeft = Math.max(0, w.scrollLeft + Math.round(today.getBoundingClientRect().left - 900))
  w.dispatchEvent(new Event('scroll', { bubbles: true }))
  return 'scrolled'
})()`

/** 双击某行某天的数量格(按表头文字找列) */
const dblClickCell = (no, dayMMDD) => `(() => {
  const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')]
    .find((r) => (r.innerText || '').includes('${no}'))
  if (!tr) return 'no-row'
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').trim().split('\\n')[0])
  const idx = heads.findIndex((h) => h === '${dayMMDD}')
  if (idx < 0) return 'no-col:' + heads.join('|')
  const td = tr.children[idx]
  const el = td && (td.querySelector('.dp-plan') || td.querySelector('.dp-date-cell'))
  if (!el) return 'no-el'
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  return 'opened:' + idx
})()`

async function shot(s, name) {
  const png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./' + name, import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written]', name)
}

const s = await launch({ port: 9475 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4000)

  // ① 生产工单页(数量 + 日期两块)
  await s.navigate(BASE + '/#/prod/plan/workOrderList'); await sleep(7000)
  console.log('滚动', await s.evaluate(SCROLL)); await sleep(1000)
  console.log('双击', await s.evaluate(dblClickCell('GD-2026-10-0226-1', '11-05')))
  await sleep(1500)
  await shot(s, 'shot-dialog.png')

  // ② 工单排产页(多「调线」块)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard'); await sleep(7000)
  console.log('选线', await s.evaluate(`(() => {
    const items = [...document.querySelectorAll('.wb-line')]
    const hit = items.find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === '1号机')
    if (!hit) return 'no-node'
    ;(hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`))
  await sleep(6000)
  console.log('滚动', await s.evaluate(SCROLL)); await sleep(1000)
  console.log('双击', await s.evaluate(dblClickCell('GD-2026-10-0226-1', '11-05')))
  await sleep(1800)
  await shot(s, 'shot-dialog-board.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
