// round-07:勾选 ZL-20261016-01 的第 1、2 行 → 选择工艺路线(已审核的 GY-CB-STD)
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(600)

// 1) 勾选两行
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tr')]
  const out = []
  for (const tr of rows) {
    const tds = tr.querySelectorAll('td')
    const doc = (tds[1] || {}).innerText || ''
    const xc = ((tds[4] || {}).innerText || '').trim()
    if (doc.startsWith('ZL-20261016-01') && (xc === '1' || xc === '2')) {
      const cb = tr.querySelector('.el-checkbox')
      if (cb) cb.click()
      out.push(doc.split('\n')[0] + ' #' + xc)
    }
  }
  return out
})
console.log('checked:', JSON.stringify(picked, null, 2))
await page.waitForTimeout(800)

// 2) 打开「选择工艺路线」弹窗
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
  if (b && !b.disabled) { b.click(); return true }
  return false
})
console.log('route dialog opened:', opened)
await page.waitForTimeout(1500)
const dlg = await page.evaluate(() => ({
  title: (document.querySelector('.el-dialog__title') || {}).innerText,
  rows: [...document.querySelectorAll('.el-dialog .el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).join(' | ')).slice(0, 20),
}))
console.log('dialog:', JSON.stringify(dlg, null, 2).slice(0, 4000))
// 3) 选中 GY-CB-STD 那一行 → 确定
const applied = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-dialog .el-table__body tr')]
  const target = rows.find((tr) => (tr.innerText || '').includes('GY-CB-STD'))
  if (!target) return 'no GY-CB-STD row'
  target.click()
  return 'row clicked'
})
console.log('pick:', applied)
await page.waitForTimeout(600)
const confirmed = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')]
  const b = btns.find((x) => (x.innerText || '').trim() === '确定' && !x.disabled)
  if (b) { b.click(); return true }
  return false
})
console.log('confirmed:', confirmed)
await page.waitForTimeout(1500)
const after = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tr')]
  return rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
    .filter((c) => (c[1] || '').startsWith('ZL-20261016-01') && (c[4] === '1' || c[4] === '2'))
    .map((c) => ({ 订单资料: c[1].split('\n')[0], 行号: c[4], 工艺路线: c[15] }))
})
console.log('after route:', JSON.stringify(after, null, 2))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-07-route.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
