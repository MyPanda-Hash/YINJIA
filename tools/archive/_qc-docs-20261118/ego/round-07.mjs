const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')
// 给 TC_IN 的部门会签日期格填 2026/11/18,验证数字不再被截断(用户报障②)
const filled = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.q-date-in input')]
  const vals = ['2026', '11', '18']
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  ins.slice(0, 3).forEach((el, i) => setVal(el, vals[i]))
  return ins.length
})
await page.waitForTimeout(900)
const d = await page.evaluate(() => ({
  vals: [...document.querySelectorAll('.q-date-in input')].slice(0, 6).map((i) => i.value),
  signDates: [...document.querySelectorAll('.q-sign-date')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
}))
console.log('inputs:', filled, JSON.stringify(d))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r07-dates-filled.png' })
