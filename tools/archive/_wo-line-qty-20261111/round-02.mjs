// round-02:切到正式库(YINJIA-MES)后,看「工单排产」页 1号车间 的 GD-2026-11-0012 行
// 期望:本线排产数量 = 2500(排产数量 5000 × 成型换算率 0.5)
const task = await taskSpace('wo-line-qty-20261111')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const URL_BOARD = BASE + '/#/prod/plan/workOrderBoard'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// 1) 清会话 → 登录页(当前登录在测试库)
await page.goto(URL_BOARD, { timeout: 30000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.goto(BASE + '/#/login', { timeout: 30000 })
await page.waitForTimeout(4000)

// 2) 填账号密码
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
})
await page.waitForTimeout(500)

// 3) 选工厂 = 正式库(名字含 YINJIA-MES 且不含「测试」)
await page.evaluate(() => { document.querySelector('.login-form .el-select')?.click() })
await page.waitForTimeout(1000)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el) => (el.textContent || '').trim()))
console.log('factoryOptions=' + JSON.stringify(opts))
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = items.find((el) => { const t = (el.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') })
  if (!hit) return null
  hit.click()
  return (hit.textContent || '').trim()
})
console.log('pickedFactory=' + JSON.stringify(picked))
await page.waitForTimeout(800)

// 4) 登录
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)

// 5) 工单排产页 + 点 1号车间
await page.goto(URL_BOARD, { timeout: 30000 })
await page.waitForTimeout(5000)
const clicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.wb-line')]
  const hit = items.find((el) => (el.querySelector('.wb-line-name')?.textContent || '').includes('1号车间'))
  if (!hit) return { ok: false, names: items.map((el) => (el.querySelector('.wb-line-name')?.textContent || '').trim()).slice(0, 24) }
  hit.click()
  return { ok: true }
})
console.log('clickLine=' + JSON.stringify(clicked))
await page.waitForTimeout(4000)

// 6) 读表头/目标行
const data = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('.wb-main .el-table__header th')].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())
  const rows = [...document.querySelectorAll('.wb-main .el-table__body tr')]
  const idx = headers.reduce((m, h, i) => ((h === '本线排产数量' || h === '当前工序计划量' || h === '订单数量' || h === '当前工序' || h === '工单号') ? { ...m, [h]: i } : m), {})
  const out = []
  for (const tr of rows) {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())
    if (cells.some((c) => c.includes('GD-2026-11-0012'))) {
      out.push(Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, cells[i]])))
    }
  }
  const ctxStats = (document.querySelector('.wb-ctx-stats')?.innerText || '').replace(/\s+/g, ' ').trim()
  return { headers, idx, hitRows: out, ctxStats, rowCount: rows.length }
})
console.log(JSON.stringify(data, null, 2))

await restoreWindow()
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-qty-20261111/round-02.png' })
console.log('shot=round-02.png')
