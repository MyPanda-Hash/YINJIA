// round-15(修订口径):用真实鼠标点选路线弹窗的 GY-CB-STD → 确定 → 转工单(只勾第 2 行)
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(500)
// 关掉可能残留的弹窗
await page.evaluate(() => { document.querySelectorAll('.el-overlay').forEach((o) => { if (o.style.display !== 'none') o.querySelector('.el-dialog__headerbtn, .el-message-box__headerbtn')?.click() }) })
await page.waitForTimeout(800)

const state = await page.evaluate(() => ({
  checkedCount: [...document.querySelectorAll('.el-table__body .el-checkbox input')].filter((i) => i.checked).length,
  row2: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())).filter((c) => (c[1] || '').startsWith('ZL-20261016-01') && c[4] === '2'),
}))
console.log('state:', JSON.stringify(state))

// 确保只勾第 2 行
await page.evaluate(() => {
  const th = document.querySelector('.el-table__header .el-checkbox')
  if (th && th.querySelector('input') && th.querySelector('input').checked) th.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  for (const tr of [...document.querySelectorAll('.el-table__body tr')]) {
    const tds = tr.querySelectorAll('td')
    if (((tds[1] || {}).innerText || '').startsWith('ZL-20261016-01') && ((tds[4] || {}).innerText || '').trim() === '2') {
      tr.querySelector('.el-checkbox')?.click()
    }
  }
})
await page.waitForTimeout(800)

// 打开路线弹窗
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1600)
const rect = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.el-dialog .el-table__body tr')].find((x) => (x.innerText || '').includes('GY-CB-STD'))
  if (!tr) return null
  tr.scrollIntoView({ block: 'center' })
  const r = tr.getBoundingClientRect()
  return { x: Math.round(r.x + Math.min(120, r.width / 2)), y: Math.round(r.y + r.height / 2) }
})
console.log('route row rect:', JSON.stringify(rect))
if (rect) { await page.mouse.click(rect.x, rect.y); await page.waitForTimeout(900) }
const okState = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { disabled: !!b.disabled, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('ok button:', JSON.stringify(okState))
if (okState && !okState.disabled) { await page.mouse.click(okState.x, okState.y); await page.waitForTimeout(1600) }
const afterRoute = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')]
  .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  .filter((c) => (c[1] || '').startsWith('ZL-20261016-01') && c[4] === '2')
  .map((c) => ({ 行号: c[4], 路线: c[15] })))
console.log('route now:', JSON.stringify(afterRoute), 'toast:', JSON.stringify(await toasts()))

// 转工单
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { text: (b.innerText || '').trim(), disabled: !!b.disabled, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('convert button:', JSON.stringify(btn))
if (btn && !btn.disabled) { await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(1200) }
const box = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('box:', JSON.stringify(box))
const okBox = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => ['确认', '确定'].includes((x.innerText || '').trim()))
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
if (okBox) { await page.mouse.click(okBox.x, okBox.y); await page.waitForTimeout(2400) }
console.log('toast after convert:', JSON.stringify(await toasts()))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-15-append-same-wo.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
