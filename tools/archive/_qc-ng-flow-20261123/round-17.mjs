// round-17.mjs —— 用新页签(p2)绕开 p1 的 pending navigation,补两张目标页截图 + QC_BHC 纸面取证
const task = await taskSpace('qc-detaillink-20261123')
const page = await task.newPage()
const SHOT = 'C:/Users/vigna/ego/qc-ng-flow-20261123'

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(800)
    await page.screenshot({ path: SHOT + '/' + name })
    console.log('SHOT OK ' + name)
  } catch (e) { console.log('SHOT SKIP ' + name + ': ' + e.message.slice(0, 100)) }
}

await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 45000 })
await page.waitForTimeout(3000)
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
  await page.waitForTimeout(8000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 45000 })
}
await page.waitForTimeout(12000)
const state = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ')
  const tail = text.slice(0, 600)
  return {
    hash: location.hash,
    title: document.title,
    paperTitle: (document.querySelector('.as-title')?.innerText || '').trim(),
    docnos: (text.match(/BHC-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 3),
    rail: (text.match(/共有数据\s*\d+\s*条/) || [''])[0],
    navCount: performance.getEntriesByType('navigation').length,
    snippet: tail.slice(0, 260),
  }
})
console.log('BHC ' + JSON.stringify(state, null, 2))
await shot('round-17-bhc-page.png')
await task.finish({ keep: [] })
