// round-15:8090 打包版(prod 账套)复核 —— 新前端已随 jar 里的 static 下发;只读检查步进器与列数,不做写入
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(6000)

const st = await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
  entryChunk: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter((s) => /index-[A-Za-z0-9_-]+\.js/.test(s))[0] || null,
  stepper: document.querySelector('.qr-colstep') ? (document.querySelector('.qr-colstep').textContent || '').replace(/\s+/g, ' ').trim() : null,
  headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
  docNo: (() => {
    const m = (document.body.innerText || '').match(/JYSJ-\d{4}-\d{2}-\d{4}/)
    return m ? m[0] : null
  })(),
  status: (() => {
    const m = (document.body.innerText || '').match(/(草稿|已审核|审批中|已归档|修改中)/)
    return m ? m[1] : null
  })(),
}))
console.log(JSON.stringify(st, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-15-8090.png' })
