/**
 * dialog-save.mjs —— 端到端:双击 → 弹窗改数量 → 保存 → 校验(2026-10-31)
 * 跑完会把人工指定清掉,不留测试数据。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const ROW = 2173

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login.data.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const data = async () => (await (await fetch(BASE + '/api/px/scheduleBoard/dayPlan/data', {
  method: 'POST', headers: H, body: JSON.stringify({ 行id列表: [ROW] }),
})).json()).data['行'][0]
const before = await data()
console.log('保存前:日计划 =', JSON.stringify(before['日计划']), '人工指定 =', JSON.stringify(before['人工指定']))

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9476 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4000)
  await s.navigate(BASE + '/#/prod/plan/workOrderList'); await sleep(7000)

  await s.evaluate(`(() => {
    const w = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
    const today = document.querySelector('.el-table__header th.dp-col-today')
    if (w && today) { w.scrollLeft = Math.max(0, w.scrollLeft + Math.round(today.getBoundingClientRect().left - 900)); w.dispatchEvent(new Event('scroll', { bubbles: true })) }
    return 1
  })()`)
  await sleep(1000)
  console.log('双击格:', await s.evaluate(`(() => {
    const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')].find(r => (r.innerText||'').includes('GD-2026-10-0226-1'))
    const heads = [...document.querySelectorAll('.el-table__header th')].map(th => (th.innerText||'').trim().split('\\n')[0])
    const idx = heads.findIndex(h => h === '11-05')
    const el = tr && tr.children[idx] && tr.children[idx].querySelector('.dp-plan')
    if (!el) return 'no-cell'
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'ok:' + idx
  })()`))
  await sleep(1500)

  console.log('填 3 并保存:', await s.evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return 'no-dialog'
    const inp = dlg.querySelector('.sq-num input')
    if (!inp) return 'no-input'
    inp.focus()
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(inp, '3')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    const btn = [...dlg.querySelectorAll('.el-dialog__footer .el-button')].find(b => (b.innerText||'').includes('保存'))
    if (!btn) return 'no-save'
    btn.click(); return 'saved'
  })()`))
  await sleep(3000)
  const png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-dialog-saved.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-dialog-saved.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}

const after = await data()
console.log('保存后:日计划 =', JSON.stringify(after['日计划']), '\n        人工指定 =', JSON.stringify(after['人工指定']), '合计 =', after['计划合计'])
// 还原
const op = after['工序'] || ''
await fetch(BASE + '/api/px/scheduleBoard/dayPlan/save', {
  method: 'POST', headers: H,
  body: JSON.stringify({ rows: [{ 工单行id: ROW, 工序: op, 生产线: '1号机', 计划日期: '2026-11-05', 计划数量: 0 }] }),
})
console.log('已还原,当前日计划 =', JSON.stringify((await data())['日计划']))
