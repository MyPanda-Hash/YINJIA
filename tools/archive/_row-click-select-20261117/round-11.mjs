// round-11.mjs — 订单结转:走"跳到最近有数据的一天"进入有数据的日期,再验 普通格翻 / 数量框与交期框不翻
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
const page = (await task.pages())[0]

const state = () => page.evaluate(() => {
  const table = document.querySelectorAll('.el-table')[0]
  return {
    rows: table ? table.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length : -1,
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    buttons: [...document.querySelectorAll('.el-button')].filter((b) => /（\d+）/.test(b.textContent || ''))
      .map((b) => (b.textContent || '').trim()).slice(0, 4),
  }
})

await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.click('text=跳到最近有数据的一天', { label: '跳到最近有数据的一天' }).catch((e) => console.log('jump: ' + e.message))
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1800)
console.log('有数据后:', JSON.stringify(await state()))

// ① 普通格(订单资料那一格)⇒ 翻勾选
const cell = await page.evaluate(() => {
  const row = document.querySelectorAll('.el-table')[0]?.querySelector('.el-table__body > tbody > tr.el-table__row')
  if (!row) return null
  for (const td of [...row.querySelectorAll('td')]) {
    if (td.querySelector('input, a, button, .el-link, .el-checkbox, .el-input-number, .el-date-editor, .el-select')) continue
    const text = (td.textContent || '').trim()
    if (!text) continue
    const r = td.getBoundingClientRect()
    if (r.width < 24 || r.height < 12 || r.top < 20 || r.bottom > window.innerHeight) continue
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: text.slice(0, 18) }
  }
  return null
})
const s0 = await state()
if (cell) { await page.mouse.click(cell.x, cell.y, { label: '点普通数据格' }); await page.waitForTimeout(700) }
const s1 = await state()
console.log('[订单结转·普通格]', JSON.stringify(cell), '前:', JSON.stringify(s0.buttons), '→ 后:', JSON.stringify(s1.buttons), '⇒ 翻上了:', s1.checkedRows === s0.checkedRows + 1)
await page.screenshot({ path: `${SHOT}/订单结转-勾选.png` })

// ② 本次转单数量输入框 ⇒ 不翻(当前已勾 1 行,若误翻会变 0)
const b2 = await state()
const r2 = await page.evaluate(() => {
  const el = document.querySelector('.el-table__body .el-input-number input')
  if (!el) return null
  el.click()
  return el.value
})
await page.waitForTimeout(700)
const a2 = await state()
console.log('[订单结转·数量输入框] 目标值:', JSON.stringify(r2), '前 checked:', b2.checkedRows, '后 checked:', a2.checkedRows, '⇒ 未翻勾选:', a2.checkedRows === b2.checkedRows)

// ③ 交货日期输入框 ⇒ 不翻
const b3 = await state()
const r3 = await page.evaluate(() => {
  const el = document.querySelector('.el-table__body .el-date-editor input')
  if (!el) return null
  el.click()
  return el.value
})
await page.waitForTimeout(700)
const a3 = await state()
console.log('[订单结转·交货日期输入框] 目标值:', JSON.stringify(r3), '前 checked:', b3.checkedRows, '后 checked:', a3.checkedRows, '⇒ 未翻勾选:', a3.checkedRows === b3.checkedRows)
await page.screenshot({ path: `${SHOT}/订单结转-格内控件不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 收尾:点掉勾选
if (cell) { await page.mouse.click(cell.x, cell.y, { label: '清掉勾选' }); await page.waitForTimeout(600) }
console.log('收尾:', JSON.stringify((await state()).buttons))
