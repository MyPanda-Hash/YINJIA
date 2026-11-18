// round-01: 打开 5173,看是否登录页 / 已登录哪个账套,并把「登录工厂」选到测试库
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/', { timeout: 30000 })
await page.waitForTimeout(5000)

const state = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type),
  selects: [...document.querySelectorAll('.el-select .el-select__wrapper, .el-select')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12),
  token: !!localStorage.getItem('token'),
}))
console.log(JSON.stringify(state, null, 2))

// 是登录页 ⇒ 填账号密码,并把「登录工厂」明确选到测试库(YJ_TEST)
if (state.inputs.some((p) => String(p).includes('登录账号'))) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  })
  await page.waitForTimeout(300)
  // 打开「登录工厂」下拉(第三个 el-select 常常是语言,故按所在 form-item 的 label 找)
  const opened = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-form-item')]
    const it = items.find((el) => (el.textContent || '').includes('登录工厂'))
    const trigger = it?.querySelector('.el-select__wrapper, .el-select')
    if (trigger) { trigger.click(); return true }
    return false
  })
  console.log('factory select opened =', opened)
  await page.waitForTimeout(600)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el) => (el.textContent || '').trim()))
  console.log('options =', JSON.stringify(opts))
  const picked = await page.evaluate(() => {
    const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((el) => (el.textContent || '').includes('测试库'))
    if (it) { it.click(); return (it.textContent || '').trim() }
    return null
  })
  console.log('picked =', picked)
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => [...document.querySelectorAll('.el-form-item')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.includes('登录工厂')))
  console.log('factory row now =', JSON.stringify(after))
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-01-login.png' })
}
console.log('done round-01')
