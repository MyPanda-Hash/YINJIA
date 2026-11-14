const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(7000)

const read = () => {
  const tabs = [...document.querySelectorAll('.tabsbar .tab')].map((el) => (el.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim())
  const act = [...document.querySelectorAll('.tabsbar .tab')].findIndex((el) => el.classList.contains('active'))
  return { hash: location.hash, tabs, act, viteErr: !!document.querySelector('vite-error-overlay') }
}

for (const p of ['/panelx/list/PURCHASE_IN', '/panelx/list/PU_ORDER', '/panelx/list/SALES_ORDER_DETAIL']) {
  await page.evaluate((p) => { location.hash = '#' + p }, p)
  await page.waitForTimeout(3500)
}
await page.evaluate(() => { location.hash = '#/panelx/list/SO_ORDER' })
await page.waitForTimeout(4000)
console.log('OPEN ' + JSON.stringify(await page.evaluate(read)))

// 1) × 掉一个**非活动**页签（采购订单）
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').trim() === '采购订单')
  el?.querySelector('.close')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1500)
console.log('CLOSE_INACTIVE ' + JSON.stringify(await page.evaluate(read)))

// 2) × 掉**活动**页签（销售订单）→ 应跳到相邻页签，不白屏
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').trim() === '销售订单')
  el?.querySelector('.close')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4000)
const after = await page.evaluate(read)
const content = (await page.evaluate(() => (document.querySelector('.portal-content')?.innerText || '').replace(/\s+/g, ' ').trim())).slice(0, 80)
console.log('CLOSE_ACTIVE ' + JSON.stringify(after))
console.log('CONTENT ' + content)
console.log(after.tabs.length >= 2 && content.length > 10 && !after.viteErr ? 'PASS 关页签后正常落位' : 'FAIL 关页签后异常')

// 3) 重新打开被关掉的两张（去重不能生成同名页签）
for (const p of ['/panelx/list/SO_ORDER', '/panelx/list/PU_ORDER']) {
  await page.evaluate((p) => { location.hash = '#' + p }, p)
  await page.waitForTimeout(3000)
}
const fin = await page.evaluate(read)
console.log('REOPEN ' + JSON.stringify(fin) + ' 重名=' + JSON.stringify(fin.tabs.filter((t, i) => fin.tabs.indexOf(t) !== i)))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-09.png' })
