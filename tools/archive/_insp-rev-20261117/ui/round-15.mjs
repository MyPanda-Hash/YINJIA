// round-15: 8090 打包版只读复核(正式账套,不保存任何东西)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(400)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://127.0.0.1:8090/', { timeout: 90000 })
await T(4000)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log('needLogin=' + needLogin)
if (needLogin) {
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
  await T(600)
  // 选正式库工厂 YJ
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.el-select')].find((e) => /工厂|登录/.test(e.textContent || ''))
    if (sel) sel.querySelector('.el-select__wrapper, .el-input')?.click?.()
  })
  await T(900)
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item, li')]
    const yj = opts.find((li) => (li.textContent || '').trim() === 'YINJIA-MES') || opts[0]
    if (yj) yj.click()
  })
  await T(500)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await T(6000)
}

await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(7000)

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  return {
    factory: txt(document.querySelector('.topbar')).slice(0, 80),
    meta: txt(sheet?.querySelector('.ic-meta')),
    optTexts: [...(sheet?.querySelectorAll('.ic-opt-text') || [])].map((e) => txt(e)).slice(0, 12),
    handle: txt([...sheet.querySelectorAll('tbody > tr')].find((tr) => /样品处理方式/.test(txt(tr))) || null).slice(0, 120),
    editable: !!sheet && sheet.className.includes('is-editing'),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: dir + '/shots/round-15-8090.png' })
