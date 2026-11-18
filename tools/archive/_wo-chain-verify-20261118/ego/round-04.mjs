// round-04: 测试库登录 → 工单排产 → 切炭2(自动) → GD-2026-11-0008 行1 → 在区间外(11-21)格填 10
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
// 清登录态,回登录页(默认工厂=YINJIA-MES·测试库)
await page.evaluate(() => { localStorage.clear() })
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(2500)
const factoryText = await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')]
  const hit = sels.find((s) => (s.textContent || '').includes('YINJIA-MES'))
  return hit ? (hit.textContent || '').trim() : ''
})
console.log('factory=' + factoryText)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.click('text="进入系统"')
await page.waitForTimeout(4000)
console.log('url=' + (await page.url()))
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
// 选线:切炭2(自动)
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('切炭2(自动)'))
  if (line) line.click()
})
await page.waitForTimeout(4500)
const state = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th, i) => ({ i, t: (th.textContent || '').replace(/\s+/g, ' ').trim() }))
  const rows = [...document.querySelectorAll('.el-table__body tr')].map((tr, r) => ({ r, t: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) }))
  return { line: (document.querySelector('.wb-ctx-label') || {}).textContent, heads: heads.slice(0, 40), rows }
})
const dateIdx = state.heads.find((h) => h.t.startsWith('11-21'))
console.log('11-21 col=' + JSON.stringify(dateIdx))
const target = state.rows.find((x) => x.t.includes('GD-2026-11-0008'))
console.log('target row=' + JSON.stringify(target))
console.log('rows=' + JSON.stringify(state.rows.slice(0, 6)))
// 点 11-21 那格(区间外 ⇒ 斜杠)
if (dateIdx && target) {
  await page.evaluate(({ r, c }) => {
    const tr = document.querySelectorAll('.el-table__body tr')[r]
    const td = tr.querySelectorAll('td')[c]
    const span = td.querySelector('span')
    if (span) span.click()
  }, { r: target.r, c: dateIdx.i })
  await page.waitForTimeout(1200)
  const hasInput = await page.evaluate(() => !!document.querySelector('.dp-input input'))
  console.log('input opened=' + hasInput)
  if (hasInput) {
    await page.fill('.dp-input input', '10')
    await page.press('.dp-input input', 'Enter')
    await page.waitForTimeout(3000)
  }
  const after = await page.evaluate(() => ({
    msg: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
    row: (() => {
      const tr = [...document.querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0008'))
      if (!tr) return null
      const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
      const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
      const pick = (name) => cells[heads.findIndex((h) => h.startsWith(name))]
      return { 开工: pick('11-03'), 完工: pick('11-19'), 全部: cells.slice(0, 3) }
    })(),
    heads: [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.includes('11-')).slice(0, 20),
  }))
  console.log(JSON.stringify(after, null, 2))
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-04-oob-fill.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
