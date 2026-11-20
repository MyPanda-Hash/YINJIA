const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
// 点「退出」
await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, li')].filter((el) => txt(el) === '退出' && el.offsetParent)
  if (items.length) items[items.length - 1].click()
})
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, val: i.value })),
    buttons: [...document.querySelectorAll('button')].map((b) => txt(b)).filter((t) => t && t.length < 20),
    selects: [...document.querySelectorAll('.el-select')].map((s) => txt(s)).slice(0, 10),
    body: txt(document.body).slice(0, 400),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s6-login.png' })
