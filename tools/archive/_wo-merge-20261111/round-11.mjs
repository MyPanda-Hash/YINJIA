// round-11:重新载入页面(清勾选)→ 勾 #4/#5 → 逐步确认「选择工艺路线」弹窗生效 → 转工单 → 抓提示
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
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
console.log('jumped:', jumped)
await page.waitForTimeout(6000)
const picked = await page.evaluate(() => {
  const out = []
  for (const tr of [...document.querySelectorAll('.el-table__body tr')]) {
    const tds = tr.querySelectorAll('td')
    const doc = (tds[1] || {}).innerText || ''
    const xc = ((tds[4] || {}).innerText || '').trim()
    if (doc.startsWith('ZL-20261016-01') && (xc === '4' || xc === '5')) {
      const cb = tr.querySelector('.el-checkbox')
      if (cb) cb.click()
      out.push(doc.split('\n')[0] + ' #' + xc)
    }
  }
  return out
})
console.log('checked:', JSON.stringify(picked))
await page.waitForTimeout(800)
const btnState = await page.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /选择工艺路线|转工单/.test(x.innerText || '')).map((x) => ({ t: (x.innerText || '').trim(), d: !!x.disabled })))
console.log('buttons:', JSON.stringify(btnState))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1500)
const dlgRows = await page.evaluate(() => ({
  open: !!document.querySelector('.el-dialog'),
  title: (document.querySelector('.el-dialog__title') || {}).innerText,
  rows: [...document.querySelectorAll('.el-dialog .el-table__body tr')].map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()),
}))
console.log('dialog:', JSON.stringify(dlgRows, null, 2).slice(0, 2000))
const clickTarget = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.el-dialog .el-table__body tr')].find((x) => (x.innerText || '').includes('GY-CB-STD'))
  if (!tr) return false
  const td = tr.querySelectorAll('td')[0]
  if (td) td.click()
  tr.click()
  return true
})
await page.waitForTimeout(900)
const okState = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定')
  return b ? { text: (b.innerText || '').trim(), disabled: !!b.disabled } : null
})
console.log('clickTarget:', clickTarget, '确定按钮:', JSON.stringify(okState))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定' && !x.disabled)
  if (b) b.click()
})
await page.waitForTimeout(1600)
const routes = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')]
  .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  .filter((c) => (c[1] || '').startsWith('ZL-20261016-01') && (c[4] === '4' || c[4] === '5'))
  .map((c) => ({ 行号: c[4], 路线: c[15] })))
console.log('routes:', JSON.stringify(routes))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1000)
const toast1 = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
const box = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('toast1:', JSON.stringify(toast1), 'box:', JSON.stringify(box))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => ['确认', '确定'].includes((x.innerText || '').trim()))
  if (b) b.click()
})
await page.waitForTimeout(2000)
const toast2 = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('toast2:', JSON.stringify(toast2))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-11-toast.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
