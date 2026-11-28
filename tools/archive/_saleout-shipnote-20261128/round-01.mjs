// round-01:登录(工厂 YJ)→ 打开 销售出库单 列表 → 看工具栏「打印」下拉里有没有「出货单」
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')

const log = (...a) => console.log(...a)

await page.goto('http://localhost:5173/#/panelx/list/SALE_OUT', { timeout: 30000 })
await page.waitForTimeout(3500)

// ── 登录(会话过期时)──
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
log('needLogin=', needLogin)
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(600)
  // 登录工厂:YJ = 正式库
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.el-select')].find((el) => /工厂/.test(el.textContent || ''))
    if (sel) sel.querySelector('.el-select__wrapper,.el-input__wrapper')?.click()
  })
  await page.waitForTimeout(900)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el) => (el.textContent || '').trim()))
  log('工厂选项=', JSON.stringify(opts))
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const yj = items.find((el) => /正式|YJ(?!_)/.test(el.textContent || '')) || items[0]
    yj?.click()
  })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://localhost:5173/#/panelx/list/SALE_OUT', { timeout: 30000 })
  await page.waitForTimeout(4000)
}

// 恢复窗口再截图
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip:', e.message) }

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.el-table__body tr')].slice(0, 6).map(txt)
  const bar = [...document.querySelectorAll('.side button, .btn-bar button, .toolbar button, .side-bar button')].map(txt)
  return {
    hash: location.hash,
    title: txt(document.querySelector('.panel-title, .title, .body .dt-head')),
    rows,
    buttonsAll: [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 60),
    bar,
  }
})
log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-01-list.png' })
