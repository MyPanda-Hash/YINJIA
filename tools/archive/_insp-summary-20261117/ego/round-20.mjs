// round-20:UI 点「导出 Excel」→ 服务端生成送检信息汇总表(校验请求/文件名/blob 大小)
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
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
  await page.waitForTimeout(4000)
  await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
  await page.waitForTimeout(3500)
}
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)

const setup = await page.evaluate(() => {
  window.__xhr = []
  window.__blob = null
  window.__dlName = ''
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { try { window.__xhr.push(m + ' ' + u) } catch (e) {} return origOpen.call(this, m, u, ...rest) }
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) { window.__blob = { size: blob.size, type: blob.type }; return origCreate.call(URL, blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__dlName = this.download; return }
    return origClick.call(this)
  }
  const btn = [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('导出 Excel'))
  return { stats: [...document.querySelectorAll('.iss-stat b')].map((n) => n.textContent.trim()), hasButton: !!btn, disabled: btn?.disabled }
})
console.log('BEFORE', JSON.stringify(setup))

await page.evaluate(() => [...document.querySelectorAll('.iss-controls button')].find((b) => (b.textContent || '').includes('导出 Excel'))?.click())
await page.waitForTimeout(5000)
const after = await page.evaluate(() => ({
  xhr: window.__xhr,
  blob: window.__blob,
  downloadName: window.__dlName,
  msgs: [...document.querySelectorAll('.el-message')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('AFTER', JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/21-export-click.png` })
await task.finish({ keep: [] })
