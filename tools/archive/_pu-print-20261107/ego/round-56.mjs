// round-56:①材料码三块收缩 + 采购订单打印记录 + 按它打码 ②两版式对应单号 + 对着打印
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()

async function freshLogin() {
  await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
  await page.waitForTimeout(2500)
  const ok = await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
    })
    const j = await r.json().catch(() => null)
    if (j?.data?.token) { localStorage.setItem('mes_token', j.data.token); return true }
    return false
  })
  await page.reload()
  await page.waitForTimeout(4500)
  return ok
}
async function openOrder() {
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(5500)
  const picked = await page.evaluate(() => {
    const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0)
    const row = rows.find((r) => t(r).includes('YJ-20261105-01'))
    if (row) { row.scrollIntoView({ block: 'center' }); row.click(); return 'ok' }
    return rows[0] ? 'first' : 'none'
  })
  await page.waitForTimeout(2600)
  return picked
}
async function openMaterial() {
  await page.evaluate(() => {
    const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const g = [...document.querySelectorAll('.tb-group')].find((el) => t(el).startsWith('打印'))
    g?.querySelector('.tb-caret')?.click()
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const it = [...document.querySelectorAll('.ctx-item, .el-dropdown-menu__item')].find((el) => t(el) === '打印材料码')
    it?.click()
  })
  await page.waitForSelector('.mlq', { state: 'visible', timeout: 15000 })
  await page.waitForTimeout(3500)
}

console.log('login=' + await freshLogin())
console.log('pick=' + await openOrder())
await openMaterial()
const mlq = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  return {
    title: t(document.querySelector('.el-dialog__title')),
    collapses: [...root.querySelectorAll('.mlq-collapse .el-collapse-item .el-collapse-item__header')].map(t),
    rows: root.querySelectorAll('.el-table__body tbody tr').length,
    qty: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
  }
})
console.log('mlq=' + JSON.stringify(mlq, null, 1))
// 展开采购订单打印记录
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  it?.querySelector('.el-collapse-item__header')?.click()
})
await page.waitForTimeout(1600)
const poRows = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  return [...(it?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.children].map(t).slice(0, 6))
})
console.log('poRows=' + JSON.stringify(poRows))
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  const btn = [...(it?.querySelectorAll('button') || [])].find((b) => t(b) === '按这次打印打码')
  btn?.click()
})
await page.waitForTimeout(2500)
const applied = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  return { qty: [...root.querySelectorAll('.el-table__body tbody tr .el-input-number input')].map((i) => i.value), msg: [...document.querySelectorAll('.el-message')].map(t).slice(-2) }
})
console.log('applied=' + JSON.stringify(applied))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-56-label.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(1200)

// ② 打印采购订单:记录/对应单号/对着打印
await openOrder()
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => t(el).startsWith('打印'))
  ;(g?.querySelector('.tb-main') || g?.querySelector('button'))?.click()
})
await page.waitForTimeout(4000)
const recs = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => t(d.querySelector('.el-dialog__title')).startsWith('打印采购订单'))
  const rows = [...dlg.querySelectorAll('.pup-rec-table .el-table__body tbody tr')].map((tr) => [...tr.children].map(t))
  return { rows }
})
console.log('records=' + JSON.stringify(await recs(), null, 1))
// 对 MP-2026-11-0010 点「打有金额版」
const clicked = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => t(d.querySelector('.el-dialog__title')).startsWith('打印采购订单'))
  const rows = [...dlg.querySelectorAll('.pup-rec-table .el-table__body tbody tr')]
  const row = rows.find((tr) => t(tr).includes('MP-2026-11-0010'))
  const btn = [...(row?.querySelectorAll('button') || [])].find((b) => t(b) === '打有金额版')
  btn?.click()
  return t(row).slice(0, 60)
})
console.log('twinClick=' + clicked)
await page.waitForTimeout(3500)
console.log('afterTwin=' + JSON.stringify(await recs(), null, 1))
console.log('msgs=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()).slice(-3))))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-56-twin.png' })
