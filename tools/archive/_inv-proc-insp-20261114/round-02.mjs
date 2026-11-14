const task = await taskSpace('inv-proc-insp-20261114')
const page = task.page('p1')
// 打开登录工厂下拉并选择测试账套
const selects = await page.evaluate(() => [...document.querySelectorAll('.el-select')].map((el, i) => ({ i, text: (el.textContent || '').replace(/\s+/g, ' ').trim() })))
console.log('selects:', JSON.stringify(selects))
const facIdx = selects.findIndex((s) => s.text.includes('YINJIA-MES'))
if (facIdx >= 0) {
  await page.click(`.el-select:nth-of-type(${facIdx + 1})`, { label: '选择登录工厂' }).catch(() => {})
}
await page.waitForTimeout(800)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el, i) => ({ i, text: (el.textContent || '').replace(/\s+/g, ' ').trim() })))
console.log('options:', JSON.stringify(opts))
const testOpt = opts.find((o) => o.text.includes('测试'))
if (testOpt) {
  await page.evaluate((i) => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    if (items[i]) items[i].click()
  }, testOpt.i)
}
await page.waitForTimeout(600)
// 填账号密码并登录
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号') || (i.placeholder || '').includes('企业账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc) setVal(acc, 'admin')
  if (pwd) setVal(pwd, '123456')
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(7000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  ths: [...document.querySelectorAll('.el-table__header th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 24),
  thCount: document.querySelectorAll('.el-table__header th').length,
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200)
}))
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/inv-proc-insp-20261114/round-02.png' })
