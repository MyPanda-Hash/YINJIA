// round-03:验证「最近出纸」里的失败行会不会显示 单号 + 失败原因(5173 源码版 vs 8090 打包版)
const task = await taskSpace('other-pick-print-20261118')

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await p.waitForTimeout(400)
  } catch (e) {
    console.log('restore skip: ' + e.message)
  }
}

const readState = () => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    recent: [...document.querySelectorAll('.ps-recent')].map(txt),
    why: [...document.querySelectorAll('.ps-line-why')].map(txt),
  }
}

const p1 = task.page('p1')
await p1.goto('http://localhost:5173/#/sys/printStation', { timeout: 60000 })
await p1.waitForTimeout(4000)
await restoreWindow(p1)
console.log('--- 5173')
console.log(JSON.stringify(await p1.evaluate(readState), null, 2))
await p1.screenshot({ path: 'C:/Users/Lenovo/ego/other-pick-print-20261118/recent-fail-5173.png', fullPage: true })

const pages = await task.pages()
const p2 = pages.find((p) => p.label !== 'p1') || (await task.newPage())
await p2.goto('http://127.0.0.1:8090/#/sys/printStation', { timeout: 60000 })
await p2.waitForTimeout(5000)
await restoreWindow(p2)
console.log('--- 8090')
console.log(JSON.stringify(await p2.evaluate(readState), null, 2))
await p2.screenshot({ path: 'C:/Users/Lenovo/ego/other-pick-print-20261118/recent-fail-8090.png', fullPage: true })
console.log('done')
