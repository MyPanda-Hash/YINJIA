/* round-04.mjs — 钩住 XHR 看应用自己那次 queryFormDataList 的响应(点「刷新」触发) */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.evaluate(() => {
  if (window.__hooked) return
  window.__hooked = true
  window.__log = []
  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) {
    this.__u = u
    this.__m = m
    return origOpen.call(this, m, u, ...rest)
  }
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('loadend', () => {
      try {
        if (String(this.__u || '').includes('/px/')) {
          window.__log.push({ url: String(this.__u), status: this.status, resp: String(this.responseText || '').slice(0, 800) })
        }
      } catch (e) { }
    })
    return origSend.call(this, body)
  }
})

// 点「刷新」触发一次同面板重取
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, .el-button, span')]
  const b = btns.find((el) => (el.textContent || '').trim() === '刷新')
  if (b) { b.click(); return true }
  return false
})
await page.waitForTimeout(3500)

const log = await page.evaluate(() => window.__log || [])
console.log('clicked=' + clicked)
console.log(JSON.stringify(log, null, 2))
