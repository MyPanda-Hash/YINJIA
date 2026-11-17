// round-06:导出诊断(按钮状态 / JS 异常 / ESM chunk 加载 / blob)
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(3000)

const pre = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('导出 Excel'))
  window.__errs = []
  window.addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || e.error)))
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('reject: ' + (e.reason?.message || e.reason)))
  window.__xlsxBlob = null
  window.__xlsxName = ''
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) { try { window.__xlsxBlob = blob } catch (e) {} return origCreate.call(URL, blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__xlsxName = this.download; return }
    return origClick.call(this)
  }
  return {
    stats: [...document.querySelectorAll('.iss-stat b')].map((n) => n.textContent.trim()),
    rows: document.querySelectorAll('.iss-table .el-table__body-wrapper tbody tr').length,
    btn: btn ? { text: btn.textContent.replace(/\s+/g, ' ').trim(), disabled: btn.disabled, cls: btn.className } : null,
  }
})
console.log('PRE', JSON.stringify(pre, null, 2))

await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('导出 Excel'))?.click())
await page.waitForTimeout(6000)
const post = await page.evaluate(() => ({
  blob: window.__xlsxBlob ? { size: window.__xlsxBlob.size, type: window.__xlsxBlob.type } : null,
  name: window.__xlsxName,
  errs: window.__errs,
  msg: [...document.querySelectorAll('.el-message')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
  chunk: [...document.querySelectorAll('script')].map((s) => s.src).filter((s) => /xlsx/i.test(s)),
}))
console.log('POST', JSON.stringify(post, null, 2))
await task.finish({ keep: [] })
