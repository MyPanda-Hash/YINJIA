// round-05: 明确登录到「测试库 YJ_TEST」→ 工单排产 → 切炭2(自动) → 区间外 11-21 格填 10
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
await page.evaluate(() => { localStorage.clear() })
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(2500)
// 打开「登录工厂」下拉(排除语言下拉)并选测试库
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('YINJIA-MES'))
  if (sel) sel.querySelector('.el-select__wrapper').click()
})
await page.waitForTimeout(800)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.offsetParent !== null).map((o) => (o.textContent || '').trim()))
console.log('factory options=' + JSON.stringify(opts))
await page.evaluate(() => {
  const o = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.textContent || '').includes('测试库'))
  if (o) o.click()
})
await page.waitForTimeout(600)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.click('text="进入系统"')
await page.waitForTimeout(4500)
const brand = await page.evaluate(() => (document.querySelector('.um-brand, .layout-brand, header') || {}).textContent || document.body.textContent.slice(0, 200))
console.log('after login url=' + (await page.url()) + ' brand~=' + brand.replace(/\s+/g, ' ').slice(0, 80))
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('切炭2(自动)'))
  if (line) line.click()
})
await page.waitForTimeout(4500)
const state = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th, i) => ({ i, t: (th.textContent || '').replace(/\s+/g, ' ').trim() }))
  const tr = [...document.querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0008'))
  const cells = tr ? [...tr.querySelectorAll('td')].map((td, i) => ({ i, t: (td.textContent || '').replace(/\s+/g, ' ').trim(), out: !!td.querySelector('.dp-out') })) : []
  return { heads, cells, line: (document.querySelector('.wb-ctx-label') || {}).textContent }
})
console.log('line=' + state.line)
console.log('11-21 head=' + JSON.stringify(state.heads.find((h) => h.t.startsWith('11-21'))))
const c21 = state.cells.find((c) => c.i === state.heads.findIndex((h) => h.t.startsWith('11-21')))
console.log('11-21 cell=' + JSON.stringify(c21))
const cCp = state.cells.find((c) => c.i === state.heads.findIndex((h) => h.t.startsWith('计划完工')))
console.log('计划完工 cell=' + JSON.stringify(cCp))
// 打开该格编辑
await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const ci = heads.findIndex((t) => t.startsWith('11-21'))
  const tr = [...document.querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0008'))
  const span = tr.querySelectorAll('td')[ci].querySelector('span')
  if (span) span.click()
})
await page.waitForTimeout(1000)
const opened = await page.evaluate(() => !!document.querySelector('.dp-input input'))
console.log('editor opened=' + opened)
if (opened) {
  await page.evaluate(() => {
    const inp = document.querySelector('.dp-input input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '10')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
  })
  await page.waitForTimeout(3500)
}
const after = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const tr = [...document.querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0008'))
  const cells = tr ? [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()) : []
  const at = (prefix) => cells[heads.findIndex((t) => t.startsWith(prefix))]
  return {
    msg: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
    开工: at('11-03'), 完工: at('11-19'), 计划完工: at('计划完工'),
    格_11_21: at('11-21'),
  }
})
console.log(JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-05-oob-fill.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
