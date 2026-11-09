// round-42:库存报表 / 单据明细 的数量按单位显示(只读)
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

function readTable(page) {
  return page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const headers = [...document.querySelectorAll('.el-table__header th')].map((th) => txt(th).replace('⇅', ''))
    const bodyRows = [...document.querySelectorAll('.el-table__body tbody tr')].filter((tr) => tr.getBoundingClientRect().height > 0)
    const pick = (idx) => (idx >= 0 ? bodyRows.slice(0, 6).map((tr) => txt(tr.children[idx])) : [])
    const idx = (names) => headers.findIndex((h) => names.includes(h))
    return {
      headers,
      qtyCols: headers.filter((h) => /(数量|结存|入库|出库)/.test(h) && !/(单号|金额|单价|单位)/.test(h)),
      unitCols: headers.filter((h) => /(计量单位|主单位|^单位$)/.test(h)),
      values: {
        期初结存: pick(idx(['期初结存'])),
        期末结存: pick(idx(['期末结存'])),
        本期入库: pick(idx(['本期入库'])),
        数量: pick(idx(['数量'])),
        主单位: pick(idx(['主单位'])),
        计量单位: pick(idx(['计量单位', '单位'])),
      },
      rowCount: bodyRows.length,
    }
  })
}

// 库存汇总 / 台账
for (const p of ['STOCK_SUMMARY', 'STOCK_LEDGER']) {
  await page.goto('http://localhost:5173/#/panelx/list/' + p, { timeout: 40000 })
  await page.waitForTimeout(5000)
  await loginIfNeeded()
  await page.waitForTimeout(2000)
  const info = await readTable(page)
  console.log(p + '=' + JSON.stringify(info, null, 2))
}

// 采购订单 kg 行
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(4500)
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-01') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2200)
const po = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const headers = [...document.querySelectorAll('.detail .el-table__header th')].map((th) => txt(th).replace('⇅', ''))
  const tr = document.querySelector('.detail .el-table__body tbody tr')
  const cells = tr ? [...tr.children].map(txt) : []
  const at = (n) => headers.indexOf(n)
  return { headers, qty: cells[at('数量')], unit: cells[at('单位')], price: cells[at('单价')], amount: cells[at('金额')] }
})
console.log('poKg=' + JSON.stringify(po))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-42-unit-display.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }
