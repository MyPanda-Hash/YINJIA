const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  console.log('window=' + JSON.stringify(w))
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(800)
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { left: 60, top: 40, width: 1500, height: 900 } })
  }
} catch (e) { console.log('bounds err: ' + e.message) }
await page.waitForTimeout(1200)

// 点开处理意见下拉,再用**真实键盘**输入并回车(allow-create 才会真正写回 v-model)
const box = await page.evaluate(() => {
  const td = document.querySelectorAll('.qr-foot-table tr')[1]?.querySelector('td:last-child')
  const s = td?.querySelector('.el-select__wrapper')
  if (!s) return null
  const r = s.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('box=' + JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(700)
  await page.keyboard.press('Control+A')
  await page.keyboard.type('让步接收（手填）')
  await page.waitForTimeout(700)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
}
const st = await page.evaluate(() => {
  const td = document.querySelectorAll('.qr-foot-table tr')[1]?.querySelector('td:last-child')
  const inp = td?.querySelector('input')
  return { val: inp ? inp.value : null }
})
console.log('afterType=' + JSON.stringify(st))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-73-manual.png' })

await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '保存')
  if (b) b.click()
})
const msgs = []
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('msgs=' + JSON.stringify([...new Set(msgs)]))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-73-saved.png' })
