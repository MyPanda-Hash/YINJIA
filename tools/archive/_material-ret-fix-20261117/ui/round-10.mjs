const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/MATERIAL_RET', { timeout: 45000 })
await page.waitForTimeout(6000)

const atLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log('atLogin=' + atLogin)
if (atLogin) {
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
  await page.goto('http://127.0.0.1:8090/#/panelx/list/MATERIAL_RET', { timeout: 45000 })
  await page.waitForTimeout(6000)
}

const out = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const cands = [...document.querySelectorAll('div')].filter((el) => /选择$/.test(txt(el)) && txt(el).length < 40)
  return {
    hash: location.hash,
    bodyHead: txt(document.body).slice(0, 300),
    candidates: cands.slice(0, 5).map((el) => ({ text: txt(el), hasTable: !!el.querySelector('table, .el-table') })),
    railHeads: cands.length ? [...cands[cands.length - 1].querySelectorAll('th')].map(txt).filter(Boolean).slice(0, 12) : [],
  }
})
console.log(JSON.stringify(out, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-10-8090-rail.png' })
