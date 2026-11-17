// round-04 — 批量排产弹窗:改下方工序开工到早于上方完工 ⇒ 夹回 + 提示(不提交)
const OUT = 'D:/workspace/yinjia/tools/archive/_chain-order-guard-20261111/ego-shots'
const task = await taskSpace('chain-order-guard-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(500)

const picked = await page.evaluate(() => {
  const t0 = document.querySelectorAll('.el-table')[0]
  const rows = [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  rows[0]?.querySelector('.el-checkbox')?.click()
  rows[1]?.querySelector('.el-checkbox')?.click()
  return { poolRows: rows.length }
})
console.log('picked=' + JSON.stringify(picked))
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('批量排产'))
  if (btn) btn.click()
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

await setDate(0, 2, '2026-11-13')    // 上方完工 11-13
await setDate(1, 1, '2026-11-01')    // 下方开工改到 11-01
const after = await dump()
console.log('after=' + JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-04-batch-chain-order.png', fullPage: false })
console.log('shot round-04-batch-chain-order.png')
await page.keyboard.press('Escape').catch(() => {})
