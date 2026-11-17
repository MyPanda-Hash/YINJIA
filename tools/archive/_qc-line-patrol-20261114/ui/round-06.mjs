// round-06 — 巡线检验(QC_LINE_PATROL):侧栏「打印」不空白 + 「导出报表 → 打印预览」出新窗口 PDF
//            (Lead 2026-11-14 补充口径;SHEET_PREVIEW_PANELS 已加 QC_LINE_PATROL)
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-06.mjs')"
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

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()

// ① 「打印」按钮:不打真的打印对话框(会占住浏览器),先把 window.print 换成探针,
//    再**真点**侧栏「打印」(trusted click),然后模拟 print 媒体量 computed 样式。
const stub = await page.evaluate(() => {
  window.__printCalled = false
  window.__origPrint = window.print
  window.print = () => { window.__printCalled = true }
  const btns = [...document.querySelectorAll('.as-side-btn')]
  const b = btns.find((e) => (e.textContent || '').trim() === '打印')
  if (!b) return { ok: false, btns: btns.map((x) => (x.textContent || '').trim()) }
  b.id = 'lp-print-btn'
  return { ok: true }
})
console.log('PRINT_BTN=' + JSON.stringify(stub))
if (stub.ok) {
  await page.click('#lp-print-btn')
  await page.waitForTimeout(1500)
}
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(300)
const printState = await page.evaluate(() => {
  const el = document.querySelector('.lp-sheet')
  const cs = el ? getComputedStyle(el) : null
  const td = document.querySelector('.lp-grid td')
  const op = document.querySelector('.lp-op')
  return {
    printCalled: window.__printCalled === true,
    bodyClass: document.body.className.includes('approval-printing'),
    printZoom: getComputedStyle(document.documentElement).getPropertyValue('--print-zoom').trim(),
    sheetVisibility: cs?.visibility,
    sheetPosition: cs?.position,
    sheetBorderTop: cs?.borderTopWidth,
    sheetBox: el ? { w: el.offsetWidth, scrollW: el.scrollWidth } : null,
    gridFontSize: td ? getComputedStyle(td).fontSize : '',
    opDisplay: op ? getComputedStyle(op).display : '(无)',
  }
})
console.log('PRINT_STATE=' + JSON.stringify(printState))
await page.screenshot({ path: out + '/round-06-01-print-mode.png' })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
// 收尾:撤掉 approval-printing 与探针(与 printApprovalSheet 的 restore 同口径)
await page.evaluate(() => {
  document.body.classList.remove('approval-printing')
  document.documentElement.style.removeProperty('--print-zoom')
  if (window.__origPrint) window.print = window.__origPrint
})

// ② 「导出报表 → 打印预览」:应新开一个标签页,里面是**这张纸**的 PDF(不是服务端字段流水报表)
const beforeTabs = (await task.tabs()).length
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.as-side-btn')]
  const b = btns.find((e) => (e.textContent || '').trim() === '导出报表')
  if (b) b.id = 'lp-report-btn'
})
await page.click('#lp-report-btn')
await page.waitForTimeout(1500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return {
    title: (d?.querySelector('.el-dialog__title')?.textContent || '').trim(),
    items: [...(d?.querySelectorAll('.efmt-item') || [])].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('REPORT_DIALOG=' + JSON.stringify(dlg))
// 打印预览 = 第 2 项(真点,保证 window.open 有用户手势)
await page.click('.el-dialog .efmt-list .efmt-item:nth-child(2)')
await page.waitForTimeout(12000)
const afterTabs = await task.tabs()
console.log('TABS=' + JSON.stringify(afterTabs.map((t) => ({ label: t.label || null, url: String(t.url || '').slice(0, 80), active: t.active, openedBy: t.openedBy }))))
const previewTab = afterTabs.find((t) => String(t.url || '').startsWith('blob:'))
let pdfInfo = null
if (previewTab) {
  const p2 = previewTab.label ? task.page(previewTab.label) : await task.adopt(previewTab.page)
  await p2.waitForTimeout(1500)
  try {
    const w = await p2.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { /* ignore */ }
  await p2.screenshot({ path: out + '/round-06-02-preview-pdf.png' })
  pdfInfo = await p2.evaluate(async () => {
    const url = location.href
    try {
      const r = await fetch(url)
      const buf = new Uint8Array(await r.arrayBuffer())
      const magic = String.fromCharCode(...buf.slice(0, 5))
      return { url: url.slice(0, 60), bytes: buf.length, magic, isPdf: magic === '%PDF-' }
    } catch (e) {
      return { url: url.slice(0, 60), error: String(e && e.message) }
    }
  })
  console.log('PREVIEW_PDF=' + JSON.stringify(pdfInfo))
  console.log('PREVIEW_PAGE_TITLE=' + JSON.stringify(await p2.title()))
  if (previewTab.label) { try { await p2.close() } catch (e) { /* ignore */ } }
}
console.log('PREVIEW_RESULT=' + JSON.stringify({ beforeTabs, afterTabs: afterTabs.length, newBlobTab: !!previewTab }))
console.log('DONE')
