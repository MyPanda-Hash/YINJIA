// round-43:金蝶补拉后界面回验 —— 采购订单/销售订单新单是否已审核、明细数量/单位/金额是否齐全
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

async function loginIfNeeded() {
  const atLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
  if (!atLogin) return
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
  await page.waitForTimeout(6000)
}

async function railTop(panel) {
  await page.goto('http://localhost:5173/#/panelx/list/' + panel, { timeout: 40000 })
  await page.waitForTimeout(5000)
  await loginIfNeeded()
  await page.waitForTimeout(3000)
  const top = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0).slice(0, 8)
    return rows.map((r) => txt(r).slice(0, 120))
  })
  console.log(panel + ' 最近 8 行:\n' + top.map((x) => '  ' + x).join('\n'))
  return top
}

// ① 采购订单列表(新单 YJ-20261105-xx 应带「已审核」)
const pu = await railTop('PU_ORDER')
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261105-05') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)
const puDetail = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const headers = [...document.querySelectorAll('.detail .el-table__header th')].map((th) => txt(th).replace('⇅', ''))
  const tr = document.querySelector('.detail .el-table__body tbody tr')
  const cells = tr ? [...tr.children].map(txt) : []
  const at = (n) => headers.indexOf(n)
  return {
    status: txt(document.querySelector('.doc-rail-main, .head-status, .el-tag')),
    qty: cells[at('数量')], unit: cells[at('单位')], price: cells[at('单价')], amount: cells[at('金额')],
  }
})
console.log('PO YJ-20261105-05 明细首行=' + JSON.stringify(puDetail))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-43-po.png' })

// ② 销售订单
await railTop('SO_ORDER')
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('LYZ-20261107-01') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)
const soDetail = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const headers = [...document.querySelectorAll('.detail .el-table__header th')].map((th) => txt(th).replace('⇅', ''))
  const tr = document.querySelector('.detail .el-table__body tbody tr')
  const cells = tr ? [...tr.children].map(txt) : []
  const at = (n) => headers.indexOf(n)
  return { qty: cells[at('数量')], unit: cells[at('销售单位')], price: cells[at('单价')], amount: cells[at('金额')] }
})
console.log('SO LYZ-20261107-01 明细首行=' + JSON.stringify(soDetail))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-43-so.png' })
