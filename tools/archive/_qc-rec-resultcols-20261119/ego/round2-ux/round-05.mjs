// round-05:8090(正式账套,YINJIA-MES)复核新入口是否已上身
const task = await taskSpace('qc-insp-rec-resultcols-ux-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)

const st = await page.evaluate(() => {
  const addcol = document.querySelector('.c-result .qr-addcol')
  const badge = document.querySelector('.c-result .c-result-count')
  return {
    entryChunk: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter((s) => /index-[A-Za-z0-9_-]+\.js/.test(s))[0] || null,
    ledger: (document.body.innerText.match(/YINJIA-MES[^\s]*/) || [])[0] || '',
    n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
    stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
    headerAddBtn: addcol ? (addcol.textContent || '').trim() : null,
    countBadge: badge ? (badge.textContent || '').trim() : null,
    addbarBtns: [...document.querySelectorAll('.qr-addbar .qr-add')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
    delBtns: document.querySelectorAll('.c-res-del').length,
  }
})
console.log('state ' + JSON.stringify(st))

// 点表头「＋ 新增列」一次(不保存)
await page.click('.c-result .qr-addcol', { label: '表头新增列' })
await page.waitForTimeout(700)
const after = await page.evaluate(() => ({
  n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
  headerCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
}))
console.log('after-add ' + JSON.stringify(after))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-05-8090.png' })

// 丢弃
await page.reload({ timeout: 40000 })
await page.waitForTimeout(5000)
const back = await page.evaluate(() => document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length)
console.log('after-reload n=' + back)
