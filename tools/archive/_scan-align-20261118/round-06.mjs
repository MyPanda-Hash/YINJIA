const task = await taskSpace('scan-align-20261118')
const page = task.page('p1')
const shots = 'C:/Users/Lenovo/ego/scan-align-20261118/'
const out = {}

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }

// 点「选这张退料」→ 弹窗
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '选这张退料')
  if (b) b.click()
})
await page.waitForTimeout(2800)
const dlgState = () => page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料') && d.offsetParent !== null)
  return {
    title: dlg ? (dlg.querySelector('.el-dialog__title')?.textContent || '').trim() : '',
    text: dlg ? (dlg.innerText || '').replace(/\s+/g, ' ').slice(0, 300) : '',
    focusPh: document.activeElement ? document.activeElement.placeholder || '' : '',
  }
})
out.dialog = await dlgState()

// 扫本单真实物料码(LL-2026-11-0025 的 PE袋 = YJ-KBL-012)
await page.fill('.el-dialog input[placeholder*="扫物料码"]', 'YJ-KBL-012')
await page.waitForTimeout(300)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料'))
  const b = [...(dlg ? dlg.querySelectorAll('button') : [])].find((x) => (x.textContent || '').trim() === '查询')
  if (b) b.click()
})
await page.waitForTimeout(2500)
out.afterScan = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料') && d.offsetParent !== null)
  return {
    text: dlg ? (dlg.innerText || '').replace(/\s+/g, ' ').slice(0, 360) : '',
    hasQty: !!document.querySelector('.mr-qty'),
    hasErrInside: !!document.querySelector('.mr-err-inside'),
  }
})
await page.screenshot({ path: shots + 'round-06-dialog-scanned.png' })

// 扫一个不在单里的料 → 弹窗内应出现提示(不被遮罩挡)
await page.fill('.el-dialog input[placeholder*="扫物料码"]', 'NOT-IN-DOC')
await page.waitForTimeout(200)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料'))
  const b = [...(dlg ? dlg.querySelectorAll('button') : [])].find((x) => (x.textContent || '').trim() === '查询')
  if (b) b.click()
})
await page.waitForTimeout(2200)
out.afterBad = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.innerText || '').includes('退料') && d.offsetParent !== null)
  return { text: dlg ? (dlg.innerText || '').replace(/\s+/g, ' ').slice(0, 240) : '' }
})
await page.screenshot({ path: shots + 'round-06-dialog-error.png' })

console.log(JSON.stringify(out, null, 2))
