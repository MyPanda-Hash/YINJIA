/* round-25.mjs — 8090 会话过期:重新登录(admin,沿用页面上已选的登录工厂)后复核列序 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc) setVal(acc, 'admin')
  if (pwd) setVal(pwd, '123456')
})
await page.waitForTimeout(500)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(7000)
console.log('after login hash=' + (await page.evaluate(() => location.hash)))

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(9000)
const th = await page.evaluate(() =>
  [...document.querySelectorAll('.el-table__header th')]
    .map((el) => (el.innerText || '').replace(/[\s⇅]+/g, ' ').trim())
    .filter(Boolean))
console.log('8090 表头 ->', JSON.stringify(th))
console.log('行号列 ->', th.filter((t) => t.includes('行号')))
console.log('hash=' + (await page.evaluate(() => location.hash)))
