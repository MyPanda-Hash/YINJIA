// round-08 — 巡线检验(QC_LINE_PATROL):拿到「打印预览」新窗口(blob PDF)并验字节/截图
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-08.mjs')"
const out = 'C:/Users/vigna/ego/qc-line-patrol-20261114'
const task = await taskSpace('qc-line-patrol-20261114')
const page = task.page('p1')

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  return true
}
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip') }
}
/** 找「导出报表」按钮中心坐标(并把遮挡信息带出来) */
const locate = (texts) => {
  const btns = [...document.querySelectorAll('.as-side-btn')]
  const b = btns.find((e) => texts.includes((e.textContent || '').trim()))
  if (!b) return { ok: false, btns: btns.map((x) => (x.textContent || '').trim()) }
  b.scrollIntoView({ block: 'center' })
  const r = b.getBoundingClientRect()
  const cx = Math.round(r.left + r.width / 2)
  const cy = Math.round(r.top + r.height / 2)
  const hit = document.elementFromPoint(cx, cy)
  return { ok: true, cx, cy, isSelf: hit ? b.contains(hit) : false }
}

// 先把上一轮遗留的预览标签页关掉(若还在),避免干扰
for (const t of await task.tabs()) {
  if (String(t.url || '').startsWith('blob:') && t.label) {
    try { await task.page(t.label).close() } catch (e) { /* ignore */ }
  }
}

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()

const before = (await task.tabs()).map((t) => t.label || String(t.url).slice(0, 40))
const loc = await page.evaluate(locate, ['导出报表'])
await page.mouse.click(loc.cx, loc.cy)
await page.waitForTimeout(1800)
const itemLoc = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const it = [...(d?.querySelectorAll('.efmt-item') || [])][1]
  if (!it) return { ok: false }
  const r = it.getBoundingClientRect()
  const cx = Math.round(r.left + r.width / 2)
  const cy = Math.round(r.top + r.height / 2)
  const hit = document.elementFromPoint(cx, cy)
  return { ok: true, cx, cy, isSelf: hit ? it.contains(hit) : false }
})
console.log('LOCATE=' + JSON.stringify({ loc, itemLoc }))
await page.mouse.click(itemLoc.cx, itemLoc.cy)

// 轮询:等新标签页从 about:blank 变成 blob: PDF(生成 PDF 要截图 + jsPDF,几秒到十几秒)
let previewTab = null
let pdfInfo = null
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(2000)
  const tabs = await task.tabs()
  const hit = tabs.find((t) => String(t.url || '').startsWith('blob:') && !before.includes(t.label || ''))
  if (hit) { previewTab = hit; break }
}
console.log('TABS_AFTER=' + JSON.stringify((await task.tabs()).map((t) => ({ label: t.label || null, url: String(t.url || '').slice(0, 60), active: t.active }))))
if (previewTab) {
  const p2 = previewTab.label ? task.page(previewTab.label) : await task.adopt(previewTab.page)
  await p2.waitForTimeout(2500)
  try {
    const w = await p2.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p2.waitForTimeout(800)
  } catch (e) { /* ignore */ }
  try { await p2.screenshot({ path: out + '/round-08-01-preview-window.png' }) } catch (e) { console.log('shot fail ' + e.message) }
  pdfInfo = await p2.evaluate(async () => {
    const url = location.href
    try {
      const r = await fetch(url)
      const buf = new Uint8Array(await r.arrayBuffer())
      const head = String.fromCharCode(...buf.slice(0, 8))
      return { url: url.slice(0, 60), bytes: buf.length, head, isPdf: head.startsWith('%PDF-') }
    } catch (e) { return { url: url.slice(0, 60), error: String(e && e.message) } }
  })
  console.log('PREVIEW_TITLE=' + JSON.stringify(await p2.title()))
  if (previewTab.label) { try { await p2.close() } catch (e) { /* ignore */ } }
}
console.log('PREVIEW_PDF=' + JSON.stringify(pdfInfo))
await page.screenshot({ path: out + '/round-08-02-after-preview.png' })
console.log('DONE')
