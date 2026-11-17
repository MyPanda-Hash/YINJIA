// round-12:打包版 8090 验收(新 jar + 新 static):产品编码控件形态 + 输入片段回车查询
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(6000)

let st = await page.evaluate(() => ({
  hash: location.hash,
  needLogin: !![...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('账号')),
  token: (localStorage.getItem('mes_token') || '').slice(0, 12),
}))
console.log('STATE ' + JSON.stringify(st))

if (st.needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
  await page.waitForTimeout(7000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.evaluate(() => {
  window.__REQ = []
  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__u = String(u); return origOpen.call(this, m, u, ...rest) }
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (String(this.__u || '').includes('queryFormDataList') && body) {
        const b = JSON.parse(body)
        window.__REQ.push({ panel: b.panelCode, condition: b.condition })
      }
    } catch (e) { /* ignore */ }
    return origSend.call(this, body)
  }
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const target = fields.find((f) => (f.querySelector('label')?.textContent || '').trim() === '产品编码')
  const inp = target ? target.querySelector('input') : null
  if (inp) inp.setAttribute('data-qi', 'product-code')
})

const probe = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const target = fields.find((f) => (f.querySelector('label')?.textContent || '').trim() === '产品编码')
  return {
    fieldCount: fields.length,
    autocomplete: !!(target && target.querySelector('.el-autocomplete')),
    placeholder: target?.querySelector('input')?.placeholder || '',
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    total: (document.querySelector('.report-count')?.textContent || '').trim(),
    errBanner: (document.body.innerText || '').includes('页面脚本异常'),
  }
})
console.log('PROBE ' + JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-12-8090-before.png' })

// 输入片段回车
await page.click('[data-qi="product-code"]')
await page.waitForTimeout(300)
await page.fill('[data-qi="product-code"]', 'A-48')
await page.waitForTimeout(1600)
await page.keyboard.press('Enter')
await page.waitForTimeout(4500)
const after = await page.evaluate(() => {
  const main = (window.__REQ || []).filter((r) => r.panel === 'WO_REPORT_LIST')
  const last = main.slice(-1)[0]
  const cond = last?.condition || {}
  const summary = Object.fromEntries(Object.entries(cond).map(([k, v]) => [k, Array.isArray(v) ? { array: v.length, head: v.slice(0, 3) } : String(v)]))
  return {
    condition: summary,
    input: document.querySelector('[data-qi="product-code"]')?.value,
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    total: (document.querySelector('.report-count')?.textContent || '').trim(),
    pageText: (document.querySelector('.page-no')?.textContent || '').trim(),
  }
})
console.log('AFTER ' + JSON.stringify(after, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-12-8090-search.png' })
console.log('DONE round-12')
