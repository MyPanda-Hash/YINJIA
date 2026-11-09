// round-52:精确按弹窗标题取数 —— ①版式隔离 ②材料码三块收缩 + 按采购订单打印记录打码
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

async function openList() {
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(6000)
  const atLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
  if (atLogin) {
    await page.evaluate(() => {
      const setVal = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const ins = [...document.querySelectorAll('input')]
      setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
      setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
      if (btn) btn.click()
    })
    await page.waitForTimeout(6500)
    await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
    await page.waitForTimeout(6000)
  }
  const picked = await page.evaluate(() => {
    const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0)
    const row = rows.find((r) => t(r).includes('YJ-20261105-01'))
    if (row) { row.scrollIntoView({ block: 'center' }); row.click(); return 'ok' }
    return rows[0] ? 'first:' + t(rows[0]).slice(0, 20) : 'none'
  })
  console.log('pick=' + picked)
  await page.waitForTimeout(2800)
}

const dlgInfo = (prefix) => page.evaluate((p) => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => t(d.querySelector('.el-dialog__title')).startsWith(p))
  if (!dlg) return { open: false }
  return { open: true, title: t(dlg.querySelector('.el-dialog__title')), text: t(dlg).slice(0, 80) }
}, prefix)

const readPup = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => t(d.querySelector('.el-dialog__title')).startsWith('打印采购订单'))
  const body = dlg?.querySelector('.pup')
  if (!body) return { open: false }
  const headers = [...body.querySelectorAll('.el-table__header th')].map(t)
  const rows = [...body.querySelectorAll('.el-table__body tbody tr')].slice(0, 2).map((tr) => [...tr.children].map(t))
  const inputs = [...body.querySelectorAll('.el-table__body tbody tr .el-input-number input')].map((i) => i.value)
  return { headers: headers.slice(0, 12), rows, inputs }
})

// ① 版式隔离
await openList()
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => t(el).startsWith('打印'))
  ;(g?.querySelector('.tb-main') || g?.querySelector('button'))?.click()
})
await page.waitForTimeout(4500)
console.log('有金额=' + JSON.stringify(await readPup(), null, 1))
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => t(d.querySelector('.el-dialog__title')).startsWith('打印采购订单'))
  const btn = [...dlg.querySelectorAll('.el-radio-button')].find((b) => t(b) === '无金额')
  if (btn) btn.click()
})
await page.waitForTimeout(3000)
console.log('无金额=' + JSON.stringify(await readPup(), null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-52-fmt.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(1200)

// ② 材料码
await openList()
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
await page.waitForTimeout(3000)
console.log('mlqTitle=' + JSON.stringify(await dlgInfo('打印材料码')))
const collapses = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  return {
    headers: [...root.querySelectorAll('.mlq-collapse .el-collapse-item .el-collapse-item__header')].map(t),
    active: [...root.querySelectorAll('.mlq-collapse .el-collapse-item.is-active')].length,
  }
})
console.log('collapses=' + JSON.stringify(collapses))

// 展开「打印采购订单记录」
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  it?.querySelector('.el-collapse-item__header')?.click()
})
await page.waitForTimeout(1800)
const poRows = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  return [...(it?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.children].map(t).slice(0, 5))
})
console.log('poRows=' + JSON.stringify(poRows))
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  const btn = [...(it?.querySelectorAll('button') || [])].find((b) => t(b) === '按这次打印打码')
  btn?.click()
})
await page.waitForTimeout(2800)
const applied = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const qty = [...root.querySelectorAll('.el-table__body tbody tr .el-input-number input')].map((i) => i.value)
  const msg = [...document.querySelectorAll('.el-message')].map(t).slice(-2)
  return { qty, msg }
})
console.log('applied=' + JSON.stringify(applied))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-52-label.png' })
