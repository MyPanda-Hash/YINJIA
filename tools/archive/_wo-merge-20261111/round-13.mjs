// round-13(修订口径):同一销售订单分两次点转工单 → 第二次应并进同一张工单号
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
const setRoute = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
    if (b && !b.disabled) b.click()
  })
  await page.waitForTimeout(1300)
  await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.el-dialog .el-table__body tr')].find((x) => (x.innerText || '').includes('GY-CB-STD'))
    if (tr) { const td = tr.querySelectorAll('td')[0]; if (td) td.click(); tr.click() }
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定' && !x.disabled)
    if (b) b.click()
  })
  await page.waitForTimeout(1200)
}
const clearChecks = async () => {
  await page.evaluate(() => {
    const th = document.querySelector('.el-table__header .el-checkbox')
    if (th) {
      const input = th.querySelector('input')
      if (input && input.checked) th.click()
    }
  })
  await page.waitForTimeout(600)
}
const pickRow = async (xc) => page.evaluate((want) => {
  const out = []
  for (const tr of [...document.querySelectorAll('.el-table__body tr')]) {
    const tds = tr.querySelectorAll('td')
    const doc = (tds[1] || {}).innerText || ''
    const x = ((tds[4] || {}).innerText || '').trim()
    if (doc.startsWith('ZL-20261016-01') && x === want) {
      const cb = tr.querySelector('.el-checkbox')
      if (cb) cb.click()
      out.push(doc.split('\n')[0] + ' #' + x)
    }
  }
  return out
}, xc)
const doConvert = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
    if (b && !b.disabled) b.click()
  })
  await page.waitForTimeout(1000)
  const box = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.el-message-box button')].find((x) => ['确认', '确定'].includes((x.innerText || '').trim()))
    if (b) b.click()
  })
  await page.waitForTimeout(2200)
  return { box, toast: await toasts() }
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.goto('http://localhost:5173/?r=' + Date.now() + '#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(6500)
const jumped = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '跳转')
  if (b) { b.click(); return true }
  return false
})
await page.waitForTimeout(5500)
console.log('jumped:', jumped)

// —— 第 1 次:只勾第 1 行 ——
await clearChecks()
console.log('pick#1:', JSON.stringify(await pickRow('1')))
await page.waitForTimeout(700)
await setRoute()
const r1 = await doConvert()
console.log('第一次转单(#1) toast:', JSON.stringify(r1.toast))

// —— 第 2 次(隔一会儿再点,模拟用户真实操作):只勾第 2 行 ——
await page.waitForTimeout(1500)
await clearChecks()
console.log('pick#2:', JSON.stringify(await pickRow('2')))
await page.waitForTimeout(700)
await setRoute()
const r2 = await doConvert()
console.log('第二次转单(#2) toast:', JSON.stringify(r2.toast))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-13-same-order-two-clicks.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
