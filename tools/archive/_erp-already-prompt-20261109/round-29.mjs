// round-29: 最终冒烟 —— 5173(源码版)也应是"已转过"警告
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(8000)
const docNo = await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1])
await page.evaluate(() => {
  window.__toasts = []
  setInterval(() => {
    for (const el of document.querySelectorAll('.el-message')) {
      const t = (el.textContent || '').trim()
      if (t && !window.__toasts.includes(t)) window.__toasts.push(t)
    }
  }, 100)
})
await page.evaluate(() => {
  const m = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (m) m.click()
})
await page.waitForTimeout(2500)
console.log('5173 doc=' + docNo + ' toasts=' + JSON.stringify(await page.evaluate(() => window.__toasts)))
