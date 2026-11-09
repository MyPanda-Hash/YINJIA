// round-31:8090(jar 内 static)验证打印记录区已上线 + 截图
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 50000 })
await page.waitForTimeout(5000)
const atLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (atLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 50000 })
  await page.waitForTimeout(5000)
}
console.log('session=' + JSON.stringify(await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return { userName: u.userName, isAdmin: u.isAdmin, hash: location.hash }
})))

await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (el) el.click()
})
await page.waitForSelector('.pup', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(1500)
const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    title: txt(document.querySelector('.el-dialog__header')),
    recTitle: txt(root.querySelector('.pup-rec-title')),
    recRows: root.querySelectorAll('.pup-rec .el-table__body tbody tr').length,
    recEmpty: txt(root.querySelector('.pup-rec .el-table__empty-text')),
    entry: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => s.includes('index-')),
  }
})
console.log('8090Dialog=' + JSON.stringify(dlg, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-31-8090-records.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-31-8090-records.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}
await page.keyboard.press('Escape')
