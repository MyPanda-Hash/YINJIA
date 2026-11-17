// round-11:5173(源码版)切到正式账套 YJ 后验证页面 + 导出
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(2500)
// 退到登录页(清本地会话),再用正式账套重登
await page.evaluate(() => { localStorage.removeItem('mes_token'); localStorage.removeItem('mes_factory') })
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(3000)

// 登录工厂 = YINJIA-MES(YJ)
await page.evaluate(() => document.querySelector('.el-select__wrapper')?.click())
await page.waitForTimeout(800)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = items.find((n) => (n.textContent || '').trim() === 'YINJIA-MES')
  hit?.click()
  return items.map((n) => (n.textContent || '').trim())
})
console.log('FACTORY_OPTIONS', JSON.stringify(picked))
await page.waitForTimeout(600)
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
})
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
await page.waitForTimeout(4500)
console.log('AFTER_LOGIN', JSON.stringify(await page.evaluate(() => ({
  url: location.href, factory: localStorage.getItem('mes_factory'), token: !!localStorage.getItem('mes_token'),
}))))

await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)
console.log('PAGE', JSON.stringify(await page.evaluate(() => ({
  factory: localStorage.getItem('mes_factory'),
  stats: [...document.querySelectorAll('.iss-stat')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  tabs: [...document.querySelectorAll('.iss-tabs .el-tabs__item')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
}))))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/12-5173-yj-sender.png` })

// 导出拦截
const cap = await page.evaluate(async () => {
  window.__xlsxBlob = null
  window.__xlsxName = ''
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) { window.__xlsxBlob = blob; return origCreate.call(URL, blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__xlsxName = this.download; return }
    return origClick.call(this)
  }
  const btn = [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('导出 Excel'))
  if (!btn) return { error: 'no button' }
  btn.click()
  for (let i = 0; i < 40 && !window.__xlsxBlob; i++) await new Promise((r) => setTimeout(r, 200))
  if (!window.__xlsxBlob) return { error: 'no blob' }
  const ab = await window.__xlsxBlob.arrayBuffer()
  const bytes = new Uint8Array(ab)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return { name: window.__xlsxName, size: bytes.length, b64: btoa(s) }
})
console.log('EXPORT', JSON.stringify({ name: cap.name, size: cap.size, error: cap.error }))
if (cap.b64) {
  const XLSX = await import('file:///D:/workspace/yinjia/frontend/node_modules/xlsx/xlsx.mjs')
  const wb = XLSX.read(Buffer.from(cap.b64, 'base64'), { type: 'buffer' })
  console.log('SHEETS', JSON.stringify(wb.SheetNames))
}
await task.finish({ keep: [] })
