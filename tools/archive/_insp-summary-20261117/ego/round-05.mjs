// round-05:导出 Excel 内容级取证(拦截 blob + 用 xlsx 解析 sheet/行数/合计,不依赖浏览器下载目录)
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)

const captured = await page.evaluate(async () => {
  window.__xlsxBlob = null
  window.__xlsxName = ''
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) {
    try { window.__xlsxBlob = blob } catch (e) { /* ignore */ }
    return origCreate.call(URL, blob)
  }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__xlsxName = this.download; return }
    return origClick.call(this)
  }
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('导出 Excel'))
  if (!btn) return { error: 'no export button' }
  btn.click()
  for (let i = 0; i < 40 && !window.__xlsxBlob; i++) await new Promise((r) => setTimeout(r, 200))
  if (!window.__xlsxBlob) return { error: 'no blob captured', name: window.__xlsxName }
  const ab = await window.__xlsxBlob.arrayBuffer()
  const bytes = new Uint8Array(ab)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return { name: window.__xlsxName, size: bytes.length, b64: btoa(s) }
})
console.log('CAPTURE', JSON.stringify({ name: captured.name, size: captured.size, error: captured.error }))

if (captured.b64) {
  const XLSX = await import('file:///D:/workspace/yinjia/frontend/node_modules/xlsx/xlsx.mjs')
  const wb = XLSX.read(Buffer.from(captured.b64, 'base64'), { type: 'buffer' })
  const info = wb.SheetNames.map((n) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })
    return {
      sheet: n,
      rows: rows.length,
      title: rows[0]?.[0] || '',
      header: rows[2] || [],
      firstData: rows[3] || [],
      last: rows[rows.length - 1] || [],
    }
  })
  console.log('WORKBOOK', JSON.stringify(info, null, 2))
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/11-8090-export.png` })
await task.finish({ keep: [] })
