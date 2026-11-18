// 送样登记表(检测目录)2026-11-17 改版 · 界面取证 round-01
// 5173 = vite 源码版(即时生效)。只做只读检查 + 截图,不点任何不可逆按钮。
const TASK = 'sample-catalog-rev-20261117'
const OUT = 'D:/workspace/yinjia/tools/archive/_sample-catalog-20261117/ego'
const task = await taskSpace(TASK)
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot ->', `${OUT}/${name}.png`)
}

async function loginIfNeeded() {
  const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'))
  if (!needLogin) return false
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
  await page.waitForTimeout(3500)
  return true
}

await page.goto('http://localhost:5173/#/panelx/list/SAMPLE_REG', { timeout: 60000 })
await page.waitForTimeout(3000)
console.log('didLogin =', await loginIfNeeded())
await page.goto('http://localhost:5173/#/panelx/list/SAMPLE_REG', { timeout: 60000 })
await page.waitForTimeout(4500)

const info = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const bodyRows = [...document.querySelectorAll('tbody tr')]
  const rows = bodyRows.slice(0, 3).concat(bodyRows.slice(-3)).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 9))
  return { hash: location.hash, heads: ths, rowCount: bodyRows.length, sample: rows }
})
console.log(JSON.stringify(info, null, 2))
await shot('round-01-sample-reg')
