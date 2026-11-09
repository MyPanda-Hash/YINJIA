// round-50:打印弹窗补齐「已送/已打印/剩余可打」并默认填剩余可打(YJ-20261105-01,超送 20%)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5500)
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
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(5500)
}

// 选 YJ-20261105-01(按单号在 rail 里找;找不到就翻页/用当前列表第一行)
const picked = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0)
  const row = rows.find((r) => txt(r).includes('YJ-20261105-01'))
  if (row) { row.scrollIntoView({ block: 'center' }); row.click(); return 'clicked YJ-20261105-01' }
  if (rows[0]) { rows[0].click(); return 'fallback ' + txt(rows[0]).slice(0, 30) }
  return 'no row'
})
console.log('pick=' + picked)
await page.waitForTimeout(2500)

await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => txt(el).startsWith('打印'))
  const main = g?.querySelector('.tb-main') || g?.querySelector('button')
  if (main) main.click()
})
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => txt(d).includes('打印采购订单'))
  if (!dlg) return { open: false }
  const headers = [...dlg.querySelectorAll('.el-table__header th')].map(txt)
  const rows = [...dlg.querySelectorAll('.el-table__body tbody tr')].slice(0, 4).map((tr) => [...tr.children].map(txt))
  return {
    open: true,
    title: txt(dlg.querySelector('.el-dialog__title')),
    tip: txt(dlg.querySelector('.pup-quota-tip')),
    headers,
    rows,
    inputs: [...dlg.querySelectorAll('.el-table__body tbody tr .el-input-number input')].map((i) => i.value),
    footer: txt(dlg.querySelector('.el-dialog__footer')),
  }
})
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-50-print-quota-cols.png' })
await page.keyboard.press('Escape')
