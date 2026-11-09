// round-03 — 批量排产弹窗里把第 1 道「计划完工日期」改到早于「计划开工日期」(2026-11-09 → 2026-11-03)
// 期望:提示「计划开工日期不能晚于计划完工日期…」,并把该道开工日自动调到 11-03,链上后续道跟着前移;不提交。
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')

const before = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  if (!dlg) return null
  const t0 = dlg.querySelector('.el-table')
  return [...t0.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => ({
    op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
    vals: [...tr.querySelectorAll('input')].slice(1).map((i) => i.value),
  }))
})
console.log('before=' + JSON.stringify(before))

// 第 1 道的「计划完工日期」输入框(每行 inputs: [生产线下拉, 开工, 完工])
const focusInfo = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
  const inputs = [...tr.querySelectorAll('input')]
  const due = inputs[2]
  due.focus()
  due.click()
  return { count: inputs.length, value: due.value, placeholder: due.placeholder }
})
console.log('focus=' + JSON.stringify(focusInfo))
await page.waitForTimeout(600)

await page.keyboard.press('Control+A')
await page.keyboard.type('2026-11-03')
await page.waitForTimeout(300)
await page.keyboard.press('Enter')
await page.waitForTimeout(1000)

const after = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const t0 = dlg.querySelector('.el-table')
  const rows = [...t0.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => ({
    op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
    vals: [...tr.querySelectorAll('input')].slice(1).map((i) => i.value),
  }))
  const msgs = [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim())
  return { rows, msgs }
})
console.log('after=' + JSON.stringify(after, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-03-due-earlier-than-start.png', fullPage: false })
console.log('shot round-03-due-earlier-than-start.png')
