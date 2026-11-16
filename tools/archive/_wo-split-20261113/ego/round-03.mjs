// round-03：自动切出的子工单出现在待排产池 + 生产工单列表父子数量
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-split-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
// 待排产池页
await page.goto('http://127.0.0.1:8091/#/prod/plan/scheduleBoard', { timeout: 30000 })
await sleep(4500)
await page.evaluate(() => {
  const inp = document.querySelector('.sb-bar input[placeholder*="订单号"], .sb-bar input[placeholder*="关键字"], .sb-bar input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'GD-VERIFY-SPLIT-03')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  btn?.click()
})
await sleep(3200)
const pool = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)))
console.log('待排产池(子单)=' + JSON.stringify(pool.slice(0, 5)))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-split-20261113/r03-pool.png' })
// 生产工单列表看父子
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(4500)
await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder="输入查询条件..."]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'GD-VERIFY-SPLIT-03')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-query button')].find((b) => (b.textContent || '').trim() === '查找')
  btn?.click()
})
await sleep(3200)
const rows = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
  return [...document.querySelectorAll('.wol-table .el-table__body tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    const o = {}
    ths.forEach((h, i) => { if (h) o[h] = tds[i] })
    return o
  })
})
console.log('列表行=' + JSON.stringify(rows.map((r) => ({ 工单: r['工单号'], 行: r['工单行号'], 需求: r['需求数量'], 排产: r['排产数量'], 线: r['生产线'], 类型: r['工单类型'], 源: r['源工单号'] }))))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-split-20261113/r03-list.png' })
console.log('pageerrors=' + JSON.stringify(errors))
