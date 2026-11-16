// round-16(修订口径):路线弹窗用「双击行」直接应用(@row-dblclick=applyRoute)→ 再转工单(只勾第 2 行)
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(400)
await page.evaluate(() => document.querySelectorAll('.el-overlay').forEach((o) => { const b = o.querySelector('.el-dialog__headerbtn, .el-message-box__headerbtn'); if (b) b.click() }))
await page.waitForTimeout(900)

// 只勾第 2 行
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
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1700)
const rows = await page.evaluate(() => [...document.querySelectorAll('.el-dialog .el-table__body tr')].map((tr) => {
  const r = tr.getBoundingClientRect()
  return { t: (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20), cur: tr.classList.contains('current-row'), x: Math.round(r.x + 80), y: Math.round(r.y + r.height / 2) }
}))
console.log('rows:', JSON.stringify(rows))
const target = rows.find((r) => r.t.includes('GY-CB-STD'))
if (target) {
  await page.dblclick(target.x, target.y)
  await page.waitForTimeout(1500)
}
const st = await page.evaluate(() => ({
  dialogOpen: !!document.querySelector('.el-dialog'),
  routes: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())).filter((c) => (c[1] || '').startsWith('ZL-20261016-01') && c[4] === '2').map((c) => c[15]),
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()),
}))
console.log('after dblclick:', JSON.stringify(st))
if (st.dialogOpen) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定' && !x.disabled)
    if (b) b.click()
  })
  await page.waitForTimeout(1200)
}
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { text: (b.innerText || '').trim(), disabled: !!b.disabled, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('convert btn:', JSON.stringify(btn))
if (btn && !btn.disabled) { await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(1200) }
const box = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('box:', JSON.stringify(box))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => ['确认', '确定'].includes((x.innerText || '').trim()))
  if (b) b.click()
})
await page.waitForTimeout(2500)
console.log('toast after convert:', JSON.stringify(await toasts()))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-16-append.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
