/**
 * round-03 — 切到测试账套(YJ_TEST)+ 探测采购订单列表工具栏(为 round-04 真实点「打印订单无金额」)
 * ⚠ 只切会话,不动库;round-05 结束时把会话登回正式库(YJ)。
 */
const OUT = 'D:/YINJIA-main/_scratch/ego-delivery-qr-20261124'
const task = await taskSpace('delivery-qr-20261124')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }

// ① 退出当前(YJ)会话 → 登录页
await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(1500)
await page.evaluate(() => {
  localStorage.removeItem('mes_token'); localStorage.removeItem('mes_user'); localStorage.removeItem('mes_factory')
})
await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(3000)

// ② 选登录工厂 = 测试库,填账号密码,进入系统
const login = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  // 工厂下拉 = el-select(点开 → 选带「测试」的那一项)
  const selects = [...document.querySelectorAll('.el-select')]
  const factorySel = selects.find((s) => (s.textContent || '').includes('工厂')) || selects[selects.length - 1]
  factorySel?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  factorySel?.click()
  await sleep(800)
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
  const target = opts.find((o) => /测试/.test(o.textContent || ''))
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  target?.click()
  await sleep(500)
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  await sleep(300)
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  btn?.click()
  return { optTexts: opts.map((o) => (o.textContent || '').trim()), picked: target ? target.textContent.trim() : null, clicked: !!btn }
})
console.log('登录动作 = ' + JSON.stringify(login))
await page.waitForTimeout(5000)

// ③ 采购订单列表 + 工具栏探测
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)
const r = await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  title: document.title,
  rows: document.querySelectorAll('.el-table__body tr').length,
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 20).slice(0, 60),
  firstRow: (() => {
    const tr = document.querySelector('.el-table__body tr')
    return tr ? [...tr.children].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8) : []
  })(),
}))
console.log(JSON.stringify(r, null, 2))
await page.screenshot({ path: OUT + '/round-03-pu-list-test-db.png' })
await task.finish({ keep: [] })
