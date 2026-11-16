// round-05:带 token 强制整页加载 → 订单结转页 → 跳到最近有数据的一天 → dump 待结转行
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
const bust = Date.now()
await page.goto('http://localhost:5173/?r=' + bust + '#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(7000)
const jumped = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find((x) => (x.innerText || '').trim() === '跳转')
  if (b) { b.click(); return true }
  return false
})
console.log('jumped:', jumped)
await page.waitForTimeout(7000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  factory: (() => { try { return JSON.parse(localStorage.getItem('mes_factory') || 'null') } catch { return null } })(),
  topText: (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 400),
  dateRange: [...document.querySelectorAll('input.el-range-input')].map((i) => i.value),
  rows: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())),
}))
console.log(JSON.stringify(info, null, 2).slice(0, 14000))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-05-list.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
