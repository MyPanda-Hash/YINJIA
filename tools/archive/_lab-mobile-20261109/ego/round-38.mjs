const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 装一个请求钩子:记录 axios(fetch/XHR)对 /api/px/getPanelConfig 的响应
await page.evaluate(() => {
  window.__reqLog = []
  const of = window.fetch
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
    try {
      const r = await of.apply(this, args)
      if (String(url).includes('/api/')) window.__reqLog.push({ url: String(url).slice(0, 120), status: r.status })
      return r
    } catch (e) {
      window.__reqLog.push({ url: String(url).slice(0, 120), err: String(e && e.message) })
      throw e
    }
  }
  const O = window.XMLHttpRequest
  window.XMLHttpRequest = function () {
    const x = new O()
    const open = x.open
    x.open = function (m, u, ...rest) {
      x.__u = u
      return open.call(x, m, u, ...rest)
    }
    x.addEventListener('loadend', () => {
      if (String(x.__u || '').includes('/api/')) window.__reqLog.push({ xhr: String(x.__u).slice(0, 120), status: x.status })
    })
    return x
  }
})
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(1500)
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(6000)
const log = await page.evaluate(() => (window.__reqLog || []).slice(-40))
console.log(JSON.stringify(log, null, 2))
