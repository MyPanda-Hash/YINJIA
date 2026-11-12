// 2026-11-12 按量流转·工单排产列表页验收：4 个新列 + 展开行的逐道明细
const task = await taskSpace('wo-board-flow-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderList', { timeout: 40000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// ① 没登录就先登录(默认 YJ=正式库)
const needLogin = await page.evaluate(() => !localStorage.getItem('mes_token'))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderList', { timeout: 40000 })
  await page.waitForTimeout(4000)
}

// ② 查询该工单
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('输入查询条件'))
  if (inp) setVal(inp, 'GD-2026-11-0012')
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '刷新')
  if (btn) btn.click()
  // 没有刷新按钮就直接回车触发
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('输入查询条件'))
  if (inp) inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
})
await page.waitForTimeout(4000)

// ③ 读表头 + 首行
const before = await page.evaluate(() => ({
  headers: [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  firstRow: [...document.querySelectorAll('.el-table__body tr')].slice(0, 2).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()),
  rows: document.querySelectorAll('.el-table__body tr').length,
}))
console.log('HEADERS: ' + JSON.stringify(before.headers))
console.log('ROWS: ' + before.rows)
console.log('FIRST ROW: ' + JSON.stringify(before.firstRow[0] || ''))

// ④ 展开首行
await page.evaluate(() => {
  const icon = document.querySelector('.el-table__expand-icon')
  if (icon) icon.click()
})
await page.waitForTimeout(1500)
const detail = await page.evaluate(() => {
  const box = document.querySelector('.wol-flow-box')
  if (!box) return { found: false }
  const rows = [...box.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()))
  return {
    found: true,
    title: (box.querySelector('.wol-flow-title') || {}).textContent || '',
    head: [...box.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim()),
    rows,
  }
})
console.log('EXPAND: ' + JSON.stringify(detail, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-01-expand.png' })
