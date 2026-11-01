/** 复核「工单排产页 弹窗保存」是否成功(2026-11-01) */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const ROW = 2173, OP = '成型', DAY = '2026-11-01'   // 弹窗默认落在今天,还原也要清这一天
const login = await (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })).json()
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const rowOf = async () => (await (await fetch(BASE + '/api/px/scheduleBoard/dayPlan/data', { method: 'POST', headers: H, body: JSON.stringify({ 行id列表: [ROW] }) })).json()).data['行'][0]
const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`
const s = await launch({ port: 9486 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard'); await sleep(7000)
  console.log('选线', await s.evaluate(`(() => {
    const items = [...document.querySelectorAll('.wb-line')]
    const hit = items.find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === '1号机')
    if (!hit) return 'no-node'; (hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`))
  await sleep(6000)
  // 点「开工日期」那格 → 弹窗
  console.log('开弹窗', await s.evaluate(`(() => {
    const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')].find(r => (r.innerText||'').includes('GD-2026-10-0226-1'))
    const el = tr && tr.querySelector('.dp-date-cell')
    if (!el) return 'no-cell'
    el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    return 'clicked'
  })()`))
  await sleep(1500)
  console.log('弹窗内改数量并保存', await s.evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return 'no-dialog'
    const inp = dlg.querySelector('.sq-num input')
    if (!inp) return 'no-input'
    inp.focus()
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(inp, '4'); inp.dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...dlg.querySelectorAll('.el-dialog__footer .el-button')].find(b => (b.innerText||'').includes('保存'))
    if (!btn) return 'no-save'; btn.click(); return 'saved'
  })()`))
  await sleep(3000)
  console.log('错误提示', await s.evaluate(`JSON.stringify([...document.querySelectorAll('.el-message')].map(x => (x.innerText||'').trim()))`))
  const png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-dialog-board-save.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-dialog-board-save.png')
} finally { try { s.close?.() } catch {} }
console.log('保存后 日计划 =', JSON.stringify((await rowOf())['日计划']))
await fetch(BASE + '/api/px/scheduleBoard/dayPlan/save', { method: 'POST', headers: H, body: JSON.stringify({ rows: [{ 工单行id: ROW, 工序: OP, 生产线: '1号机', 计划日期: DAY, 计划数量: 0 }] }) })
console.log('已还原 =', JSON.stringify((await rowOf())['日计划']))
