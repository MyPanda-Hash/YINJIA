const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 45000 })
await page.reload({ timeout: 45000 })
await page.waitForTimeout(5000)
// 已登录(正式库)则直接开单;掉登录就自动走一遍
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'))
if (needLogin) {
  await page.evaluate(() => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const setVal = (el, v) => { if (!el) return; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(8000)
}

// 找一张「检验人」为空的检验数据记录(本地库最近 6 张都是空)
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0092', { timeout: 45000 })
await page.waitForTimeout(10000)

const out = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tr')]
  const signRow = rows.find((r) => (r.innerText || '').includes('检验人'))
  const spans = signRow ? [...signRow.querySelectorAll('.qr-sign')] : []
  return {
    hash: location.hash,
    signRowText: signRow ? (signRow.innerText || '').replace(/\s+/g, ' ').trim() : null,
    signs: spans.map((s) => ({ text: (s.innerText || '').trim(), title: s.getAttribute('title') })),
    servedChunk: [...document.querySelectorAll('script[src*="assets/index-"]')].map((s) => s.getAttribute('src')),
  }
})
console.log(JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-inspector-hint-20261106/round-01.png' })
