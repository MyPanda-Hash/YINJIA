// 2026-11-13 round-11:终验取证(带入口 bust,确保加载新构建)—— zh 两页 + en 两页 + 编辑预填
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8091'
const SHOT = 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/'
const errors = []
try { page.on?.('pageerror', (e) => errors.push(String(e?.message || e))) } catch { /* ignore */ }
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function gotoHash(path) {
  await page.evaluate((p) => { location.href = '/index.html?bust=' + Date.now() + '#' + p }, path)
  await page.waitForTimeout(8000)
  await restoreWindow()
  if (await page.evaluate(() => !!document.querySelector('input[type="password"]'))) {
    console.log('login required at ' + path)
    await page.evaluate(() => {
      const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
      const ins = [...document.querySelectorAll('input')]
      setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
      setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
      document.querySelector('.login-form .el-select')?.click()
    })
    await page.waitForTimeout(1200)
    await page.evaluate(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]; const el = items.find((x) => { const t = (x.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') }); if (el) el.click() })
    await page.waitForTimeout(500)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
    await page.waitForTimeout(6500)
    await page.evaluate((p) => { location.href = '/index.html?bust=' + Date.now() + '#' + p }, path)
    await page.waitForTimeout(8000)
    await restoreWindow()
  }
}
async function pickLine(name) {
  await page.evaluate((n) => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(n))
    if (el) el.click()
  }, name)
  await page.waitForTimeout(3500)
}
async function boardSnap() {
  return page.evaluate(() => {
    const bar = document.querySelector('.wb-short-bar')
    return {
      build: document.querySelector('script[type="module"]')?.getAttribute('src') || '',
      banner: bar ? (bar.textContent || '').replace(/\s+/g, ' ').trim() : '',
      title: bar ? (bar.getAttribute('title') || '').slice(0, 300) : '',
      red: document.querySelectorAll('.dp-plan.short').length,
      cells: [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row td .dp-plan')].slice(0, 4).map((el) => ({ t: (el.textContent || '').trim(), title: el.getAttribute('title') })),
    }
  })
}
async function switchLocale(re) {
  await page.evaluate(() => document.querySelector('.locale-switch')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.waitForTimeout(900)
  const r = await page.evaluate((rx) => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]
    const el = items.find((x) => new RegExp(rx, 'i').test(x.textContent || ''))
    if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'ok' }
    return 'not-found'
  }, re)
  await page.waitForTimeout(2200)
  return r
}
async function listSnap() {
  return page.evaluate(() => {
    const bar = document.querySelector('.wol-short')
    return {
      banner: bar ? (bar.textContent || '').replace(/\s+/g, ' ').trim() : '',
      red: document.querySelectorAll('.dp-plan.short').length,
      sample: [...document.querySelectorAll('.dp-plan')].slice(0, 3).map((e) => (e.textContent || '').trim()),
    }
  })
}

// A) zh 工单排产:3号车间 / 1号车间
await gotoHash('/prod/plan/workOrderBoard')
await pickLine('3号车间')
console.log('ZH board 3=' + JSON.stringify(await boardSnap()))
await page.screenshot({ path: SHOT + 'final-01-board-3shop.png' })
await pickLine('1号车间')
console.log('ZH board 1=' + JSON.stringify(await boardSnap()))
await page.screenshot({ path: SHOT + 'final-02-board-1shop.png' })

// B) zh 生产工单
await gotoHash('/prod/plan/workOrderList')
console.log('ZH list=' + JSON.stringify(await listSnap()))
await page.screenshot({ path: SHOT + 'final-03-list.png' })

// C) EN 工单排产 + 生产工单
console.log('switch en=' + (await switchLocale('English')))
await gotoHash('/prod/plan/workOrderBoard')
await pickLine('1号车间')
console.log('EN board 1=' + JSON.stringify(await boardSnap()))
await page.screenshot({ path: SHOT + 'final-04-board-en.png' })
await gotoHash('/prod/plan/workOrderList')
console.log('EN list=' + JSON.stringify(await listSnap()))
await page.screenshot({ path: SHOT + 'final-05-list-en.png' })

// D) 回中文
console.log('switch zh=' + (await switchLocale('简体中文')))
console.log('PAGE_ERRORS=' + JSON.stringify(errors.slice(0, 8)))
console.log('DONE')
