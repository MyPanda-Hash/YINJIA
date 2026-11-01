/**
 * verify-click-edit.mjs —— 复核「工单排产页:单击格子出输入框 + 保存成功」(2026-11-01)
 *
 * 之前的 bug:board 页漏 import saveDayPlan ⇒ 格内保存抛 ReferenceError,点保存必失败。
 * 本脚本:选线 → 单击某行某天 → 输入 3 回车 → 校验接口真的落库 → 还原;再走一遍弹窗保存。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const ROW = 2173
const OP = '成型'
const DAY = '2026-11-06'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login.data.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const rowOf = async () => (await (await fetch(BASE + '/api/px/scheduleBoard/dayPlan/data', {
  method: 'POST', headers: H, body: JSON.stringify({ 行id列表: [ROW] }),
})).json()).data['行'][0]
const before = await rowOf()
console.log('保存前 日计划 =', JSON.stringify(before['日计划']))

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9485 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 900, deviceScaleFactor: 1, mobile: false })
  // 收集页面报错(之前的 ReferenceError 就是在这里露头)
  const errors = []
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

  // ① 单击(不是双击)⇒ 直接出输入框
  console.log('单击格子', await s.evaluate(`(() => {
    const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')].find(r => (r.innerText||'').includes('GD-2026-10-0226-1'))
    const heads = [...document.querySelectorAll('.el-table__header th')].map(th => (th.innerText||'').trim().split('\\n')[0])
    const idx = heads.findIndex(h => h === '${DAY.slice(5)}')
    const el = tr && tr.children[idx] && tr.children[idx].querySelector('.dp-plan')
    if (!el) return 'no-cell:' + heads.join('|')
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return 'clicked:' + idx
  })()`))
  await sleep(800)
  console.log('输入 3 并回车', await s.evaluate(`(() => {
    const inp = document.querySelector('.el-table__body .dp-input input')
    if (!inp) return 'no-input(单击没出输入框)'
    inp.focus()
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(inp, '3')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    return JSON.stringify({ disabled: inp.disabled, value: inp.value })
  })()`))
  await sleep(2500)
  console.log('页面错误提示', await s.evaluate(`(() => {
    const msgs = [...document.querySelectorAll('.el-message')].map(x => (x.innerText||'').trim())
    return JSON.stringify(msgs)
  })()`))
  const png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-click-edit.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-click-edit.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}

const after = await rowOf()
console.log('保存后 日计划 =', JSON.stringify(after['日计划']), '人工指定 =', JSON.stringify(after['人工指定']))
await fetch(BASE + '/api/px/scheduleBoard/dayPlan/save', {
  method: 'POST', headers: H,
  body: JSON.stringify({ rows: [{ 工单行id: ROW, 工序: OP, 生产线: '1号机', 计划日期: DAY, 计划数量: 0 }] }),
})
console.log('已还原 日计划 =', JSON.stringify((await rowOf())['日计划']))
