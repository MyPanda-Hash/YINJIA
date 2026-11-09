// round-11 — 最终证据(中文):批量排产弹窗把第 1 道完工改到早于开工 → 提示 + 开工自动下调;不提交。
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const t0 = document.querySelectorAll('.el-table')[0]
  const rows = [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  rows[0]?.querySelector('.el-checkbox')?.click()
  rows[1]?.querySelector('.el-checkbox')?.click()
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('批量排产'))
  if (btn) btn.click()
})
let steps = []
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500)
  steps = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
    const t0 = dlg?.querySelector('.el-table')
    return [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])].map((tr) => ({
      op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
      vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
    }))
  })
  if (steps.length) break
}
console.log('before=' + JSON.stringify(steps))
if (!steps.length) process.exit(1)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
  const inputs = [...tr.querySelectorAll('input')]
  inputs[2].focus()
  inputs[2].click()
})
await page.waitForTimeout(600)
await page.keyboard.press('Control+A')
await page.keyboard.type('2026-11-03')
await page.waitForTimeout(300)
await page.keyboard.press('Enter')
await page.waitForTimeout(1200)
const after = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const t0 = dlg.querySelector('.el-table')
  return {
    rows: [...t0.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => ({
      op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
      vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
    })),
    msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('after=' + JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-11-final-zh.png', fullPage: false })
console.log('shot round-11-final-zh.png')
await page.keyboard.press('Escape').catch(() => {})
