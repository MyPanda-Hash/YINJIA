// round-10:XHR 级验证查询按钮 + 捕获 Vue console.error + 导出 blob
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)

await page.evaluate(() => {
  window.__xhr = []
  window.__errs = []
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { try { window.__xhr.push(m + ' ' + u) } catch (e) {} return origOpen.call(this, m, u, ...rest) }
  const origErr = console.error
  console.error = function (...a) { try { window.__errs.push(a.map((x) => String(x && x.stack ? x.stack : x)).join(' ').slice(0, 800)) } catch (e) {} return origErr.apply(this, a) }
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) { window.__xlsxBlob = blob; return origCreate.call(URL, blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__xlsxName = this.download; return }
    return origClick.call(this)
  }
})
const stats = () => page.evaluate(() => [...document.querySelectorAll('.iss-stat b')].map((n) => n.textContent.trim()))

// 送样人填一个查不到的值
await page.evaluate(() => {
  const inp = document.querySelector('.iss-controls input[placeholder="送样人"]')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, 'zzz')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.evaluate(() => [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('查询'))?.click())
await page.waitForTimeout(2500)
console.log('FILTERED_STATS', JSON.stringify(await stats()), JSON.stringify(await page.evaluate(() => window.__xhr)))

// 清空后再查
await page.evaluate(() => {
  const inp = document.querySelector('.iss-controls input[placeholder="送样人"]')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.evaluate(() => [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('查询'))?.click())
await page.waitForTimeout(2500)
console.log('BACK_STATS', JSON.stringify(await stats()))

// 导出
await page.evaluate(() => [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('导出 Excel'))?.click())
await page.waitForTimeout(5000)
console.log('EXPORT', JSON.stringify(await page.evaluate(() => ({
  blob: window.__xlsxBlob ? window.__xlsxBlob.size : 0,
  name: window.__xlsxName,
  errs: window.__errs,
  xhr: window.__xhr,
})), null, 2))
await task.finish({ keep: [] })
