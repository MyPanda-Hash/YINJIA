// round-09 — 取上一轮打开的「打印预览」标签页(p3,blob PDF):验 URL / PDF 字节 / 截图
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-09.mjs')"
const out = 'C:/Users/vigna/ego/qc-line-patrol-20261114'
const task = await taskSpace('qc-line-patrol-20261114')
const pages = await task.pages()
console.log('PAGES=' + JSON.stringify(pages.map((p) => p.label)))
console.log('TABS=' + JSON.stringify((await task.tabs()).map((t) => ({ label: t.label || null, url: String(t.url || '').slice(0, 80), active: t.active, openedBy: t.openedBy }))))

let p = null
for (const t of await task.tabs()) {
  if (t.label && t.label !== 'p1') { p = task.page(t.label); break }
}
if (!p) { console.log('NO_PREVIEW_TAB'); }
else {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(1200)
  } catch (e) { console.log('restore skip ' + e.message) }
  const info = await p.evaluate(async () => {
    const url = location.href
    const base = { url: url.slice(0, 70), href0: String(url).slice(0, 20) }
    try {
      const r = await fetch(url)
      const buf = new Uint8Array(await r.arrayBuffer())
      return { ...base, bytes: buf.length, head: String.fromCharCode(...buf.slice(0, 8)), isPdf: String.fromCharCode(...buf.slice(0, 5)) === '%PDF-' }
    } catch (e) { return { ...base, error: String(e && e.message) } }
  })
  console.log('PREVIEW_INFO=' + JSON.stringify(info))
  console.log('PREVIEW_TITLE=' + JSON.stringify(await p.title()))
  try { await p.screenshot({ path: out + '/round-09-01-preview-pdf.png' }) } catch (e) { console.log('shot fail ' + e.message) }
  try { await p.close() } catch (e) { console.log('close fail ' + e.message) }
}
console.log('DONE')
