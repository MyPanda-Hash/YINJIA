// round-01:「工单排产」页 —— 验证「本线排产数量」列（A 方案）
// 期望：1号车间 的 GD-2026-11-0012 行3 显示 2500（= 排产数量 5000 × 成型换算率 0.5）
const task = await taskSpace('wo-line-qty-20261111')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const URL_BOARD = BASE + '/#/prod/plan/workOrderBoard'

async function ensureLogin() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return false
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
  await page.waitForTimeout(5000)
  return true
}

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(URL_BOARD, { timeout: 30000 })
await page.waitForTimeout(4000)
const loggedIn = await ensureLogin()
if (loggedIn) {
  await page.goto(URL_BOARD, { timeout: 30000 })
  await page.waitForTimeout(4000)
}

// 等左栏产线渲染出来
await page.waitForTimeout(2000)

// 点左栏「1号车间」
const clicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.wb-line')]
  const hit = items.find((el) => (el.querySelector('.wb-line-name')?.textContent || '').includes('1号车间'))
  if (!hit) return { ok: false, names: items.map((el) => (el.querySelector('.wb-line-name')?.textContent || '').trim()).slice(0, 20) }
  hit.click()
  return { ok: true }
})
console.log('clickLine=' + JSON.stringify(clicked))
await page.waitForTimeout(3000)

// 读表头 + 目标行
const data = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('.wb-main .el-table__header th')].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())
  const rows = [...document.querySelectorAll('.wb-main .el-table__body tr')]
  const out = []
  for (const tr of rows) {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())
    if (cells.some((c) => c.includes('GD-2026-11-0012') || c.includes('GD-2026-11-0011'))) {
      out.push(cells)
    }
  }
  const ctxStats = (document.querySelector('.wb-ctx-stats')?.innerText || '').replace(/\s+/g, ' ').trim()
  return { headers, hitRows: out, ctxStats, rowCount: rows.length }
})
console.log(JSON.stringify(data, null, 2))

await restoreWindow()
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-qty-20261111/round-01.png' })
console.log('shot=round-01.png')
