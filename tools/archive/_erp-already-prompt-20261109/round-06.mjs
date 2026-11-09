// round-06: 抓「转ERP」接口的真实响应(后端到底推没推、回的是什么),不再只看 toast
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(6000)

// XHR 钩子:callButton 走 axios ⇒ 包一层 XMLHttpRequest
await page.evaluate(() => {
  window.__erpReqs = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) {
    this.__m = m; this.__u = u
    return open.call(this, m, u, ...rest)
  }
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      if (String(this.__u || '').includes('callButton')) {
        window.__erpReqs.push({
          url: String(this.__u), status: this.status,
          body: (() => { try { return JSON.parse(this.responseText) } catch { return String(this.responseText).slice(0, 400) } })(),
        })
      }
    })
    return send.apply(this, args)
  }
})

const clicked = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (!main) return 'no-main'
  main.click()
  return 'clicked'
})
console.log('click=' + clicked)
await page.waitForTimeout(6000)
console.log('REQS=' + JSON.stringify(await page.evaluate(() => window.__erpReqs), null, 2))
console.log('TOASTS=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => (el.textContent || '').trim()))))
