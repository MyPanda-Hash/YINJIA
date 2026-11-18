// round-14: 测试库看板 UI 复核:装箱2(新厂) 行的「计划完工日期」已变成 11-23(台账装箱那道被扩)
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6500)
const info = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.wb-line')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30))
  return { lines: lines.filter((x) => x.includes('装箱')), body: (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 120) }
})
console.log(JSON.stringify(info, null, 2))
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('装箱2(新厂)'))
  if (line) line.click()
})
await sleep(5000)
const state = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const rows = [...document.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120))
  const tr = [...document.querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0012'))
  let picked = null
  if (tr) {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    const at = (p) => cells[heads.findIndex((t) => t.startsWith(p))]
    picked = { 开工: at('开工日期'), 计划完工: at('计划完工日期'), 门槛: at('生产状态') }
  }
  return { line: (document.querySelector('.wb-ctx-label') || {}).textContent, heads: heads.filter((t) => /\d{2}-\d{2}/.test(t)), rows: rows.slice(0, 4), picked }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-14-op-ledger-ui.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
