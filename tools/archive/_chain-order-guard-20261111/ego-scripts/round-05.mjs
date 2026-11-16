// round-05 — 多语言:切 en 后同样的「下方工序早于上方工序」提示必须是英文整句;结束后切回 zh-CN
const OUT = 'D:/workspace/yinjia/tools/archive/_chain-order-guard-20261111/ego-shots'
const task = await taskSpace('chain-order-guard-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(1500)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(500)
await page.evaluate(() => {
  const t0 = document.querySelectorAll('.el-table')[0]
  const rows = [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  rows[0]?.querySelector('.el-checkbox')?.click()
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => !b.closest('.el-dialog'))
  btns.find((b) => /^(Schedule|排产)$/.test((b.textContent || '').trim()))?.click()
})
const dump = () => page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const t0 = dlg?.querySelector('.el-table')
  return {
    title: (dlg?.querySelector('.el-dialog__title')?.textContent || '').trim(),
    rows: [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])].map((tr) => ({
      op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
      vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
    })),
    msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
let d = { rows: [] }
for (let i = 0; i < 20; i++) { await page.waitForTimeout(500); d = await dump(); if (d.rows.length) break }
console.log('opened=' + JSON.stringify(d))
async function setDate(rowIndex, inputIndex, text) {
  await page.evaluate(([ri, ii]) => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null).pop()
    const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[ri]
    const inputs = [...tr.querySelectorAll('input')]
    inputs[ii].focus()
    inputs[ii].click()
  }, [rowIndex, inputIndex])
  await page.waitForTimeout(500)
  await page.keyboard.press('Control+A')
  await page.keyboard.type(text)
  await page.waitForTimeout(250)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
}
await setDate(0, 2, '2026-11-13')
await setDate(1, 1, '2026-11-01')
const after = await dump()
console.log('afterEn=' + JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-05-en-chain-order.png', fullPage: false })
console.log('shot round-05-en-chain-order.png')
await page.keyboard.press('Escape').catch(() => {})
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
