// round-13:定位「页面脚本异常」横幅来源(哪个接口 500)
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')

await page.evaluate(() => {
  window.__BAD = []
  const wrap = (kind, origFn) => async function (...args) {
    try {
      const r = await origFn.apply(this, args)
      const url = kind === 'fetch' ? (typeof args[0] === 'string' ? args[0] : args[0]?.url) : args[1]
      if (r && r.status >= 400) window.__BAD.push({ kind, url: String(url || '').slice(0, 180), status: r.status })
      return r
    } catch (e) {
      window.__BAD.push({ kind, url: String(args[0] || args[1] || '').slice(0, 180), err: String(e) })
      throw e
    }
  }
  if (!window.__badHooked) {
    window.__badHooked = true
    window.fetch = wrap('fetch', window.fetch)
    const origOpen = XMLHttpRequest.prototype.open
    const origSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__u = String(u); return origOpen.call(this, m, u, ...rest) }
    XMLHttpRequest.prototype.send = function (body) {
      this.addEventListener('loadend', () => {
        if (this.status >= 400) window.__BAD.push({ kind: 'xhr', url: String(this.__u || '').slice(0, 180), status: this.status })
      })
      return origSend.call(this, body)
    }
  }
})

// SPA 内切换面板,重新走一遍 init/load
await page.evaluate(() => { location.hash = '#/panelx/list/WO_COMPLETION_LIST' })
await page.waitForTimeout(4000)
await page.evaluate(() => { location.hash = '#/panelx/list/WO_REPORT_LIST' })
await page.waitForTimeout(7000)

const out = await page.evaluate(() => ({
  bad: window.__BAD || [],
  banner: (() => {
    const el = [...document.querySelectorAll('div,section')].find((d) => /页面脚本异常/.test(d.innerText || '') && (d.innerText || '').length < 120)
    return el ? (el.innerText || '').replace(/\s+/g, ' ').slice(0, 200) : ''
  })(),
  bodyTail: (document.body.innerText || '').replace(/\s+/g, ' ').slice(-260),
}))
console.log('BAD ' + JSON.stringify(out, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-13.png' })
console.log('DONE round-13')
