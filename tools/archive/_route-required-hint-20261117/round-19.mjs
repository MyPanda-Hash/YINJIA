const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
// 「新增」留下的 fresh-draft 标记会让客户端把这张单当空白草稿渲染(不读库) —— 清掉它
await page.evaluate(() => {
  try { sessionStorage.removeItem('mes_fresh_draft') } catch (e) { /* ignore */ }
})
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

console.log(JSON.stringify(await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  pageNo: (document.querySelector('.page-no')?.textContent || '').trim(),
  heads: [...document.querySelectorAll('.fields .field')].map((f) => ({ c: f.dataset.code, v: f.querySelector('input')?.value ?? '' })).filter((x) => ['工艺路线名称', '生效日期', '失效日期'].includes(x.c)),
  rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-19-loaded.png' })
