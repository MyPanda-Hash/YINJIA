const task = await taskSpace('pickrow-eval-20261117')
const page = task.page('p1')

// 关掉所有弹窗,刷新拿最新源码(vite 热更)
await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => { if (vis(b)) b.click() })
})
await page.waitForTimeout(600)
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(7000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 打开分批送料
await page.click('span.act-name:text-is("生单")', { label: 'open batch send' })
await page.waitForTimeout(6000)

const state = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const rows = dlg ? [...dlg.querySelectorAll('.el-table__body-wrapper tr.el-table__row')] : []
  return {
    title: dlg ? (dlg.querySelector('.el-dialog__title')?.textContent || '').trim() : null,
    rows: rows.map((tr) => ({
      text: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      checked: !!tr.querySelector('.el-checkbox.is-checked'),
      cls: tr.className,
    })),
    tip: dlg ? [...dlg.querySelectorAll('.bsd-tip')].map((e) => (e.textContent || '').trim()).join(' | ').slice(-80) : '',
  }
})
console.log(JSON.stringify(state, null, 2))
