// round-04.mjs — 反向验证:格内控件/链接点了**不该**翻勾选
//   ① 生产工单:点日排产格(.dp-plan)⇒ 就地编辑出现,但勾选不许变
//   ② 生产工单:点工单号链接(.el-link)⇒ 打开追溯弹窗,但勾选不许变
//   ③ 工单排产:点日排产格(.dp-plan)⇒ 同上
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))

const state = () => page.evaluate(() => {
  const table = document.querySelectorAll('.el-table')[0]
  return {
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    inlineEditors: document.querySelectorAll('.el-input-number, .dp-input').length,
    dialogs: document.querySelectorAll('.el-dialog').length,
    dialogTitle: (document.querySelector('.el-dialog__title')?.textContent || '').trim(),
  }
})

async function clickEl(selector, label) {
  const box = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0)
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: (el.textContent || '').trim().slice(0, 20) }
  }, selector)
  if (!box) { console.log(`[${label}] ✗ 没找到 ${selector}`); return null }
  await page.mouse.click(box.x, box.y, { label })
  return box
}

// ───── ① 生产工单:日排产格 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2000)
const before1 = await state()
const c1 = await clickEl('.dp-plan', '点日排产格')
await page.waitForTimeout(700)
const after1 = await state()
console.log('[生产工单·日排产格]', JSON.stringify(c1), '前:', JSON.stringify(before1), '后:', JSON.stringify(after1))
await page.screenshot({ path: `${SHOT}/生产工单-日排产格不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ───── ② 生产工单:工单号链接 ─────
const before2 = await state()
const c2 = await clickEl('.el-table__body .el-link', '点工单号链接')
await page.waitForTimeout(1200)
const after2 = await state()
console.log('[生产工单·工单号链接]', JSON.stringify(c2), '前:', JSON.stringify(before2), '后:', JSON.stringify(after2))
await page.screenshot({ path: `${SHOT}/生产工单-工单号链接不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

// ───── ③ 工单排产:日排产格 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(2500)
const line = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-left .wb-line')].find((e) => !e.classList.contains('off'))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
if (line) await page.mouse.click(line.x, line.y, { label: '点选一条生产线' })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2000)
const before3 = await state()
const c3 = await clickEl('.dp-plan', '点日排产格')
await page.waitForTimeout(700)
const after3 = await state()
console.log('[工单排产·日排产格]', JSON.stringify(c3), '前:', JSON.stringify(before3), '后:', JSON.stringify(after3))
await page.screenshot({ path: `${SHOT}/工单排产-日排产格不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
