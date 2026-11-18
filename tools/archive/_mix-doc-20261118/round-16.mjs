/**
 * round-16:读 vite 错误浮层的文字(round-15 被它挡住了点击)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(3500)
const overlay = await page.evaluate(() => {
  const el = document.querySelector('vite-error-overlay')
  if (!el) return { present: false }
  const shadow = el.shadowRoot ? el.shadowRoot.innerText : el.innerText
  return { present: true, text: (shadow || '').replace(/\s+/g, ' ').slice(0, 600) }
})
console.log(JSON.stringify(overlay, null, 2))
