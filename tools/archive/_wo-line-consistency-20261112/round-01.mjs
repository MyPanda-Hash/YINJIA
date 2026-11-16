// 2026-11-12 round-01:工单排产看板 —— 左侧每线口径 vs 右侧明细/顶部统计是否对得上
// 期望(正式库 HSDZ_MES、装箱2(新厂)):左栏「装箱2(新厂)」= 本线排产 5000,次行「已报 1100 · 未完工 3900」;
// 选中后顶部「本线排产数量 5000 | 已报完工量 1100 | 未完工量 3900」;明细仅 1 行 GD-2026-11-0012。
const task = await taskSpace('wo-line-consistency-20261112')
const page = task.page('p1')
const BASE = 'http://localhost:5173'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// 1) 进页面(会话可能过期 → 自动登录,登录工厂 = YINJIA-MES 正式库)
await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(4500)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"], input[type="password"]'))
if (needLogin) {
  console.log('login required → auto login')
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
    document.querySelector('.login-form .el-select')?.click()
  })
  await page.waitForTimeout(1200)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const el = items.find((x) => {
      const t = (x.textContent || '').trim()
      return t.includes('YINJIA-MES') && !t.includes('测试')
    })
    if (el) { el.click(); return (el.textContent || '').trim() }
    return 'not-found'
  })
  console.log('factory=' + picked)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
  await page.waitForTimeout(5000)
}
await restoreWindow()

// 2) 左栏全量数字(改口径后:主数字=本线排产数量,次行=已报·未完工)
async function readLines() {
  return page.evaluate(() => [...document.querySelectorAll('.wb-line')].map((el) => ({
    name: (el.querySelector('.wb-line-name') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
    qty: (el.querySelector('.wb-qty') || {}).textContent?.trim() || '',
    sub: (el.querySelector('.wb-line-sub') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
    daycap: (el.querySelector('.wb-daycap') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  })).filter((x) => x.name))
}
console.log('lines=' + JSON.stringify(await readLines(), null, 1))

// 3) 点「装箱2(新厂)」→ 读顶部统计 + 明细
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
  if (!el) return 'not-found'
  el.click()
  return 'ok'
})
await page.waitForTimeout(4500)
const board = await page.evaluate(() => ({
  ctx: (document.querySelector('.wb-ctx-label') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  stats: (document.querySelector('.wb-ctx-stats') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  statsTitle: (document.querySelector('.wb-ctx-stats') || {}).getAttribute('title') || '',
  rows: [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    return cells.filter(Boolean).slice(0, 12)
  }).slice(0, 5),
}))
console.log('clicked=' + clicked)
console.log('board=' + JSON.stringify(board, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-01-packline2.png' })

// 4) 再点「1号车间」(成型,工单当前线) 与「切炭1(老厂)」(纯后道可见),各截一张
for (const [idx, key] of [[1, '1号车间'], [2, '切炭1(老厂)']]) {
  const ok = await page.evaluate((k) => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes(k))
    if (!el) return 'not-found'
    el.click(); return 'ok'
  }, key)
  await page.waitForTimeout(4000)
  const g = await page.evaluate(() => ({
    stats: (document.querySelector('.wb-ctx-stats') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
    rows: [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12)).slice(0, 5),
  }))
  console.log('line[' + key + '] clicked=' + ok + ' ' + JSON.stringify(g, null, 1))
  await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-0' + idx + '-' + 'line.png' })
}
