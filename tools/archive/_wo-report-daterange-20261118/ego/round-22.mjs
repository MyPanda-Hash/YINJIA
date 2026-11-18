const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
await page.waitForTimeout(4000)
let state = await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('input[placeholder*="密码"]'),
  hasRange: !!document.querySelector('.query-date-range'),
  footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
  count: (document.querySelector('.report-count') || {}).textContent,
}))
console.log('STATE1', JSON.stringify(state))
if (state.hasLogin) {
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
  await page.waitForTimeout(6000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
  await page.waitForTimeout(4500)
  state = await page.evaluate(() => ({
    hash: location.hash,
    hasRange: !!document.querySelector('.query-date-range'),
    footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
    count: (document.querySelector('.report-count') || {}).textContent,
  }))
  console.log('STATE2', JSON.stringify(state))
}
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-22-8090.png' })
