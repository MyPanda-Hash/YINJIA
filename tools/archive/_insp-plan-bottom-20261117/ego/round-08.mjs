// round-08:点「查询单据」,看单据清单(编号/状态),挑一张可编辑的打开
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(5000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '查询单据')
  if (btn) btn.click()
})
await page.waitForTimeout(3000)
console.log(JSON.stringify(await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  return {
    dialogs: dlgs.map((d) => ({ title: (d.querySelector('.el-dialog__title') || {}).textContent, text: (d.textContent || '').replace(/\s+/g, ' ').slice(0, 500) })),
    tables: [...document.querySelectorAll('.el-dialog table')].map((t) => ({
      head: [...t.querySelectorAll('th')].map((e) => (e.textContent || '').trim()),
      rows: [...t.querySelectorAll('tbody tr')].slice(0, 12).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())),
    })),
  }
}), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-08.png' })
