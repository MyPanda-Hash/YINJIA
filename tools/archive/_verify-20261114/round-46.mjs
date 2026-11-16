// round-46 — 直接走 CDP Page.captureScreenshot(绕开 ego 封装的重试等待)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114-r11'))
const task = entry && entry.ownership !== 'agent' ? await takeOverTaskSpace(entry.id) : await taskSpace(entry.id || 'verify-20261114-r11')
const page = (await task.pages())[0]

async function cdpShot(p, path) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(500)
  } catch (e) {}
  try {
    const r = await p.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    if (r && r.data) {
      await fs.writeFile(path, Buffer.from(r.data, 'base64'))
      console.log('CDP_SHOT_OK=' + path + ' bytes=' + Buffer.from(r.data, 'base64').length)
      return true
    }
    console.log('CDP_SHOT_EMPTY=' + path)
  } catch (e) { console.log('CDP_SHOT_ERR=' + path + ' :: ' + String(e && e.message).slice(0, 150)) }
  return false
}

// ① 服务端报表 PDF 页
try {
  await page.goto('file:///C:/Users/vigna/ego/verify-20261114/r11-report-server.pdf', { timeout: 40000 })
  await page.waitForTimeout(5000)
  await cdpShot(page, OUT + '/r11-server-report.png')
} catch (e) { console.log('PDF_PAGE_ERR=' + String(e && e.message).slice(0, 120)) }

// ② 5173 纸面:新 page,打开后尽早截
let p2 = null
try { p2 = await task.newPage() } catch (e) { p2 = page }
try {
  await p2.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 60000 })
  await p2.waitForTimeout(6000)
  await p2.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0010'))
    if (tr) tr.click()
  })
  await p2.waitForTimeout(3500)
  await cdpShot(p2, OUT + '/r11-dom-5173.png')
} catch (e) { console.log('P2_ERR=' + String(e && e.message).slice(0, 150)) }
try { if (p2 && p2 !== page) await p2.close() } catch (e) {}
const ls = (await fs.readdir(OUT)).filter((f) => f.startsWith('r11-'))
console.log('FILES=' + JSON.stringify(ls))
console.log('DONE round-46')
