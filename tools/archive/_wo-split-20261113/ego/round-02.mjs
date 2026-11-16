// round-02：物料候选「范围筛选 + 命中优先级」界面验证(新增生产工单页 产品编码输入 123)
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-split-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(4500)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '新增')
  btn?.click()
})
await sleep(3500)
// 产品编码输入 123
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '123')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(2600)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .filter((x) => x.getBoundingClientRect().height > 0)
  .map((x) => (x.textContent || '').trim()))
console.log('候选(前10)=' + JSON.stringify(opts.slice(0, 10)))
console.log('候选数=' + opts.length)
const iSp = opts.findIndex((x) => x.includes('SP00013'))
const iYst = opts.findIndex((x) => x.includes('Y-S-T') || x.includes('硫酸氧钛'))
console.log('SP00013位次=' + (iSp + 1) + ' Y-S-T位次=' + (iYst + 1) + ' 名称命中在规格命中之前=' + (iSp >= 0 && (iYst < 0 || iSp < iYst)))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-split-20261113/r02-inv-rank.png' })
console.log('pageerrors=' + JSON.stringify(errors))
