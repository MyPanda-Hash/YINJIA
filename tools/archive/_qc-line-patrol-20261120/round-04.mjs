const task = await taskSpace('qc-line-patrol-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const clickSide = async (label) => page.evaluate((label) => {
  const el = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === label)
  if (!el) return false
  el.click(); return true
}, label)
const state = async () => page.evaluate(() => ({
  docNo: (document.querySelector('.as-side-btn, .doc-no') ? '' : ''),
  status: [...document.querySelectorAll('.as-state, .as-side-hint, .doc-status')].map((e) => (e.textContent || '').trim()).slice(0, 6),
  headText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 0),
  rows: document.querySelectorAll('.lp-sheet .lp-row').length,
  patrol: (document.querySelector('.lp-sheet td[data-lp="巡线时间"] input') || {}).value || '',
  auditor: [...document.querySelectorAll('.lp-head-right .lp-val')].map((e) => (e.textContent || '').trim()),
  msgs: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
}))

console.log('click 新增 =', await clickSide('新增'))
await page.waitForTimeout(2200)
await page.evaluate(() => { const el = document.querySelector('.lp-sheet .lp-addblock'); el && el.click() })
await page.waitForTimeout(800)
// 填几格:车间 + 编号
await page.evaluate(() => {
  const set = (td, v) => { const i = td && td.querySelector('input'); if (!i) return
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })) }
  set(document.querySelector('.lp-sheet td[data-lp="车间"]'), '成型一车间')
  set(document.querySelector('.lp-sheet td[data-lp="编号1"]'), 'TEST-20261120')
})
await page.waitForTimeout(600)
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/04-filled-new.png' })
console.log('before save: ' + JSON.stringify(await state()))

console.log('click 保存 =', await clickSide('保存'))
await page.waitForTimeout(4000)
console.log('after save: ' + JSON.stringify(await state()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/04-saved.png' })
await task.finish({ keep: [] })
