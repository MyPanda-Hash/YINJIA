// round-06: 切到测试库(YJ_TEST) —— 采购订单左栏找一张草稿单,看「审核」按钮是否可点。
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2500)

const onLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
if (onLogin) {
  // 选登录工厂:先点开下拉,读出候选,选带「测试」的那个
  const opts = await page.evaluate(() => {
    const sel = document.querySelector('.el-select')
    sel?.click()
    return true
  })
  await page.waitForTimeout(800)
  const options = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el) => (el.textContent || '').trim()))
  console.log('FACTORY_OPTIONS ' + JSON.stringify(options))
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const target = items.find((el) => (el.textContent || '').includes('测试')) || items[0]
    if (!target) return ''
    target.click()
    return (target.textContent || '').trim()
  })
  console.log('FACTORY_PICKED ' + picked)
  await page.waitForTimeout(500)
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
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
}
console.log('AFTER_LOGIN_URL ' + await page.url())

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)

const dump = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 40).map((tr, i) => ({
    i,
    cells: [...tr.querySelectorAll('td')].map((td) => text(td)),
    status: text(tr.querySelector('.dsr-tag')),
  }))
  return {
    hash: location.hash,
    factoryLabel: text(document.querySelector('.top-factory, .factory-chip, .doc-chip')),
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: text(g.querySelector('.tb-main')),
      disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
    })),
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    rows,
  }
})
console.log('STATE ' + JSON.stringify(dump, null, 2))
