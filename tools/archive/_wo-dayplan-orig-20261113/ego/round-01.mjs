// 2026-11-13 round-01:侦察 —— 工单排产页日期列当前渲染(原计划量/报工数 需求现状)
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://localhost:5173'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
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

// 左栏线清单
const lines = await page.evaluate(() => [...document.querySelectorAll('.wb-line')].map((el) => ({
  name: (el.querySelector('.wb-line-name') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  qty: (el.querySelector('.wb-qty') || {}).textContent?.trim() || '',
  sub: (el.querySelector('.wb-line-sub') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
})).filter((x) => x.name))
console.log('lines=' + JSON.stringify(lines, null, 1))

// 点 3号车间(截图里的线)
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('3号车间'))
  if (!el) return 'not-found'
  el.click(); return 'ok'
})
console.log('clicked=' + clicked)
await page.waitForTimeout(4500)

// 表头(日期列) + 前几行前若干格
const board = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wb-main .el-table__header th')].map((th) => ({
    text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
    cls: th.className,
    title: th.getAttribute('title') || '',
  }))
  const rows = [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => {
      const plan = td.querySelector('.dp-plan')
      return {
        t: (td.textContent || '').replace(/\s+/g, ' ').trim(),
        cls: plan ? plan.className : '',
        title: plan ? plan.getAttribute('title') : (td.getAttribute('title') || ''),
      }
    })
    return tds
  })
  return { thCount: ths.length, ths, rowCount: rows.length, rows: rows.slice(0, 4) }
})
console.log('board=' + JSON.stringify(board).slice(0, 12000))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/round-01-current.png' })
