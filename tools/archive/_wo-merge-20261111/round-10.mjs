// round-10:再勾同一订单的两行(#4/#5)→ 选路线 → 转工单 → 立刻抓提示(验证"张数(行数)"文案 + 第二次转单另取新号)
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(400)
const toastNow = () => page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))

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
await page.waitForTimeout(700)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1300)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.el-dialog .el-table__body tr')].find((tr) => (tr.innerText || '').includes('GY-CB-STD'))
  if (t) t.click()
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定' && !x.disabled)
  if (b) b.click()
})
await page.waitForTimeout(1500)
const routes = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')]
  .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  .filter((c) => (c[1] || '').startsWith('ZL-20261016-01') && (c[4] === '4' || c[4] === '5'))
  .map((c) => ({ 行号: c[4], 路线: c[15] })))
console.log('routes after apply:', JSON.stringify(routes))
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  return { text: (b.innerText || '').trim(), disabled: !!b.disabled }
})
console.log('button:', JSON.stringify(btn))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  if (b && !b.disabled) b.click()
})
await page.waitForTimeout(1200)
console.log('toast after click:', JSON.stringify(await toastNow()))
const box = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('box:', JSON.stringify(box))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => ['确认', '确定'].includes((x.innerText || '').trim()))
  if (b) b.click()
})
await page.waitForTimeout(1800)
console.log('toast after confirm:', JSON.stringify(await toastNow()))
await page.waitForTimeout(2500)
const after = await page.evaluate(() => ({
  total: (() => { const t = document.body.innerText.match(/共有数据[:：]\s*(\d+)/); return t ? t[1] : null })(),
  remains: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())).filter((c) => (c[1] || '').startsWith('ZL-20261016-01')).map((c) => c[4]),
}))
console.log('after:', JSON.stringify(after))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-10-converted.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
