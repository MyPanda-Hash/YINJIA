// round-54: 真鼠标: QC_BHC 五段责任人分别输入 + 保存 + 重开核对
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(8000)
const row = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001'))
  if (!tr) return null
  const r = tr.getBoundingClientRect()
  return { x: r.x + 40, y: r.y + r.height / 2 }
})
console.log('row:', JSON.stringify(row))
if (row) await page.mouse.click(row.x, row.y, { label: 'select BHC draft' })
await page.waitForTimeout(2500)
const inputs = await page.evaluate(() => [...document.querySelectorAll('.q-sign-input input')].map((i) => {
  const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, v: i.value }
}))
console.log('sign inputs:', JSON.stringify(inputs))
const names = ['张三', '李四', '王五', '赵六', '钱七']
for (let i = 0; i < inputs.length && i < names.length; i++) {
  await page.mouse.click(inputs[i].x, inputs[i].y, { label: 'click owner ' + (i + 1) })
  await page.waitForTimeout(200)
  await page.keyboard.insertText(names[i])
  await page.waitForTimeout(250)
}
console.log('inputs after typing:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.q-sign-input input')].map((i) => i.value))))
const save = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.innerText || '').trim() === '保存')
  if (!b) return null
  const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('save btn:', JSON.stringify(save))
if (save) await page.mouse.click(save.x, save.y, { label: 'click save' })
await page.waitForTimeout(4500)
console.log('msg:', await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((x) => (x.innerText || '').trim()).join(' | ')))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-54-bhc-owners-mouse.png' })
