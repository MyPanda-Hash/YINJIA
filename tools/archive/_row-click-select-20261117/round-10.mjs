// round-10.mjs — 订单结转单独复验(这一页格内控件最多:交货日期选择器 + 本次转单数量输入框)
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
    dateRange: [...document.querySelectorAll('.el-date-editor input')].map((i) => i.value).slice(0, 2),
  }
})

await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(3000)
console.log('落地:', JSON.stringify(await state()))

// 先把日期范围放宽到"近30天"(今天 2026-11-17 ⇒ 10-18~11-17,含 10-19)
const quick = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-picker-panel__shortcut, .el-picker-panel *')].find((e) => (e.textContent || '').trim() === '近30天')
  return el ? true : false
})
if (!quick) {
  // 快捷档要先把面板打开
  await page.click('.el-date-editor', { label: '打开日期范围' }).catch(() => {})
  await page.waitForTimeout(700)
}
await page.click('text=近30天', { label: '选近30天' }).catch((e) => console.log('近30天: ' + e.message))
await page.waitForTimeout(2000)
await page.click('text=查询', { label: '查询' }).catch(() => {})
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
console.log('放宽后:', JSON.stringify(await state()))

// ① 普通格 ⇒ 翻勾选
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
console.log('普通格:', JSON.stringify(cell))
const s0 = await state()
if (cell) { await page.mouse.click(cell.x, cell.y, { label: '点普通数据格' }); await page.waitForTimeout(600) }
const s1 = await state()
console.log('[订单结转·普通格] 前:', JSON.stringify(s0.buttons), '→ 后:', JSON.stringify(s1.buttons), '⇒ 翻上了:', s1.checkedRows === s0.checkedRows + 1)
await page.screenshot({ path: `${SHOT}/订单结转-勾选.png` })

// ② 本次转单数量输入框 ⇒ 不翻(此刻是"已勾一行",点输入框若被误翻会变 0)
const b2 = await state()
const r2 = await page.evaluate(() => {
  const el = document.querySelector('.el-table__body .el-input-number input')
  if (!el) return null
  el.click()
  return (el.closest('td')?.textContent || '').trim().slice(0, 10)
})
await page.waitForTimeout(700)
const a2 = await state()
console.log('[订单结转·数量输入框] 目标:', JSON.stringify(r2), '前 checked:', b2.checkedRows, '后 checked:', a2.checkedRows, '⇒ 未翻勾选:', a2.checkedRows === b2.checkedRows)

// ③ 交货日期选择器输入框 ⇒ 不翻
const b3 = await state()
const r3 = await page.evaluate(() => {
  const el = document.querySelector('.el-table__body .el-date-editor input')
  if (!el) return null
  el.click()
  return el.value
})
await page.waitForTimeout(700)
const a3 = await state()
console.log('[订单结转·交货日期输入框] 目标:', JSON.stringify(r3), '前 checked:', b3.checkedRows, '后 checked:', a3.checkedRows, '⇒ 未翻勾选:', a3.checkedRows === b3.checkedRows)
await page.screenshot({ path: `${SHOT}/订单结转-格内控件不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 收尾:把勾选点掉
if (cell) { await page.mouse.click(cell.x, cell.y, { label: '清掉勾选' }); await page.waitForTimeout(500) }
console.log('收尾:', JSON.stringify((await state()).buttons))
