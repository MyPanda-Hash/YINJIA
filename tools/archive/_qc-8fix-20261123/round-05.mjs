// round-05: 点新增后看页面/弹窗状态
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(6000)
const clickText = async (sel, text) => {
  const ok = await page.evaluate(({ sel, text }) => {
    const el = [...document.querySelectorAll(sel)].find((x) => (x.innerText || '').replace(/\s+/g, '').includes(text))
    if (el) { el.click(); return true }
    return false
  }, { sel, text })
  console.log('click', sel, text, ok)
  await page.waitForTimeout(1500)
}
await clickText('.as-side-btn', '新增')
await page.waitForTimeout(2500)
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  band: (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim(),
  docNo: (document.querySelector('.qr-paper-head')?.innerText || '').replace(/\s+/g, ' ').trim(),
  dialogs: [...document.querySelectorAll('.el-dialog, .el-message-box')].map((d) => (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200)),
  tags: [...document.querySelectorAll('.el-tag')].map((x) => (x.innerText || '').trim()).slice(0, 12),
  msgs: [...document.querySelectorAll('.el-message')].map((x) => (x.innerText || '').trim()),
  right: (document.querySelector('.as-side-btns')?.innerText || '').replace(/\s+/g, ' ').trim(),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-05-after-new.png' })
