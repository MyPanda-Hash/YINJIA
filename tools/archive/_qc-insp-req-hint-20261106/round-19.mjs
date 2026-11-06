const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/dashboard', { timeout: 45000 })
await page.reload({ timeout: 45000 })
await page.waitForTimeout(4000)
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0077', { timeout: 45000 })
await page.waitForTimeout(9000)

const before = await page.evaluate(() => document.querySelectorAll('.qr-table tbody tr').length)
console.log('带入前表体行数: ' + before)

// 删掉最后一行检验项(× 在每行行尾),模拟"后来要求表新增了一项"的场景
const del = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qr-table tbody tr')]
  const last = rows[rows.length - 1]
  if (!last) return 'no-row'
  const btns = [...last.querySelectorAll('span, i, button')]
  const x = btns.find((b) => (b.textContent || '').trim() === '×')
  if (!x) return 'no-x'
  x.click()
  return 'clicked-x'
})
console.log('删行 -> ' + del)
await page.waitForTimeout(1200)
const maybeConfirm = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => /确定|确认/.test(b.textContent || ''))
  if (btn) { btn.click(); return 'confirmed' }
  return 'no-confirm'
})
console.log('确认框 -> ' + maybeConfirm)
await page.waitForTimeout(1500)
const afterDel = await page.evaluate(() => document.querySelectorAll('.qr-table tbody tr').length)
console.log('删行后表体行数: ' + afterDel)

// 打开「检验要求」弹窗 → 点弹窗里的带入
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (el) el.click()
})
await page.waitForTimeout(4000)
const beforeImport = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  const btn = d && [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.innerText || '').includes('带入检验要求'))
  return { open: !!d, disabled: btn ? (!!btn.disabled || btn.classList.contains('is-disabled')) : null }
})
console.log('弹窗状态: ' + JSON.stringify(beforeImport))

await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  const btn = d && [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.innerText || '').includes('带入检验要求'))
  if (btn) btn.click()
})
await page.waitForTimeout(4000)
const afterImport = await page.evaluate(() => ({
  dialogOpen: !![...document.querySelectorAll('.el-dialog')].some((el) => (el.textContent || '').includes('来料检验要求')),
  rows: [...document.querySelectorAll('.qr-table tbody tr')].map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
  toasts: [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()),
}))
console.log('带入后: ' + JSON.stringify(afterImport, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-19.png' })
