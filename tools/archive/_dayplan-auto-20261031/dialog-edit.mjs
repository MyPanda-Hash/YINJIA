/**
 * dialog-edit.mjs —— 验证弹窗里「数量和日期真的可以手填」(2026-10-31 修 canDayPlan 未定义导致控件恒灰)
 *
 * 步骤:双击日期格 → 检查输入框/日期控件 disabled=false → 真实按键输入 3 → 保存 → 校验 → 还原。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const ROW = 2173
const OP = '成型'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login.data.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const row = async () => (await (await fetch(BASE + '/api/px/scheduleBoard/dayPlan/data', {
  method: 'POST', headers: H, body: JSON.stringify({ 行id列表: [ROW] }),
})).json()).data['行'][0]
console.log('保存前 日计划 =', JSON.stringify((await row())['日计划']))

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9477 })
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

  // ① 控件是否可编辑(这次的核心验证:disabled 必须是 false)
  console.log('控件可用性:', await s.evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return 'no-dialog'
    const num = dlg.querySelector('.sq-num input')
    const dates = [...dlg.querySelectorAll('.sq-date input')]
    const btns = [...dlg.querySelectorAll('.el-button')].map(b => (b.innerText||'').trim()).filter(Boolean)
    return JSON.stringify({
      数量输入框: num ? { disabled: num.disabled, readOnly: num.readOnly } : 'missing',
      日期控件: dates.map((d) => d.disabled),
      按钮: btns,
      恢复自动禁用: [...dlg.querySelectorAll('.el-button')].filter(b => (b.innerText||'').includes('恢复自动')).map(b => b.disabled),
    })
  })()`))

  // ② 真实改值:el-input-number 内部 input 触发 input 事件(等价用户键入)
  console.log('填 3:', await s.evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog')
    const inp = dlg.querySelector('.sq-num input')
    if (!inp) return 'no-input'
    inp.focus()
    inp.value = ''
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    for (const ch of '3') inp.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }))
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(inp, '3')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return inp.value
  })()`))
  await sleep(500)
  // 先截一张「弹窗里已填 3」的图(证明真的能填),再点保存
  let png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-dialog-editable.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-dialog-editable.png')
  await s.evaluate(`(() => {
    const dlg = document.querySelector('.el-dialog')
    const btn = [...dlg.querySelectorAll('.el-dialog__footer .el-button')].find(b => (b.innerText||'').includes('保存'))
    if (btn) btn.click(); return 1
  })()`)
  await sleep(3000)
  png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-dialog-saved.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-dialog-saved.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}

const after = await row()
console.log('保存后 日计划 =', JSON.stringify(after['日计划']), '人工指定 =', JSON.stringify(after['人工指定']))
await fetch(BASE + '/api/px/scheduleBoard/dayPlan/save', {
  method: 'POST', headers: H,
  body: JSON.stringify({ rows: [{ 工单行id: ROW, 工序: OP, 生产线: '1号机', 计划日期: '2026-11-05', 计划数量: 0 }] }),
})
console.log('已还原 日计划 =', JSON.stringify((await row())['日计划']))
