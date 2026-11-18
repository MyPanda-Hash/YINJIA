// round-13.mjs — 提交后终态冒烟(源码已归一为 LF):生产工单点行翻勾选 + 快速排产①点行翻勾选
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const task = await taskSpace('yinjia-rowclick-final-smoke-20261117')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2500)
const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
if (need) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      if (!el) return
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
}
console.log('登录态:', await page.url())

const state = (i) => page.evaluate((idx) => {
  const table = document.querySelectorAll('.el-table')[idx]
  return {
    rows: table ? table.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length : -1,
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    buttons: [...document.querySelectorAll('.el-button')].filter((b) => /（\d+）/.test(b.textContent || ''))
      .map((b) => (b.textContent || '').trim()).slice(0, 4),
  }
}, i)

const cellXY = (i) => page.evaluate((idx) => {
  const row = document.querySelectorAll('.el-table')[idx]?.querySelector('.el-table__body > tbody > tr.el-table__row')
  if (!row) return null
  for (const td of [...row.querySelectorAll('td')]) {
    if (td.querySelector('input, a, button, .el-link, .el-checkbox, .dp-plan, .el-input-number, .el-date-editor, .el-select')) continue
    const text = (td.textContent || '').trim()
    if (!text) continue
    const r = td.getBoundingClientRect()
    if (r.width < 24 || r.height < 12 || r.top < 20 || r.bottom > window.innerHeight) continue
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: text.slice(0, 16) }
  }
  return null
}, i)

// ① 生产工单
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(2500)
const c1 = await cellXY(0)
const s1a = await state(0)
if (c1) { await page.mouse.click(c1.x, c1.y, { label: '生产工单点行' }); await page.waitForTimeout(700) }
const s1b = await state(0)
console.log('[生产工单] 格:', JSON.stringify(c1), '前:', JSON.stringify(s1a), '后:', JSON.stringify(s1b),
  '⇒ 点行翻上了:', s1b.checkedRows === s1a.checkedRows + 1)
await page.screenshot({ path: `${SHOT}/终态冒烟-生产工单.png` })
if (c1) { await page.mouse.click(c1.x, c1.y, { label: '取消勾选' }); await page.waitForTimeout(500) }

// ② 快速排产 ①
await page.goto('http://localhost:5173/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(2000)
const c2 = await cellXY(0)
const s2a = await state(0)
if (c2) { await page.mouse.click(c2.x, c2.y, { label: '快速排产点行' }); await page.waitForTimeout(700) }
const s2b = await state(0)
console.log('[快速排产①] 格:', JSON.stringify(c2), '前:', JSON.stringify(s2a), '后:', JSON.stringify(s2b),
  '⇒ 点行翻上了:', s2b.checkedRows === s2a.checkedRows + 1)
await page.screenshot({ path: `${SHOT}/终态冒烟-快速排产.png` })

await task.finish({ keep: [] })
console.log('空间已关闭')
