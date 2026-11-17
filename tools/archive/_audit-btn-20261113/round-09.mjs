// round-09: 切到测试账套(YINJIA-MES·测试库) —— 顶栏账套下拉 → 选测试库 → 输密码 → 切换并重新登录。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(800)

const before = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
console.log('BEFORE_FACTORY ' + before)

// 打开账套下拉
await page.evaluate(() => {
  const el = document.querySelector('.factory')
  el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  el?.click()
})
await page.waitForTimeout(900)
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .factory-item')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('FACTORY_ITEMS ' + JSON.stringify(items))

const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .factory-item')]
  const target = items.find((el) => /测试/.test(el.textContent || ''))
  if (!target) return ''
  target.click()
  return (target.textContent || '').trim()
})
console.log('PICKED ' + picked)
await page.waitForTimeout(1200)

const dialogOpen = await page.evaluate(() => !!document.querySelector('.factory-switch-dialog'))
console.log('DIALOG ' + dialogOpen)
if (dialogOpen) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const inp = document.querySelector('.factory-switch-dialog input[type="password"], .factory-switch-dialog input')
    if (inp) setVal(inp, '123456')
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.factory-switch-dialog button')]
      .find((b) => (b.textContent || '').includes('切换并重新登录'))
    btn?.click()
  })
  await page.waitForTimeout(9000)
}
console.log('URL ' + await page.url())
const after = await page.evaluate(() => ({
  factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
  topbar: (document.querySelector('.topbar, header')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
}))
console.log('AFTER ' + JSON.stringify(after))
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-09.json', JSON.stringify({ before, items, picked, after }, null, 2), 'utf8')
