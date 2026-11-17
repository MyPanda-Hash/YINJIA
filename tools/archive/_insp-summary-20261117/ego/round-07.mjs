// round-07:直接调用组件实例的 exportExcel,看它到底抛了什么
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)

const r = await page.evaluate(async () => {
  window.__xlsxBlob = null
  window.__xlsxName = ''
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) { window.__xlsxBlob = blob; return origCreate.call(URL, blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__xlsxName = this.download; return }
    return origClick.call(this)
  }
  const el = document.querySelector('.iss-page')
  const inst = el && el.__vueParentComponent
  const keys = inst ? Object.keys(inst.setupState || {}) : []
  if (!inst) return { error: 'no vue instance' }
  if (typeof inst.setupState.exportExcel !== 'function') return { error: 'no exportExcel', keys: keys.filter((k) => /export|data|range|docs|senders/i.test(k)) }
  try {
    await inst.setupState.exportExcel()
    await new Promise((res) => setTimeout(res, 1500))
    return { ok: true, blob: window.__xlsxBlob ? window.__xlsxBlob.size : 0, name: window.__xlsxName, keys: keys.filter((k) => /export|data|range|docs|senders/i.test(k)) }
  } catch (e) {
    return { error: 'threw: ' + (e && (e.stack || e.message || e)), keys }
  }
})
console.log(JSON.stringify(r, null, 2))
await task.finish({ keep: [] })
