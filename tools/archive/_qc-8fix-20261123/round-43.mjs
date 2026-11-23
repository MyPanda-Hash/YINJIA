// round-43: 5173(测试库) 真鼠标: 打开草稿→新增检验项×2→添加批次→点批次格输入
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
const rectOfText = (txt) => page.evaluate((txt) => {
  const els = [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && (n.textContent || '').trim() === txt)
  const el = els[0]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
}, txt)
// 左栏点草稿行
const row = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0005'))
  if (!tr) return null
  const r = tr.getBoundingClientRect()
  return { x: r.x + 40, y: r.y + r.height / 2 }
})
console.log('row:', JSON.stringify(row))
if (row) await page.mouse.click(row.x, row.y, { label: 'select QC_PROC_INSP draft' })
await page.waitForTimeout(2500)
const band = await page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim())
console.log('band:', band)
// 鼠标点两次「新增检验项」
for (let i = 0; i < 2; i++) {
  const p = await rectOfText('＋ 新增检验项')
  console.log('add item at', JSON.stringify(p))
  if (p) await page.mouse.click(p.x, p.y, { label: 'click add inspection item' })
  await page.waitForTimeout(900)
}
// 鼠标点「添加批次」
const pb = await rectOfText('＋ 添加批次')
console.log('add batch at', JSON.stringify(pb))
if (pb) await page.mouse.click(pb.x, pb.y, { label: 'click add batch' })
await page.waitForTimeout(1200)
// 坐标: 第一行第二行批次格 textarea
const targets = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  return rows.slice(0, 3).map((tr, ri) => [...tr.querySelectorAll('textarea')].map((ta, ti) => {
    const r = ta.getBoundingClientRect()
    return { ri, ti, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, val: ta.value }
  }))
})
console.log('textareas:', JSON.stringify(targets))
// 第一行最后一个批次格(新批次) + 第一个批次格
const r0 = targets[0] || []
const last = r0[r0.length - 1]
const first = r0[0]
if (first) { await page.mouse.click(first.x, first.y, { label: 'click batch1 result cell' }); await page.keyboard.insertText('鼠标-批1-项目1'); await page.waitForTimeout(500) }
if (last) { await page.mouse.click(last.x, last.y, { label: 'click new batch result cell' }); await page.keyboard.insertText('鼠标-新批次-项目1'); await page.waitForTimeout(500) }
// 第二行项目名格(第一列)
if (targets[1] && targets[1][0]) { await page.mouse.click(targets[1][0].x, targets[1][0].y, { label: 'click item2 name' }); await page.keyboard.insertText('鼠标新增项目'); await page.waitForTimeout(500) }
await page.waitForTimeout(800)
console.log('after typing:', JSON.stringify(await page.evaluate(() => ({
  batchNames: [...document.querySelectorAll('.qr-batch-input input')].map((i) => i.value),
  rows: [...document.querySelectorAll('.qr-grid tbody tr')].map((tr) => ({
    tas: [...tr.querySelectorAll('textarea')].map((t) => t.value),
    va: getComputedStyle(tr.children[0]).verticalAlign,
    taTop: tr.querySelector('textarea') ? Math.round(tr.querySelector('textarea').getBoundingClientRect().top - tr.getBoundingClientRect().top) : null,
  })),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-43-mouse-batch.png' })
