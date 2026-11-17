// round-09:8090(打包版)复核 —— 送样登记表列头「标准方法检出限」+ 有值
const TASK = 'sample-catalog-rev-20261117'
const OUT = 'D:/workspace/yinjia/tools/archive/_sample-catalog-20261117/ego'
const task = await taskSpace(TASK)
const page = await task.newPage()
async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot ->', `${OUT}/${name}.png`)
}
await page.goto('http://127.0.0.1:8090/#/panelx/list/SAMPLE_REG', { timeout: 60000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/SAMPLE_REG', { timeout: 60000 })
  await page.waitForTimeout(5000)
}
const info = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const rows = [...document.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8))
  return { hash: location.hash, ths, rows, body: document.body.innerText.replace(/\s+/g, ' ').match(/共\s*\d+\s*条/)?.[0] || null }
})
console.log(JSON.stringify(info, null, 2))
await shot('round-09-8090-sample-reg')
