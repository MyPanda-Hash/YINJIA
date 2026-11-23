// round-55: 鼠标滚轮滚动后逐个点输入框, 填满五段责任人并保存
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(8000)
const row = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001'))
  const r = tr.getBoundingClientRect(); return { x: r.x + 40, y: r.y + r.height / 2 }
})
await page.mouse.click(row.x, row.y, { label: 'select BHC draft' })
await page.waitForTimeout(2500)
const names = ['张三', '李四', '王五', '赵六', '钱七']
const info = async () => page.evaluate(() => ({ vh: window.innerHeight, sy: window.scrollY, inputs: [...document.querySelectorAll('.q-sign-input input')].map((i) => { const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, v: i.value } }) }))
for (let i = 0; i < 5; i++) {
  let s = await info()
  let p = s.inputs[i]
  let tries = 0
  while (p && (p.y < 70 || p.y > s.vh - 40) && tries < 10) {
    const dy = p.y > s.vh - 40 ? 350 : -350
    await page.mouse.move(700, 400, { label: 'hover paper' })
    await page.mouse.wheel(0, dy)
    await page.waitForTimeout(500)
    s = await info()
    p = s.inputs[i]
    tries++
  }
  console.log('input', i, 'after scroll:', JSON.stringify(p))
  if (!p) continue
  await page.mouse.click(p.x, p.y, { label: 'click owner ' + (i + 1) })
  await page.waitForTimeout(250)
  // 全选后覆盖(避免已有值追加)
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(names[i])
  await page.waitForTimeout(250)
}
console.log('values before save:', JSON.stringify((await info()).inputs.map((x) => x.v)))
// 滚回顶部, 侧栏保存按钮(固定在右侧, 但保险起见滚到顶)
await page.mouse.move(700, 300, { label: 'hover page' })
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -500); await page.waitForTimeout(200) }
const save = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.innerText || '').trim() === '保存')
  if (!b) return null
  const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('save:', JSON.stringify(save))
if (save) await page.mouse.click(save.x, save.y, { label: 'click save' })
await page.waitForTimeout(4500)
console.log('msg:', await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((x) => (x.innerText || '').trim()).join(' | ')))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-55-bhc-owners-scroll.png' })
