// 2026-11-14 补充取证:把视口拉到 1600x900 再截「工单排产 / 生产工单」,用来看清表格里确实没有展开列
// 运行:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/wo-flow-expand-remove-20261114/round-02-wide.mjs')"
const OUT = 'C:/Users/vigna/ego/wo-flow-expand-remove-20261114'
const task = await taskSpace('wo-flow-expand-remove-20261114')
const page = task.page('p1')
const BOARD = 'http://localhost:5173/#/prod/plan/workOrderBoard'
const LIST = 'http://localhost:5173/#/prod/plan/workOrderList'

async function wide() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { console.log('restore skip: ' + e.message) }
  try {
    await task.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
  } catch (e) { console.log('emulation skip: ' + e.message) }
  await page.waitForTimeout(800)
}

await page.goto(BOARD, { timeout: 40000 })
await page.waitForTimeout(4000)
if (await page.evaluate(() => !localStorage.getItem('mes_token'))) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入'))
    if (b) b.click()
  })
  await page.waitForTimeout(5500)
  await page.goto(BOARD, { timeout: 40000 })
  await page.waitForTimeout(4000)
}
await wide()
// 选一条有较多未完工工单的线:2号车间(截图里 11000 本线排产)
const picked = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.wb-line')]
  const hit = lines.find((el) => (el.textContent || '').includes('2号车间')) || lines[0]
  if (!hit) return null
  hit.click()
  return (hit.textContent || '').replace(/\s+/g, ' ').trim()
})
await page.waitForTimeout(4500)
await wide()
const info = await page.evaluate(() => ({
  line: (document.querySelector('.wb-ctx-label')?.textContent || '').trim(),
  rows: document.querySelectorAll('.wb-block .el-table__body tr').length,
  expandIcons: document.querySelectorAll('.wb-block .el-table__expand-icon').length,
  expandColumns: document.querySelectorAll('.wb-block .el-table__expand-column').length,
  flowTables: document.querySelectorAll('.wb-flow-tbl, .wol-flow-tbl').length,
}))
console.log('工单排产 ' + picked + ' → ' + JSON.stringify(info))
await page.screenshot({ path: OUT + '/round-04-board-wide.png' })

// 生产工单页(宽视口)
await page.goto(LIST, { timeout: 40000 })
await page.waitForTimeout(7000)
await wide()
const info2 = await page.evaluate(() => ({
  rows: document.querySelectorAll('.wol-table .el-table__body tr').length,
  expandIcons: document.querySelectorAll('.wol-table .el-table__expand-icon').length,
  expandColumns: document.querySelectorAll('.wol-table .el-table__expand-column').length,
  flowTables: document.querySelectorAll('.wb-flow-tbl, .wol-flow-tbl').length,
  curOpTitle: (() => {
    const heads = [...document.querySelectorAll('.wol-table .el-table__header-wrapper th')].map((t) => (t.textContent || '').trim())
    const i = heads.findIndex((h) => h.startsWith('当前工序'))
    const tds = document.querySelectorAll('.wol-table .el-table__body tr')[0]?.querySelectorAll('td')
    return i >= 0 && tds ? (tds[i].querySelector('[title]')?.getAttribute('title') || '') : ''
  })(),
}))
console.log('生产工单 → ' + JSON.stringify(info2, null, 2))
await page.screenshot({ path: OUT + '/round-05-list-wide.png' })
console.log('RESULT: OK')
