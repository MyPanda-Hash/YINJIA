// round-07 — 反向验证:批量排产弹窗里把第 1 道「计划开工日期」改到晚于「计划完工日期」
// 期望:提示「…已自动把完工日期调为 …」,完工日被推到开工日,链上后续道跟着后移;不提交。
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(4500)

// 勾 2 行 → 打开批量排产
await page.evaluate(() => {
  const tables = [...document.querySelectorAll('.el-table')]
  const rows = [...(tables[0]?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  for (let i = 0; i < Math.min(2, rows.length); i++) rows[i].querySelector('.el-checkbox')?.click()
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('批量排产'))
  btn?.click()
})
await page.waitForTimeout(3500)

const before = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const rows = [...dlg.querySelectorAll('.el-table')[0].querySelectorAll('.el-table__body-wrapper tbody tr')]
  return rows.map((tr) => ({ op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(), vals: [...tr.querySelectorAll('input')].slice(1).map((i) => i.value) }))
})
console.log('before=' + JSON.stringify(before))

// 改第 1 道「计划开工日期」= 2026-12-01(晚于当时的完工日)
const focus = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
  const inputs = [...tr.querySelectorAll('input')]
  inputs[1].focus()
  inputs[1].click()
  return { startValue: inputs[1].value, dueValue: inputs[2].value }
})
console.log('focus=' + JSON.stringify(focus))
await page.waitForTimeout(600)
await page.keyboard.press('Control+A')
await page.keyboard.type('2026-12-01')
await page.waitForTimeout(300)
await page.keyboard.press('Enter')
await page.waitForTimeout(1000)

const after = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const rows = [...dlg.querySelectorAll('.el-table')[0].querySelectorAll('.el-table__body-wrapper tbody tr')]
  const msgs = [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    rows: rows.map((tr) => ({ op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(), vals: [...tr.querySelectorAll('input')].slice(1).map((i) => i.value) })),
    msgs,
  }
})
console.log('after=' + JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-07-start-later-than-due.png', fullPage: false })
console.log('shot round-07-start-later-than-due.png')
