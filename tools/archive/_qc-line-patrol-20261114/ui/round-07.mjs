// round-07 — 巡线检验(QC_LINE_PATROL):「导出报表 → 打印预览」出新窗口 PDF(坐标真点,避开浮层遮挡)
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-07.mjs')"
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
/** 给按钮打 id + 滚动进视口 + 返回中心坐标与遮挡元素 */
const locate = (texts) => {
  const btns = [...document.querySelectorAll('.as-side-btn')]
  const b = btns.find((e) => texts.includes((e.textContent || '').trim()))
  if (!b) return { ok: false, btns: btns.map((x) => (x.textContent || '').trim()) }
  b.id = 'lp-target'
  b.scrollIntoView({ block: 'center' })
  const r = b.getBoundingClientRect()
  const cx = Math.round(r.left + r.width / 2)
  const cy = Math.round(r.top + r.height / 2)
  const hit = document.elementFromPoint(cx, cy)
  return {
    ok: true, cx, cy,
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    hitClass: hit ? `${hit.tagName}.${hit.className || ''}`.slice(0, 120) : null,
    isSelf: hit ? (hit.id === 'lp-target' || b.contains(hit)) : false,
  }
}

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()

const beforeTabs = (await task.tabs()).length
const loc = await page.evaluate(locate, ['导出报表'])
console.log('LOCATE_REPORT=' + JSON.stringify(loc))
await page.mouse.click(loc.cx, loc.cy)
await page.waitForTimeout(2000)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return {
    visible: !!d,
    title: (d?.querySelector('.el-dialog__title')?.textContent || '').trim(),
    items: [...(d?.querySelectorAll('.efmt-item') || [])].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('REPORT_DIALOG=' + JSON.stringify(dlg))

// 点「打印预览」(第 2 项):先定位坐标再真点(用户手势 ⇒ window.open 不会被拦)
const itemLoc = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const items = [...(d?.querySelectorAll('.efmt-item') || [])]
  const it = items[1]
  if (!it) return { ok: false }
  const r = it.getBoundingClientRect()
  const cx = Math.round(r.left + r.width / 2)
  const cy = Math.round(r.top + r.height / 2)
  const hit = document.elementFromPoint(cx, cy)
  return { ok: true, cx, cy, isSelf: hit ? it.contains(hit) : false, hitClass: hit ? `${hit.tagName}.${hit.className || ''}`.slice(0, 100) : null }
})
console.log('LOCATE_PREVIEW=' + JSON.stringify(itemLoc))
await page.mouse.click(itemLoc.cx, itemLoc.cy)
// 生成 PDF(截图 + jsPDF)要几秒
await page.waitForTimeout(15000)
const afterTabs = await task.tabs()
console.log('TABS=' + JSON.stringify(afterTabs.map((t) => ({ label: t.label || null, url: String(t.url || '').slice(0, 70), active: t.active, openedBy: t.openedBy }))))
const previewTab = afterTabs.find((t) => String(t.url || '').startsWith('blob:'))
let pdfInfo = null
if (previewTab) {
  const p2 = previewTab.label ? task.page(previewTab.label) : await task.adopt(previewTab.page)
  await p2.waitForTimeout(2000)
  try {
    const w = await p2.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p2.waitForTimeout(600)
  } catch (e) { /* ignore */ }
  await p2.screenshot({ path: out + '/round-07-01-preview-pdf.png' })
  pdfInfo = await p2.evaluate(async () => {
    const url = location.href
    try {
      const r = await fetch(url)
      const buf = new Uint8Array(await r.arrayBuffer())
      const magic = String.fromCharCode(...buf.slice(0, 5))
      return { url: url.slice(0, 60), bytes: buf.length, magic, isPdf: magic === '%PDF-' }
    } catch (e) { return { url: url.slice(0, 60), error: String(e && e.message) } }
  })
  console.log('PREVIEW_PDF=' + JSON.stringify(pdfInfo))
  console.log('PREVIEW_TITLE=' + JSON.stringify(await p2.title()))
  if (previewTab.label) { try { await p2.close() } catch (e) { /* ignore */ } }
}
console.log('PREVIEW_RESULT=' + JSON.stringify({ beforeTabs, afterTabs: afterTabs.length, newBlobTab: !!previewTab }))
await page.screenshot({ path: out + '/round-07-02-report-dialog.png' })
console.log('DONE')
