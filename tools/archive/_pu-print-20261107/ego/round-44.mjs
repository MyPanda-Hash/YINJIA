// round-44:采购订单列表刷新后应看到 11-05 新补拉单据(上一轮 rail 停在了旧分页/旧状态)
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
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(5000)
}

const readRail = () => page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0).slice(0, 6)
  const pager = txt(document.querySelector('.el-pagination'))
  return { rows: rows.map((r) => txt(r).slice(0, 80)), pager }
})
console.log('before=' + JSON.stringify(await readRail(), null, 1))

// 点「刷新」(查找组)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((el) => (el.textContent || '').includes('查找'))
  const btn = g ? [...g.querySelectorAll('button, .tb-main, .tb-item')].find((b) => (b.textContent || '').trim() === '刷新') : null
  if (btn) btn.click()
})
await page.waitForTimeout(3500)
console.log('afterRefresh=' + JSON.stringify(await readRail(), null, 1))

// 若仍不在第一页,用「查找」按单据编号定位
const has = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].some((r) => (r.textContent || '').includes('YJ-20261105-05')))
if (!has) {
  await page.evaluate(() => {
    const g = [...document.querySelectorAll('.tb-group')].find((el) => (el.textContent || '').includes('查找'))
    const btn = g ? [...g.querySelectorAll('button, .tb-main, .tb-item')].find((b) => (b.textContent || '').trim() === '查找') : null
    if (btn) btn.click()
  })
  await page.waitForTimeout(2000)
  const q = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    return { dialog: !!document.querySelector('.query-dialog'), fields: [...document.querySelectorAll('.query-dialog input')].map((i) => i.placeholder || i.name).slice(0, 8), text: txt(document.querySelector('.query-dialog')).slice(0, 200) }
  })
  console.log('queryDialog=' + JSON.stringify(q))
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-44-query.png' })
}
