// 诊断:5173 打开采购入库单后的实际状态
const task = await taskSpace('audit-direct-audit-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 30000 })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  url: location.href,
  hash: location.hash,
  hasToken: Boolean(localStorage.getItem('mes_token')),
  inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder).slice(0, 6),
  tbGroups: [...document.querySelectorAll('.tb-group')].map((g) => (g.querySelector('.tb-main')?.textContent || '').trim()),
  bodyLen: document.body.innerText.length,
  head: document.body.innerText.slice(0, 200),
})), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-direct-audit-20261117/diag-5173.png' })
