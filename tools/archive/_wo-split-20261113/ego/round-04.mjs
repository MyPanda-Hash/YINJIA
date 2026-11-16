// round-04：5173 用户环境 —— ①物料候选 123 排序；②工序路线排线弹窗提示（只看不提交，避免写正式库）
const task = await taskSpace('wo-split-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await sleep(2500)
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
  await sleep(3500)
  logged = !(await page.url()).includes('/login')
}
console.log('5173 logged=' + logged)
// ① 物料候选排序
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(5000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '新增')
  btn?.click()
})
await sleep(3800)
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '123')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(2800)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .filter((x) => x.getBoundingClientRect().height > 0).map((x) => (x.textContent || '').trim()))
console.log('5173 候选数=' + opts.length + ' 前8=' + JSON.stringify(opts.slice(0, 8)))
const iSp = opts.findIndex((x) => x.includes('SP00013'))
const iYst = opts.findIndex((x) => x.includes('Y-S-T') || x.includes('硫酸氧钛'))
console.log('SP00013位次=' + (iSp + 1) + ' Y-S-T位次=' + (iYst + 1) + ' 顺序OK=' + (iSp >= 0 && (iYst < 0 || iSp < iYst)))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-split-20261113/r04-5173-inv-rank.png' })
await page.keyboard.press('Escape')
await sleep(500)
// ② 工序路线排线弹窗提示（只看不提交）
await page.goto('http://localhost:5173/#/prod/plan/scheduleBoard', { timeout: 30000 })
await sleep(5000)
await page.evaluate(() => {
  const inp = document.querySelector('.sb-bar input[placeholder*="订单号"], .sb-bar input[placeholder*="关键字"], .sb-bar input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'GD-2026-11-0025')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  btn?.click()
})
await sleep(3200)
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
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('工序路线排线') && x.getBoundingClientRect().width > 100)
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    hint: (d.textContent || '').replace(/\s+/g, ' ').includes('排产数量小于需求数量时'),
    qty: (d.querySelector('.el-input-number input') || {}).value || '',
    demand: (d.querySelector('.prp-demand') || {}).textContent || '',
  }
})
console.log('5173 排线弹窗=' + JSON.stringify(dlg))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-split-20261113/r04-5173-dialog.png' })
// 取消，不写正式库
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('工序路线排线') && x.getBoundingClientRect().width > 100)
  const btn = [...d.querySelectorAll('.el-dialog__footer button, button')].find((b) => (b.textContent || '').trim() === '取消')
  btn?.click()
})
await sleep(800)
console.log('pageerrors=' + JSON.stringify(errors))
