// round-01：快速排产页 —— 工序路线排线弹窗：排产数量 60 < 需求 100 ⇒ 自动切出子工单
const task = await taskSpace('wo-split-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 30000 })
await sleep(1500)
let logged = !(await page.url()).includes('/login')
if (!logged) {
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
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await sleep(3000)
  logged = !(await page.url()).includes('/login')
}
console.log('logged=' + logged)
await page.goto('http://127.0.0.1:8091/#/prod/plan/scheduleBoard', { timeout: 30000 })
await sleep(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
// 关键字收敛到夹具
await page.evaluate(() => {
  const inp = document.querySelector('.sb-bar input[placeholder*="订单号"], .sb-bar input[placeholder*="关键字"], .sb-bar input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'GD-VERIFY-SPLIT-03')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.sb-bar button, button')].find((b) => (b.textContent || '').trim() === '查询')
  btn?.click()
})
await sleep(3500)
const pool = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)))
console.log('待排产池=' + JSON.stringify(pool.slice(0, 5)))
// 勾选第一行 → 排产
await page.evaluate(() => {
  const tr = document.querySelector('.el-table__body tr')
  tr?.querySelector('td .el-checkbox')?.click()
})
await sleep(700)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '排产')
  btn?.click()
})
await sleep(3000)
const dialog = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('工序路线排线') && x.getBoundingClientRect().width > 100)
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    hint: (d.textContent || '').replace(/\s+/g, ' ').includes('排产数量小于需求数量时'),
    qtyInput: (d.querySelector('.el-input-number input') || {}).value || '',
    demandText: (d.querySelector('.prp-demand') || {}).textContent || '',
  }
})
console.log('排线弹窗=' + JSON.stringify(dialog))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-split-20261113/r01-dialog.png' })
// 填排产数量 60
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('工序路线排线') && x.getBoundingClientRect().width > 100)
  const inp = d?.querySelector('.el-input-number input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '60')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await sleep(500)
// 每道工序选线(按车间选第一条可用)
const lineSel = await page.evaluate(async () => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('工序路线排线') && x.getBoundingClientRect().width > 100)
  const rows = [...d.querySelectorAll('.el-table__body tr')]
  const chosen = []
  for (const tr of rows) {
    const sel = tr.querySelector('.el-select')
    if (!sel) continue
    sel.querySelector('input')?.focus()
    sel.click()
    await new Promise((r) => setTimeout(r, 500))
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.getBoundingClientRect().height > 0)[0]
    if (opt) { chosen.push((opt.textContent || '').trim()); opt.click() }
    await new Promise((r) => setTimeout(r, 300))
  }
  return chosen
})
console.log('选线=' + JSON.stringify(lineSel))
await sleep(800)
// 提交
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('工序路线排线') && x.getBoundingClientRect().width > 100)
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '排产')
  btn?.click()
})
let toasts = []
for (let i = 0; i < 24; i++) {
  await sleep(400)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  if (toasts.some((x) => x.includes('自动切出') || x.includes('已排产'))) break
}
await sleep(1200)
const t2 = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
console.log('提交提示=' + JSON.stringify(t2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-split-20261113/r01-toast.png' })
console.log('pageerrors=' + JSON.stringify(errors))
