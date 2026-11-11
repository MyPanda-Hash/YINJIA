// round-14(修订口径):再点一次转工单(只勾第 2 行)→ 应并进 GD-2026-11-0015 同一张工单
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(500)

// 清空勾选
await page.evaluate(() => {
  const th = document.querySelector('.el-table__header .el-checkbox')
  if (th && th.querySelector('input') && th.querySelector('input').checked) th.click()
})
await page.waitForTimeout(700)
const picked = await page.evaluate(() => {
  const out = []
  for (const tr of [...document.querySelectorAll('.el-table__body tr')]) {
    const tds = tr.querySelectorAll('td')
    const doc = (tds[1] || {}).innerText || ''
    const x = ((tds[4] || {}).innerText || '').trim()
    if (doc.startsWith('ZL-20261016-01') && x === '2') {
      const cb = tr.querySelector('.el-checkbox')
      if (cb) cb.click()
      out.push(doc.split('\n')[0] + ' #' + x)
    }
  }
  return out
})
console.log('picked:', JSON.stringify(picked))
await page.waitForTimeout(800)

// 选择工艺路线(逐步取证)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1600)
const dlg = await page.evaluate(() => ({
  open: !!document.querySelector('.el-dialog'),
  rows: [...document.querySelectorAll('.el-dialog .el-table__body tr')].map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()),
}))
console.log('dialog:', JSON.stringify(dlg).slice(0, 1200))
const clicked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.el-dialog .el-table__body tr')].find((x) => (x.innerText || '').includes('GY-CB-STD'))
  if (!tr) return false
  const td = tr.querySelectorAll('td')[0]
  if (td) { td.click(); td.dispatchEvent(new MouseEvent('click', { bubbles: true })) }
  tr.click()
  return true
})
await page.waitForTimeout(1000)
const okBtn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定')
  return b ? { text: (b.innerText || '').trim(), disabled: !!b.disabled } : null
})
console.log('clicked:', clicked, 'okBtn:', JSON.stringify(okBtn))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定' && !x.disabled)
  if (b) b.click()
})
await page.waitForTimeout(1600)
const routes = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')]
  .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  .filter((c) => (c[1] || '').startsWith('ZL-20261016-01') && c[4] === '2')
  .map((c) => ({ 行号: c[4], 路线: c[15] })))
console.log('route now:', JSON.stringify(routes))
console.log('toast route:', JSON.stringify(await toasts()))

// 转工单
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1100)
const box = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => ['确认', '确定'].includes((x.innerText || '').trim()))
  if (b) b.click()
})
await page.waitForTimeout(2400)
console.log('box:', JSON.stringify(box))
console.log('toast after convert:', JSON.stringify(await toasts()))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-14-second-click.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
