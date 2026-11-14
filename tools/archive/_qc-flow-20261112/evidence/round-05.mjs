// round-05.mjs — 管理员(正式账套 YJ)看板/列表终验:显式切 hash,逐步打印,双视图截图
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')

console.log('start url =', await page.url())
const session = await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}')
  return { isAdmin: u.isAdmin, factory: u.factory, visible: (u.visiblePanels || []).slice(0, 3), token: !!localStorage.getItem('mes_token') }
})
console.log('session =', JSON.stringify(session))

// 显式改 hash(不 reload),让路由把页面切过去
await page.evaluate(() => { location.hash = '#/qc/flowMonitor' })
await page.waitForTimeout(4500)
console.log('after hash =', await page.evaluate(() => location.hash))

let state = await page.evaluate(() => ({
  hash: location.hash,
  hasBoard: !!document.querySelector('.qcf-board'),
  rows: document.querySelectorAll('.qcf-grid-row').length,
}))
if (!state.hasBoard) {
  // 还没到位就整页重载一次再等
  await page.goto('http://localhost:5173/#/qc/flowMonitor', { timeout: 60000 })
  await page.reload()
  await page.waitForTimeout(5000)
  state = await page.evaluate(() => ({
    hash: location.hash,
    hasBoard: !!document.querySelector('.qcf-board'),
    rows: document.querySelectorAll('.qcf-grid-row').length,
  }))
}
console.log('board state =', JSON.stringify(state))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const board = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const r = document.querySelector('.qcf-grid-row')
  return {
    hash: location.hash,
    title: text(document.querySelector('.qcf-title')),
    datatime: text(document.querySelector('.qcf-datatime')),
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    head: [...document.querySelectorAll('.qcf-grid-head span')].map(text),
    rows: document.querySelectorAll('.qcf-grid-row').length,
    firstRow: r ? {
      batch: text(r.querySelector('.qcf-batch')),
      kv: [...r.querySelectorAll('.qcf-kv')].map(text),
      nodes: [...r.querySelectorAll('.qcf-node')].map((n) => text(n)),
      stage: text(r.querySelector('.qcf-stage-tag')),
      days: text(r.querySelector('.qcf-days')),
    } : null,
    menu: [...document.querySelectorAll('.el-menu-item, .nav-item, a')].map(text).filter((t) => t === '品质流程监控').length,
  }
})
console.log('board =', JSON.stringify(board, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-05-board-prod.png' })

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.qcf-view .el-radio-button__inner')].find((b) => (b.textContent || '').includes('列表'))
  if (btn) btn.click()
})
await page.waitForTimeout(1800)
const list = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const r = document.querySelector('.qcf-table .el-table__row')
  return {
    cols: [...document.querySelectorAll('.qcf-table th .cell')].map(text),
    rows: document.querySelectorAll('.qcf-table .el-table__row').length,
    firstRow: r ? [...r.querySelectorAll('td .cell')].map(text) : null,
  }
})
console.log('list =', JSON.stringify(list, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-05-list-prod.png' })
console.log('done')
