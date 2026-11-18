// round-08:同一套操作打到 8090(打包版)。换包前应停在第一张(复现报障),换包后应正确切换。
const task = await taskSpace('other-pick-print-20261118')
const pages = await task.pages()
const p = pages.find((x) => x.label !== 'p1') || (await task.newPage())
const base = 'http://127.0.0.1:8090'
try {
  const w = await p.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

const readDoc = () => {
  const t = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    title: t(document.querySelector('.mp-title') || document.body),
    code: t(document.querySelectorAll('.mp-kv')[2] || document.body),
    state: t(document.querySelector('.mp-state') || document.body),
  }
}

await p.goto(base + '/#/panelx/list/MOBILE_RETURN/doc?id=861&t=' + Date.now(), { timeout: 60000 })
await p.reload({ timeout: 60000 })
await p.waitForTimeout(6000)
console.log('8090 第一张(id=861 应是 LL-2026-11-0052 混料): ' + JSON.stringify(await p.evaluate(readDoc)))
await p.evaluate(() => { const b = document.querySelector('.mp-back'); if (b) b.click() })
await p.waitForTimeout(2500)
const clicked = await p.evaluate(() => {
  const row = document.querySelector('.mr-doc')
  if (!row) return 'no-row: ' + (document.querySelector('.mr-empty')?.innerText || '')
  const no = (row.querySelector('.mr-doc-no') || {}).innerText || ''
  row.click()
  return (no || '').trim()
})
await p.waitForTimeout(4500)
const after = await p.evaluate(readDoc)
console.log('8090 点了 ' + clicked + ' 之后: ' + JSON.stringify(after))
console.log(after.title === clicked
  ? '=> 正确切换(修复已生效)'
  : '=> 仍停在上一张(修复未生效 / 旧包复现报障)')
await p.screenshot({ path: 'C:/Users/Lenovo/ego/other-pick-print-20261118/return-doc-8090.png', fullPage: true })
