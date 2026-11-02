/**
 * shot-inline.mjs —— 截图复核「双击就地改数量 / 就地改日期」(2026-10-31)
 *
 * 步骤:先经接口给 2173 的 11-05 打一个人工指定(3) → 打开生产工单页 → 滚到日期列 →
 *      截一张(看「手」角标 + 新增的「计划开工日期」列) → 双击那格 → 再截一张(编辑态) →
 *      清掉人工指定(不留测试数据)。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const ROW = Number(process.argv[3] || 2173)
const NO = process.argv[4] || 'GD-2026-10-0226-1'
const DAY = process.argv[5] || '2026-11-05'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const post = async (p, b) => (await (await fetch(BASE + '/api/px/scheduleBoard/' + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())

/** 行工序(落人工指定时要用后端解析出来的那个工序) */
const data = await (await fetch(BASE + '/api/px/scheduleBoard/dayPlan/data', {
  method: 'POST', headers: H, body: JSON.stringify({ 行id列表: [ROW] }),
})).json()
const op = (data?.data?.['行'] || [])[0]?.['工序'] || ''
console.log('工序 =', op)

console.log('预置人工指定:', JSON.stringify((await post('dayPlan/save',
  { rows: [{ 工单行id: ROW, 工序: op, 生产线: '1号机', 计划日期: DAY, 计划数量: 3 }] })).data))

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9473 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderList'); await sleep(7000)

  // 滚到「日期列」一带:以今天那一列(th.dp-col-today)为锚
  console.log(await s.evaluate(`(() => {
    const w = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
    const today = document.querySelector('.el-table__header th.dp-col-today')
    if (!w || !today) return 'no-anchor'
    w.scrollLeft = Math.max(0, w.scrollLeft + Math.round(today.getBoundingClientRect().left - 900))
    w.dispatchEvent(new Event('scroll', { bubbles: true }))
    return 'scrolled:' + w.scrollLeft
  })()`))
  await sleep(1200)
  let shot = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-inline.png', import.meta.url), Buffer.from(shot.result.data, 'base64'))
  console.log('[written] shot-inline.png')

  // 双击那一格 → 截图编辑态
  console.log('双击', await s.evaluate(`(() => {
    const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')]
      .find((r) => (r.innerText || '').includes('${NO}'))
    if (!tr) return 'no-row'
    const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').trim().split('\\n')[0])
    const idx = heads.findIndex((h) => h === '${DAY.slice(5)}')
    if (idx < 0) return 'no-col:' + heads.join('|')
    const td = tr.children[idx]
    const span = td && td.querySelector('.dp-plan')
    if (!span) return 'no-span'
    span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    return 'dblclicked:' + idx
  })()`))
  await sleep(900)
  shot = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-inline-edit.png', import.meta.url), Buffer.from(shot.result.data, 'base64'))
  console.log('[written] shot-inline-edit.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
  console.log('清掉人工指定:', JSON.stringify((await post('dayPlan/save',
    { rows: [{ 工单行id: ROW, 工序: op, 生产线: '1号机', 计划日期: DAY, 计划数量: 0 }] })).data))
}
