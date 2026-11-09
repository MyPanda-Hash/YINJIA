// round-02 — 快速排产页勾 2 行 → 点「批量排产」→ 打开弹窗并 dump 每道工序的日期值(只读,不提交)
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
if (!(await page.url()).includes('scheduleBoard')) {
  await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 30000 })
  await page.waitForTimeout(4000)
}

const picked = await page.evaluate(() => {
  const tables = [...document.querySelectorAll('.el-table')]
  const pool = tables[0]
  const rows = [...pool.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const hit = []
  for (let i = 0; i < Math.min(2, rows.length); i++) {
    const cb = rows[i].querySelector('.el-checkbox')
    if (cb) { cb.click(); hit.push(i) }
  }
  return { poolRows: rows.length, clicked: hit }
})
console.log('picked=' + JSON.stringify(picked))
await page.waitForTimeout(800)

const opened = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('批量排产'))
  if (!btn) return { clicked: false, reason: 'no 批量排产 button' }
  btn.click()
  return { clicked: true, text: (btn.textContent || '').trim() }
})
console.log('open=' + JSON.stringify(opened))
await page.waitForTimeout(3500)

const dump = await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const dlg = dlgs[dlgs.length - 1]
  if (!dlg) return { dialog: false }
  const tables = [...dlg.querySelectorAll('.el-table')]
  const steps = []
  const t0 = tables[0]
  if (t0) {
    for (const tr of [...t0.querySelectorAll('.el-table__body-wrapper tbody tr')]) {
      const tds = [...tr.querySelectorAll('td')]
      const inputs = [...tr.querySelectorAll('input')].map((i) => i.value)
      const texts = tds.map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())
      steps.push({ texts, inputs })
    }
  }
  const msgs = [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim())
  return {
    dialog: true,
    title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
    stepRows: steps,
    messages: msgs,
    dateInputs: [...dlg.querySelectorAll('input')].filter((i) => (i.placeholder || '').includes('日期') || i.value.match(/^\d{4}-\d{2}-\d{2}$/)).map((i) => i.value),
  }
})
console.log(JSON.stringify(dump, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-02-batch-dialog.png', fullPage: false })
console.log('shot round-02-batch-dialog.png')
