const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 45000 })
await page.waitForTimeout(5000)

// ① 打开右上角用户下拉 → 退出登录
const step1 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter((n) => (n.textContent || '').trim() === '系统管理员' && n.children.length === 0)[0]
  if (!el) return 'no-user'
  el.click()
  return 'user-clicked'
})
console.log('1 -> ' + step1)
await page.waitForTimeout(1200)

const step2 = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, li, span, div')]
    .filter((n) => (n.textContent || '').replace(/\s+/g, '') === '退出登录')
  const el = items[items.length - 1]
  if (!el) return 'no-logout'
  el.click()
  return 'logout-clicked'
})
console.log('2 -> ' + step2)
await page.waitForTimeout(1500)

// 可能的确认框
const confirm = await page.evaluate(() => {
  const body = (document.body.innerText || '').replace(/\s+/g, ' ')
  const btn = [...document.querySelectorAll('.el-message-box__btns button, .el-dialog__footer button')]
    .find((b) => /确定|确认|退出/.test(b.textContent || ''))
  if (btn) { btn.click(); return 'confirmed' }
  return 'no-confirm | ' + body.slice(0, 200)
})
console.log('3 -> ' + confirm)
await page.waitForTimeout(5000)

const state = await page.evaluate(() => ({
  hash: location.hash,
  hasFactoryInput: !!document.querySelector('input[placeholder*="登录工厂"]'),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('state: ' + JSON.stringify(state))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-12.png' })
