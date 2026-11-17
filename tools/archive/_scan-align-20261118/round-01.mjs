const task = await taskSpace('scan-align-20261118')
const page = task.page('p1')
const shots = 'C:/Users/Lenovo/ego/scan-align-20261118/'
const out = {}

// ① 生产领料:扫「工单码」(三段,不带 @A/@M)⇒ 应弹窗选 组装/混料
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.fill('input[placeholder*="扫工单号"]', '0@GD-2026-11-0010@1003')
await page.waitForTimeout(300)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '打开单据')
  if (b) b.click()
})
await page.waitForTimeout(3500)
out.pickDialog = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  return {
    hasDialog: !!dlg,
    title: dlg ? (dlg.querySelector('.el-dialog__title')?.textContent || '').trim() : '',
    items: [...document.querySelectorAll('.pk-item')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()),
  }
})
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: shots + 'pick-kind-dialog.png' })

// ② 生产领料:扫「领料单纸面码」(带 @M)⇒ 应**直接**跳混料单、不弹窗
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.fill('input[placeholder*="扫工单号"]', '0@GD-2026-11-0010@1003@M')
await page.waitForTimeout(300)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '打开单据')
  if (b) b.click()
})
await page.waitForTimeout(4000)
out.pickDirect = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))

// ③ 生产退料:新版面 + 扫领料单码(带 @A)⇒ 直接选中那张并可退料
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(4000)
out.returnLayout = await page.evaluate(() => ({
  top: (document.querySelector('.mr-top')?.innerText || '').replace(/\s+/g, ' ').trim(),
  hasQueryInput: !!document.querySelector('input[placeholder*="领料单号"]'),
  hasLocateInput: !!document.querySelector('input[placeholder*="扫领料单码"]'),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12).slice(0, 12),
  focusPh: document.activeElement ? document.activeElement.placeholder || '' : '',
}))
await page.screenshot({ path: shots + 'return-page.png' })

await page.fill('input[placeholder*="扫领料单码"]', '0@GD-2026-11-0010@1003@A')
await page.waitForTimeout(300)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '打开单据')
  if (b) b.click()
})
await page.waitForTimeout(4500)
out.returnAfterScan = await page.evaluate(() => ({
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 420),
  workArea: !!document.querySelector('.mr-lines'),
}))
await page.screenshot({ path: shots + 'return-selected.png' })

console.log(JSON.stringify(out, null, 2))
