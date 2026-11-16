// round-08:点「转工单」→ 确认 → 抓结果提示(期待 1 张工单 / 2 行)
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(500)

const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  if (b && !b.disabled) { b.click(); return (b.innerText || '').trim() }
  return null
})
console.log('转工单 clicked:', clicked)
await page.waitForTimeout(1500)
const boxText = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim())
  return b
})
console.log('confirm box:', JSON.stringify(boxText))
const ok = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-message-box button')]
  const b = btns.find((x) => ['确认', '确定', 'OK'].includes((x.innerText || '').trim()))
  if (b) { b.click(); return (b.innerText || '').trim() }
  return null
})
console.log('confirm clicked:', ok)
await page.waitForTimeout(9000)
const toast = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message__content')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('toast:', JSON.stringify(toast, null, 2))
const after = await page.evaluate(() => ({
  total: (() => { const t = document.body.innerText.match(/共有数据[:：]\s*(\d+)/); return t ? t[1] : null })(),
  remains: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
    .filter((c) => (c[1] || '').startsWith('ZL-20261016-01')).map((c) => c[1].split('\n')[0] + ' #' + c[4]),
}))
console.log('after convert:', JSON.stringify(after, null, 2))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-08-converted.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
