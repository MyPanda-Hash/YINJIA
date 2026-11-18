// round-09:抓 console/异常事件 + 验证查询按钮是否触发请求
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)

await page.cdp('Runtime.enable', {})
await page.cdp('Log.enable', {})
await page.evaluate(() => {
  window.__fetches = []
  const orig = window.fetch
  window.fetch = function (...a) {
    try { window.__fetches.push(String(a[0])) } catch (e) {}
    return orig.apply(this, a)
  }
  window.__xlsxBlob = null
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) { window.__xlsxBlob = blob; return origCreate.call(URL, blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__xlsxName = this.download; return }
    return origClick.call(this)
  }
})

// 1) 查询按钮
await page.evaluate(() => [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('查询'))?.click())
await page.waitForTimeout(2500)
console.log('AFTER_SEARCH', JSON.stringify(await page.evaluate(() => window.__fetches)))

// 2) 导出按钮
await page.evaluate(() => [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('导出 Excel'))?.click())
await page.waitForTimeout(6000)
console.log('AFTER_EXPORT', JSON.stringify(await page.evaluate(() => ({ fetches: window.__fetches, blob: window.__xlsxBlob?.size || 0 }))))
const evts = await page.events()
const interesting = evts.filter((e) => /exception|console|log/i.test(e.method || ''))
console.log('EVENTS', JSON.stringify(interesting, null, 2).slice(0, 6000))
await task.finish({ keep: [] })
