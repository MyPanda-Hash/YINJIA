const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  factory: (document.body.innerText || '').includes('测试库'),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s10-loggedin.png' })
