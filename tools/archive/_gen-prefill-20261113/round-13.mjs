// round-13: 把浏览器账套切回正式库(不把用户的会话留在测试库),并顺手核对正式库工具栏/对话框仍正常。
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(400)
const before = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
console.log('BEFORE ' + before)
if (before.includes('测试')) {
  await page.evaluate(() => {
    const el = document.querySelector('.factory')
    el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    el?.click()
  })
  await page.waitForTimeout(900)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item, .factory-item')]
    const t = items.find((el) => (el.textContent || '').trim() === 'YINJIA-MES')
    if (!t) return ''
    t.click()
    return (t.textContent || '').trim()
  })
  console.log('PICKED ' + picked)
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const inp = document.querySelector('.factory-switch-dialog input')
    if (inp) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(inp, '123456')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.factory-switch-dialog button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
    btn?.click()
  })
  await page.waitForTimeout(9000)
}
const after = await page.evaluate(() => ({
  factory: (document.querySelector('.factory-name')?.textContent || '').trim(), hash: location.hash,
}))
console.log('AFTER ' + JSON.stringify(after))
