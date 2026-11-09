// round-01:登录 + 打开采购订单列表,记下列表/工具栏结构(不改任何数据)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(3500)

const needLogin = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  return location.hash.includes('/login') || ins.some((i) => (i.placeholder || '').includes('账号'))
})
let loginState = 'already-logged-in'
if (needLogin) {
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
  await page.waitForTimeout(5000)
  loginState = 'logged-in-by-script'
}

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const btns = [...document.querySelectorAll('button, .el-dropdown, .as-side-btn')].map(txt).filter(Boolean)
  const rows = [...document.querySelectorAll('.rail-row, .doc-rail-item, .rail-list .row, tbody tr')]
  const poRows = rows.map((r) => txt(r)).filter((t) => t.includes('YJ-2026')).slice(0, 5)
  return {
    hash: location.hash,
    title: document.title,
    toolbarButtons: [...new Set(btns)].slice(0, 30),
    railRowCount: rows.length,
    poRows,
  }
})
console.log('loginState=' + loginState)
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-01-list.png' })
