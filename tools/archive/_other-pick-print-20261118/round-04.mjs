// round-04:8090 上强制 reload(只在 hash 内跳转不会重新拿 chunk,上一轮读到的是内存里的旧版)
const task = await taskSpace('other-pick-print-20261118')
const pages = await task.pages()
const p2 = pages.find((p) => p.label !== 'p1') || (await task.newPage())
try {
  const w = await p2.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

await p2.goto('http://127.0.0.1:8090/#/sys/printStation?t=' + Date.now(), { timeout: 60000 })
await p2.reload({ timeout: 60000 })
await p2.waitForTimeout(6000)
const data = await p2.evaluate(() => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    recent: [...document.querySelectorAll('.ps-recent')].map(txt),
    why: [...document.querySelectorAll('.ps-line-why')].map(txt),
    chunks: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => s.includes('index-')),
  }
})
console.log(JSON.stringify(data, null, 2))
await p2.screenshot({ path: 'C:/Users/Lenovo/ego/other-pick-print-20261118/recent-fail-8090-reload.png', fullPage: true })
console.log('done')
