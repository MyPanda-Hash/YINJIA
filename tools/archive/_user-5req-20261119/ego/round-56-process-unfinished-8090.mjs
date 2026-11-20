const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(4500)
console.log('after login', await page.evaluate(() => location.hash))
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(3500)
const read = () => page.evaluate(() => ({
  box: document.querySelector('.wb-unf')?.innerText.replace(/\s+/g, ' ').trim(),
  ctx: document.querySelector('.wb-ctx b')?.textContent,
  lines: document.querySelectorAll('.wb-line').length,
}))
const selectLine = (name) => page.evaluate((name) => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(name))
  if (row) row.click()
  return !!row
}, name)
const clickCheck = (name) => page.evaluate((name) => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(name))
  const input = row?.querySelector('.el-checkbox input')
  if (input) input.click()
  return !!input
}, name)
await selectLine('2号车间')
await page.waitForTimeout(2500)
console.log('line2', JSON.stringify(await read()))
await clickCheck('1号车间')
await clickCheck('3号车间')
await page.waitForTimeout(500)
console.log('checked1+3', JSON.stringify(await read()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/board-unf-process-8090.png' })
