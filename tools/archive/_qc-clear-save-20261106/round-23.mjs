const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REQ', { timeout: 45000 })
await page.waitForTimeout(9000)

const idx = await page.evaluate(() => [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')]
  .findIndex((tr) => (tr.innerText || '').includes('YJ-YCYX-006')))
console.log('row index = ' + idx)

const before = await page.evaluate((idx) => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
  return tr ? [...tr.children].map((td) => (td.innerText || '').trim()) : null
}, idx)
console.log('清空前: ' + JSON.stringify(before))

// 只清空「折数」(第 7 格)并保存 —— 保存后立刻外部查库,验证是否真的落成 NULL
await page.evaluate((idx) => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
  const b = tr && tr.querySelector('.rs-op-edit')
  if (b) b.click()
}, idx)
await page.waitForTimeout(800)
console.log('set -> ' + await page.evaluate((idx) => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
  const inp = tr && tr.querySelectorAll('td .rs-c-in input')[6]
  if (!inp) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return 'cleared'
}, idx))
await page.waitForTimeout(600)
await page.evaluate((idx) => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
  const b = tr && tr.querySelector('.rs-op-done')
  if (b) b.click()
}, idx)
await page.waitForTimeout(800)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.qc-bar-btn')].find((b) => (b.innerText || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(5000)
console.log('保存后 toast: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))))

// 重新拉一次面板数据(刷新),看界面回显是否也空了
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.qc-bar-btn')].find((b) => (b.innerText || '').trim() === '刷新')
  if (btn) btn.click()
})
await page.waitForTimeout(5000)
const after = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')].find((x) => (x.innerText || '').includes('YJ-YCYX-006'))
  return tr ? [...tr.children].map((td) => (td.innerText || '').trim()) : null
})
console.log('刷新后回显: ' + JSON.stringify(after))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-clear-save-20261106/round-23.png' })
