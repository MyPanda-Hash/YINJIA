// round-13 — 取上一轮(测试库那轮)打开的「打印预览」blob PDF 标签页:验字节/截图(再关掉)
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-13.mjs')"
const out = 'C:/Users/vigna/ego/qc-line-patrol-20261114'
const task = await taskSpace('qc-line-patrol-20261114')
let p = null
for (const t of await task.tabs()) {
  if (t.label && t.label !== 'p1') { p = task.page(t.label); break }
}
if (!p) { console.log('NO_PREVIEW_TAB') } else {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(1500)
  } catch (e) { console.log('restore skip ' + e.message) }
  const info = await p.evaluate(async () => {
    const url = location.href
    try {
      const r = await fetch(url)
      const buf = new Uint8Array(await r.arrayBuffer())
      const head = String.fromCharCode(...buf.slice(0, 8))
      return { url: url.slice(0, 70), bytes: buf.length, head, isPdf: head.startsWith('%PDF-') }
    } catch (e) { return { url: url.slice(0, 70), error: String(e && e.message) } }
  })
  console.log('PREVIEW_INFO=' + JSON.stringify(info))
  try { await p.screenshot({ path: out + '/round-13-01-preview-pdf.png' }) } catch (e) { console.log('shot fail') }
  try { await p.close() } catch (e) { console.log('close fail') }
}
console.log('DONE')
