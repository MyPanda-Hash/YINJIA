// round-07:对比 5173(旧后端 8090) vs 5174(新后端 8092) 的报工记录页,判断 500 是否本次改动引起
const task = await taskSpace('wo-report-query-input-20261113')
const p1 = task.page('p1')

// 在 p1(5174) 注入全量请求 hook,然后 SPA 内跳转再回报工记录复现 500
await p1.evaluate(() => {
  window.__ALL = []
  if (!window.__allHooked) {
    window.__allHooked = true
    const origF = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || ''
      let status = -1
      try {
        const r = await origF(input, init)
        status = r.status
        return r
      } finally {
        if (url.includes('/api/')) window.__ALL.push({ url: url.slice(0, 160), status })
        else window.__ALL.push({ url: url.slice(0, 160), status })
      }
    }
    const origOpen = XMLHttpRequest.prototype.open
    const origSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__u = u; return origOpen.call(this, m, u, ...rest) }
    XMLHttpRequest.prototype.send = function (...a) {
      this.addEventListener('loadend', () => { if (String(this.__u || '').includes('/api/')) window.__ALL.push({ url: String(this.__u).slice(0, 160), status: this.status }) })
      return origSend.apply(this, a)
    }
  }
})
await p1.evaluate(() => { location.hash = '#/panelx/list/WO_COMPLETION_LIST' })
await p1.waitForTimeout(4000)
await p1.evaluate(() => { location.hash = '#/panelx/list/WO_REPORT_LIST' })
await p1.waitForTimeout(6000)
const p1state = await p1.evaluate(() => ({
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(-400),
  fields: document.querySelectorAll('.fields.udl-fields .field').length,
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
  bad: (window.__ALL || []).filter((r) => r.status >= 400).slice(-12),
  total: (window.__ALL || []).length,
}))
console.log('P1_5174 ' + JSON.stringify(p1state, null, 2))

// p2:旧后端 8090 + 5173
const p2 = await task.newPage()
await p2.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await p2.waitForTimeout(8000)
const p2state = await p2.evaluate(() => ({
  hash: location.hash,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(-400),
  fields: document.querySelectorAll('.fields.udl-fields .field').length,
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
  productCodeReadonly: (() => {
    const f = [...document.querySelectorAll('.fields.udl-fields .field')].find((x) => (x.querySelector('label')?.textContent || '').trim() === '产品编码')
    const i = f ? f.querySelector('input') : null
    return i ? { readonly: i.readOnly, placeholder: i.placeholder, value: i.value } : null
  })(),
}))
console.log('P2_5173 ' + JSON.stringify(p2state, null, 2))
await p2.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-07-5173.png' })
console.log('DONE round-07')
