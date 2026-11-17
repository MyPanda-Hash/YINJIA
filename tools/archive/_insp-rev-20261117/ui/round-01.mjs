// round-01: 登录 YJ_TEST → 打开检验委托单 → 新建 → 看纸面新控件 → 截图
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

async function login() {
  await page.goto('http://localhost:5173/', { timeout: 60000 })
  await page.waitForTimeout(3500)
  const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!needLogin) return 'already'
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
  await page.waitForTimeout(500)
  // 登录工厂 = 测试库(避免往正式库写演示数据)
  const picked = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.el-select')].find((e) => /工厂|登录/.test(e.textContent || ''))
    if (sel) { sel.querySelector('.el-select__wrapper, .el-input')?.click?.(); return 'clicked' }
    return 'not-found'
  })
  await page.waitForTimeout(800)
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item, li')]
      .find((li) => /测试|YJ_TEST/.test(li.textContent || ''))
    if (opt) opt.click()
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  return picked
}

const step1 = await login()
console.log('login=' + step1)

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)

const state = await page.evaluate(() => ({
  hash: location.hash,
  hasSheet: !!document.querySelector('[data-ic-sheet]'),
  factory: (() => {
    const el = [...document.querySelectorAll('*')].find((e) => /YJ_TEST|测试库/.test(e.textContent || '') && (e.className || '').toString().length < 60)
    return el ? el.textContent.trim().slice(0, 40) : ''
  })(),
  topbar: (document.querySelector('.topbar')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: dir + '/shots/round-01-list.png' })
