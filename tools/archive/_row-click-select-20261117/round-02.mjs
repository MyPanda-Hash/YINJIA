// round-02.mjs — 验证「点整行即勾选」在四个页面的实际效果
//   订单结转 /prod/plan/orderConvert(先跳"最近有数据的一天")
//   生产工单 /prod/plan/workOrderList
//   工单排产 /prod/plan/workOrderBoard(先点左侧一条产线)
//   快速排产 /prod/plan/scheduleBoard(①待排产池 + ②全部已排产)
// 每页都做:点普通格子 ⇒ 勾上;再点同一格 ⇒ 取消;截图留证。
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

/** 在页面里找一个"点了只会触发 row-click"的普通格子(排除控件/链接/日排产格) */
const findCell = (tableIdx) => page.evaluate((i) => {
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

/** 读该表第一行的勾选状态 + 表内勾选行数 + 顶部按钮上的人数 */
const selState = (tableIdx) => page.evaluate((i) => {
  const table = document.querySelectorAll('.el-table')[i]
  const row = table?.querySelector('.el-table__body > tbody > tr.el-table__row')
  const cb = row?.querySelector('td .el-checkbox')
  return {
    firstRowChecked: !!cb && cb.classList.contains('is-checked'),
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    buttons: [...document.querySelectorAll('.el-button')].filter((b) => /（\d+）/.test(b.textContent || ''))
      .map((b) => (b.textContent || '').trim()).slice(0, 6),
  }
}, tableIdx)

const cycle = async (label, tableIdx) => {
  await normalWindow()
  const cell = await findCell(tableIdx)
  if (cell.err) { console.log(`[${label}] ✗ ${cell.err}`); return }
  const before = await selState(tableIdx)
  await page.mouse.click(cell.x, cell.y, { label: '点该行数据格' })
  await page.waitForTimeout(500)
  const after = await selState(tableIdx)
  await page.screenshot({ path: `${SHOT}/${label}-勾选.png` })
  await page.mouse.click(cell.x, cell.y, { label: '再点同一格取消' })
  await page.waitForTimeout(500)
  const after2 = await selState(tableIdx)
  console.log(`[${label}] 点格子="${cell.text}"`,
    '前:', JSON.stringify(before), '→ 点一次:', JSON.stringify(after), '→ 再点:', JSON.stringify(after2))
  // 顺手验"点复选框自己那一下别翻两次":先确保没勾,再点复选框,必须变成勾
  await page.mouse.click(cell.x, cell.y, { label: '重新勾上' })
  await page.waitForTimeout(300)
  const box = await page.evaluate((i) => {
    const table = document.querySelectorAll('.el-table')[i]
    const td = table?.querySelector('.el-table__body > tbody > tr.el-table__row > td')
    const cb = td?.querySelector('.el-checkbox')
    if (!cb) return null
    const r = cb.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  }, tableIdx)
  if (box) {
    const s1 = await selState(tableIdx)
    await page.mouse.click(box.x, box.y, { label: '点复选框取消' })
    await page.waitForTimeout(400)
    const s2 = await selState(tableIdx)
    console.log(`[${label}] 点复选框: 前 checked=${s1.firstRowChecked} → 后 checked=${s2.firstRowChecked}(应为 false)`)
    // 收尾:点回普通格,确认能再勾上,再点掉,不留勾选状态
    await page.mouse.click(cell.x, cell.y, { label: '再勾回来' })
    await page.waitForTimeout(300)
    const s3 = await selState(tableIdx)
    console.log(`[${label}] 收尾勾上: checked=${s3.firstRowChecked}`)
    await page.mouse.click(cell.x, cell.y, { label: '清掉勾选' })
    await page.waitForTimeout(300)
  }
}

// ───── ① 订单结转:默认当天没数据,先跳到最近有数据的一天 ─────
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.click('text=跳到最近有数据的一天', { label: '跳到最近有数据的一天' }).catch((e) => console.log('jump: ' + e.message))
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(1200)
await cycle('订单结转', 0)

// ───── ② 生产工单 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
await cycle('生产工单', 0)

// ───── ③ 工单排产:先点左侧一条产线 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.click('.wb-line:not(.off)', { label: '选一条生产线' }).catch((e) => console.log('line: ' + e.message))
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
await cycle('工单排产', 0)

// ───── ④ 快速排产:①待排产池 ─────
await page.goto('http://localhost:5173/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
await cycle('快速排产-待排产', 0)

// ② 已排产:先切「全部」让表里有行,再验一次
await page.click('.el-switch', { label: '切到全部已排产' }).catch((e) => console.log('switch: ' + e.message))
await page.waitForFunction(() => document.querySelectorAll('.el-table')[1]?.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
await cycle('快速排产-已排产', 1)

await normalWindow()
