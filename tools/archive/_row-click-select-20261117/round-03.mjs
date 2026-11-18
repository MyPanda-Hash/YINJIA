// round-03.mjs — 补验 ③工单排产(先选中一条产线) 与 ④快速排产②已排产(表在折叠下方,先滚到视口内)
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))

async function normalWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { console.log('restore skip: ' + e.message) }
}

const selState = (tableIdx) => page.evaluate((i) => {
  const table = document.querySelectorAll('.el-table')[i]
  const row = table?.querySelector('.el-table__body > tbody > tr.el-table__row')
  const cb = row?.querySelector('td .el-checkbox')
  return {
    rows: table ? table.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length : -1,
    firstRowChecked: !!cb && cb.classList.contains('is-checked'),
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    buttons: [...document.querySelectorAll('.el-button')].filter((b) => /（\d+）/.test(b.textContent || ''))
      .map((b) => (b.textContent || '').trim()).slice(0, 8),
  }
}, tableIdx)

/** 把表格滚到视口中间,再找一个只会触发 row-click 的普通格子 */
async function findCell(tableIdx) {
  await page.evaluate((i) => document.querySelectorAll('.el-table')[i]?.scrollIntoView({ block: 'center' }), tableIdx)
  await page.waitForTimeout(600)
  return page.evaluate((i) => {
    const table = document.querySelectorAll('.el-table')[i]
    if (!table) return { err: 'no table' }
    const row = table.querySelector('.el-table__body > tbody > tr.el-table__row')
    if (!row) return { err: 'no row' }
    for (const td of [...row.querySelectorAll('td')]) {
      if (td.querySelector('input, a, button, .el-link, .el-checkbox, .dp-plan, .el-input-number, .el-date-editor, .el-select')) continue
      const text = (td.textContent || '').trim()
      if (!text) continue
      const r = td.getBoundingClientRect()
      if (r.width < 24 || r.height < 12) continue
      if (r.top < 20 || r.bottom > window.innerHeight) continue
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: text.slice(0, 24) }
    }
    return { err: 'no safe cell' }
  }, tableIdx)
}

const cycle = async (label, tableIdx) => {
  await normalWindow()
  const cell = await findCell(tableIdx)
  if (cell.err) { console.log(`[${label}] ✗ ${cell.err}`); await page.screenshot({ path: `${SHOT}/${label}-未取到.png` }); return }
  const before = await selState(tableIdx)
  await page.mouse.click(cell.x, cell.y, { label: '点该行数据格' })
  await page.waitForTimeout(500)
  const after = await selState(tableIdx)
  await page.screenshot({ path: `${SHOT}/${label}-勾选.png` })
  await page.mouse.click(cell.x, cell.y, { label: '再点同一格取消' })
  await page.waitForTimeout(500)
  const after2 = await selState(tableIdx)
  console.log(`[${label}] 点格子="${cell.text}"`, '\n   前:', JSON.stringify(before), '\n   点一次:', JSON.stringify(after), '\n   再点:', JSON.stringify(after2))
  // 点复选框自己那一下:只允许翻一次(不能"点了没反应")
  const box = await page.evaluate((i) => {
    const cb = document.querySelectorAll('.el-table')[i]?.querySelector('.el-table__body > tbody > tr.el-table__row > td .el-checkbox')
    if (!cb) return null
    const r = cb.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  }, tableIdx)
  if (box) {
    await page.mouse.click(box.x, box.y, { label: '点复选框勾上' })
    await page.waitForTimeout(400)
    const s1 = await selState(tableIdx)
    await page.mouse.click(box.x, box.y, { label: '点复选框取消' })
    await page.waitForTimeout(400)
    const s2 = await selState(tableIdx)
    console.log(`[${label}] 复选框自身: 点一下 checked=${s1.firstRowChecked}(应 true) → 再点 checked=${s2.firstRowChecked}(应 false)`)
  }
}

// ───── ③ 工单排产:先选中左侧第一条产线 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(2500)
const line = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-left .wb-line')].find((e) => !e.classList.contains('off'))
  if (!el) return null
  el.scrollIntoView({ block: 'center' })
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), name: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) }
})
console.log('左侧产线:', JSON.stringify(line))
if (line) await page.mouse.click(line.x, line.y, { label: '点选一条生产线' })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2000)
await cycle('工单排产', 0)

// ───── ④ 快速排产 ②已排产:切「全部」再滚到表里 ─────
await page.goto('http://localhost:5173/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(2500)
const sw = await page.evaluate(() => {
  const el = document.querySelector('.sb-head .el-switch')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), on: el.classList.contains('is-checked') }
})
console.log('全部开关:', JSON.stringify(sw))
if (sw && !sw.on) await page.mouse.click(sw.x, sw.y, { label: '切到全部已排产' })
await page.waitForFunction(() => document.querySelectorAll('.el-table')[1]?.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(2000)
console.log('②行数:', (await selState(1)).rows, '①行数:', (await selState(0)).rows)
await cycle('快速排产-已排产', 1)

await normalWindow()
