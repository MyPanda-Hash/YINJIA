const task = await taskSpace('purin-multiwh-20261117')
const page = task.page('p1')

const fac = await page.evaluate(() => ({
  text: (document.querySelector('.topbar, .sys-topbar, header')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  testDb: (document.body.textContent || '').includes('测试库'),
}))
console.log('factory=' + JSON.stringify(fac))

if (!fac.testDb) {
  await page.evaluate(() => { localStorage.removeItem('mes_token'); localStorage.removeItem('mes_user'); localStorage.removeItem('mes_factory') })
  await page.reload({ timeout: 60000 })
  await page.waitForTimeout(3000)
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('YINJIA-MES'))
    sel?.querySelector('.el-select__wrapper, input')?.click()
    await sleep(700)
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => (o.textContent || '').includes('测试库'))
    opt?.click()
    await sleep(300)
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click()
  })
  await page.waitForTimeout(8000)
}

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0008', { timeout: 60000 })
await page.waitForTimeout(8000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

const tb = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  return {
    hash: location.hash,
    toolbar: [...document.querySelectorAll('.tools .tb-group')].filter(vis).map((g) => (g.querySelector('.tb-main')?.textContent || '').trim()),
    rows: [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis).length,
    testDb: (document.body.textContent || '').includes('测试库'),
  }
})
console.log('TOOLBAR=' + JSON.stringify(tb, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-multiwh-20261117/m1-form.png' })
