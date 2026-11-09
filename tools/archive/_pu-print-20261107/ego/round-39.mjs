// round-39:超送按单位取整 —— 打印材料码弹窗「剩余可打」+ 分批送料「可送上限」
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
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
  await page.waitForTimeout(6500)
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(5000)
}

// 选中 24/12 那单
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)

// ① 打印材料码:剩余可打
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((el) => (el.textContent || '').includes('打印'))
  const c = g?.querySelector('.tb-caret'); if (c) c.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item, .el-dropdown-menu__item')].find((el) => (el.textContent || '').trim() === '打印材料码')
  if (it) it.click()
})
await page.waitForSelector('.mlq', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(2000)
const mlq = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const rows = [...root.querySelectorAll('.el-table__body tbody tr')].slice(0, 7)
  return {
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt).slice(0, 12),
    rows: rows.map((tr) => [...tr.children].map(txt)),
    qtyInputs: [...root.querySelectorAll('.el-input-number input')].slice(0, 7).map((i) => i.value),
  }
})
console.log('materialLabel=' + JSON.stringify(mlq, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-39-allowance.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }
await page.keyboard.press('Escape')
await page.waitForTimeout(800)

// ② 生单(分批送料):可送上限
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((el) => (el.textContent || '').includes('生单'))
  const c = g?.querySelector('.tb-caret'); if (c) c.click()
})
await page.waitForTimeout(700)
const genItems = await page.evaluate(() => [...document.querySelectorAll('.ctx-item, .el-dropdown-menu__item')]
  .map((el) => (el.textContent || '').trim()).filter((t) => t.includes('送料') || t.includes('暂收')).slice(0, 6))
console.log('genItems=' + JSON.stringify(genItems))
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item, .el-dropdown-menu__item')].find((el) => (el.textContent || '').trim() === '生成送料暂收单')
  if (it) it.click()
})
await page.waitForTimeout(3500)
const bsd = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.bsd, .el-dialog__body')
  if (!document.querySelector('.bsd')) return { open: false, bodyTail: txt(document.body).slice(-200) }
  const rows = [...document.querySelectorAll('.bsd .el-table__body tbody tr')].slice(0, 8)
  return {
    open: true,
    headers: [...document.querySelectorAll('.bsd .el-table__header th')].map(txt).slice(0, 20),
    rows: rows.map((tr) => [...tr.children].map(txt)),
    qtyInputs: [...document.querySelectorAll('.bsd .el-input-number input')].slice(0, 8).map((i) => i.value),
    ratio: document.querySelector('.bsd input')?.value,
  }
})
console.log('batchSend=' + JSON.stringify(bsd, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-39-batchsend.png' })
  console.log('shot2=' + p)
} catch (e) { console.log('shot2 fail: ' + e.message) }
await page.keyboard.press('Escape')
