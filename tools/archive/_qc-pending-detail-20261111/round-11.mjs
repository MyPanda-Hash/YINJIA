/* round-11.mjs — 点行内「取消完成」→ 确认 → 验证状态回弹(测试库,验完 SQL 复原) */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

// 关掉可能还开着的查询弹窗
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-dialog__headerbtn, .el-dialog button')]
  const x = document.querySelector('.el-dialog__headerbtn')
  if (x) x.click()
})
await page.waitForTimeout(800)

const before = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const txt = (document.querySelector('.report-body') || document.body).innerText.replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  return {
    total: m ? m[1] : null,
    rowCount: bodyRows.length,
    cells: bodyRows[0] ? [...bodyRows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()) : [],
    hasReopen: !!document.querySelector('.doc-no-link'),
  }
})
console.log('before ->', JSON.stringify(before, null, 2))

// 点「取消完成」
const clickRes = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-no-link')].find((x) => (x.innerText || '').trim() === '取消完成')
  if (!el) return 'not-found'
  el.click()
  return 'clicked'
})
console.log('click 取消完成 ->', clickRes)
await page.waitForTimeout(1200)

// 确认框:点「确定」
const confirmed = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  const txt = box ? (box.innerText || '').replace(/\s+/g, ' ') : ''
  const btn = box ? [...box.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '确定') : null
  if (btn) { btn.click(); return { msg: txt, clicked: true } }
  return { msg: txt, clicked: false }
})
console.log('confirm ->', JSON.stringify(confirmed))
await page.waitForTimeout(4000)

const after = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const toasts = [...document.querySelectorAll('.el-message')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
  return {
    rowCount: bodyRows.length,
    cells: bodyRows[0] ? [...bodyRows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()) : [],
    toasts,
  }
})
console.log('after ->', JSON.stringify(after, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-11-reopen.png' })
