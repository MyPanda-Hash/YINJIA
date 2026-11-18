// round-06:最终交付态截图(8090 正式实例)——表头＋新增列 / 增行条按钮 / 每列 ×
const task = await taskSpace('qc-insp-rec-resultcols-ux-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)

// 先加一行检验项,好让「结果格」看得见
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.qr-addbar .qr-add')].find((x) => (x.textContent || '').includes('新增检验项'))
  if (b) b.click()
})
await page.waitForTimeout(800)

const st = await page.evaluate(() => ({
  entryChunk: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter((s) => /index-[A-Za-z0-9_-]+\.js/.test(s))[0] || null,
  headerAddBtn: document.querySelector('.c-result .qr-addcol')?.textContent?.trim() ?? null,
  countBadge: document.querySelector('.c-result .c-result-count')?.textContent?.trim() ?? null,
  addbarBtns: [...document.querySelectorAll('.qr-addbar .qr-add')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
  delBtns: document.querySelectorAll('.c-res-del').length,
}))
console.log(JSON.stringify(st))

// 点表头「＋ 新增列」→ 6 列(不保存)
await page.click('.c-result .qr-addcol', { label: '表头新增列' })
await page.waitForTimeout(700)
const n2 = await page.evaluate(() => document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length)
console.log('after-click n=' + n2)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-06-final-8090.png' })

// 不保存:刷新回滚
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
console.log('rolled back n=' + await page.evaluate(() => document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length))
