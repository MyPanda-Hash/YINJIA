// round-02:恢复窗口 + 等待页面数据,诊断当前 DOM(只读)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    console.log('window restored')
  }
} catch (e) { console.log('restore skip: ' + e.message) }

await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const classes = [...new Set([...document.querySelectorAll('div,section,header,main')]
    .map((el) => el.className).filter((c) => typeof c === 'string' && c.trim() && !c.includes(' ')).slice(0, 60))]
  return {
    hash: location.hash,
    bodyText: txt(document.body).slice(0, 600),
    buttons: [...document.querySelectorAll('button')].map(txt).slice(0, 40),
    elementCount: document.querySelectorAll('*').length,
    classes,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-02-dump.png' })
