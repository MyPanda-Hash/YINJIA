/**
 * verify-cell.mjs —— 复核「日期格:计划/实报融合 + 格内直接填」(2026-10-31)
 *
 * 检查点:
 *  1. 日期格里只剩**一个数**(不再有下方绿色「实 x」);
 *  2. 未达成的格子标橙色(.dp-plan.short)、显示的数是实际值;
 *  3. 双击格子 → 格内出现输入框(可编辑,不是灰的)→ 填 3 → 回车 → 接口落库 → 还原。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const ROW = 2173
const OP = '成型'
const DAY = '2026-11-05'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login.data.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const row = async () => (await (await fetch(BASE + '/api/px/scheduleBoard/dayPlan/data', {
  method: 'POST', headers: H, body: JSON.stringify({ 行id列表: [ROW] }),
})).json()).data['行'][0]
const before = await row()
console.log('保存前 日计划 =', JSON.stringify(before['日计划']), '日报工 =', JSON.stringify(before['日报工']))

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9482 })
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
  await sleep(1200)

  // ① 格子里只有一个数 & 实报小字已消失
  console.log('格内形态', await s.evaluate(`(() => {
    const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')].find(r => (r.innerText||'').includes('GD-2026-10-0226-1'))
    const heads = [...document.querySelectorAll('.el-table__header th')].map(th => (th.innerText||'').trim().split('\\n')[0])
    const idx = heads.findIndex(h => h === '11-05')
    const td = tr && tr.children[idx]
    return JSON.stringify({
      有实报小字: !!document.querySelector('.dp-act'),
      格子文本: td ? (td.querySelector('.dp-plan') || {}).innerText : 'no-cell',
      是输入框: !!(td && td.querySelector('.dp-input')),
    })
  })()`))

  // ② 未达成标色:找一个 .dp-plan.short(有报工但没达成的历史格)
  console.log('融合标色', await s.evaluate(`(() => {
    const short = [...document.querySelectorAll('.dp-plan.short')]
    return JSON.stringify({ short数: short.length, 前两个: short.slice(0, 2).map(e => e.innerText) })
  })()`))

  // ③ 双击格内直接填
  console.log('双击', await s.evaluate(`(() => {
    const tr = [...document.querySelectorAll('.el-table__body tr.el-table__row')].find(r => (r.innerText||'').includes('GD-2026-10-0226-1'))
    const heads = [...document.querySelectorAll('.el-table__header th')].map(th => (th.innerText||'').trim().split('\\n')[0])
    const idx = heads.findIndex(h => h === '${DAY.slice(5)}')
    const el = tr && tr.children[idx] && tr.children[idx].querySelector('.dp-plan')
    if (!el) return 'no-cell'
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'dblclicked'
  })()`))
  await sleep(800)
  console.log('编辑态', await s.evaluate(`(() => {
    const inp = document.querySelector('.el-table__body .dp-input input')
    if (!inp) return 'no-input'
    inp.focus()
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(inp, '3')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    return JSON.stringify({ disabled: inp.disabled, value: inp.value })
  })()`))
  await sleep(2500)
  const png = await s.send('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(new URL('./shot-cell-fused.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-cell-fused.png')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}

const after = await row()
console.log('保存后 日计划 =', JSON.stringify(after['日计划']), '人工指定 =', JSON.stringify(after['人工指定']))
await fetch(BASE + '/api/px/scheduleBoard/dayPlan/save', {
  method: 'POST', headers: H,
  body: JSON.stringify({ rows: [{ 工单行id: ROW, 工序: OP, 生产线: '1号机', 计划日期: DAY, 计划数量: 0 }] }),
})
console.log('已还原 日计划 =', JSON.stringify((await row())['日计划']))
