// round-23: 8090 重新登录(正式库,只读)→ 复核联系人=送样人 下拉
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(300)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://127.0.0.1:8090/#/login', { timeout: 90000 })
await T(3500)
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
await T(800)
// 登录工厂选正式库 YINJIA-MES
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select')].find((e) => /工厂/.test(e.textContent || ''))
  if (sel) sel.querySelector('.el-select__wrapper, .el-input')?.click?.()
})
await T(900)
await page.evaluate(() => {
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
  const yj = opts.find((li) => (li.textContent || '').trim() === 'YINJIA-MES') || opts[0]
  if (yj) yj.click()
})
await T(500)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await T(7000)

await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(8000)

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = sheet ? [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r))) : null
  return {
    factory: txt(document.querySelector('.topbar')).slice(0, 50),
    sheet: !!sheet,
    hasSelect: !!tr?.querySelector('.el-select'),
    contact: txt(tr?.querySelector('.el-select') || tr),
  }
})
console.log('info=' + JSON.stringify(info))

if (info.hasSelect) {
  await page.evaluate(() => {
    const sheet = document.querySelector('[data-ic-sheet]')
    const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test((r.textContent || '')))
    tr?.querySelector('.el-select__wrapper')?.click()
  })
  await T(1200)
  const opts = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].map((li) => (li.textContent || '').trim())
    return { total: items.length, head: items.slice(0, 5) }
  })
  console.log('options=' + JSON.stringify(opts))
}
await page.screenshot({ path: dir + '/shots/round-23-8090-contact.png' })
