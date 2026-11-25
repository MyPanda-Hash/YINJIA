// 第 21 轮:放弃未保存 → 切「已完成」→ 选 ZJ-2026-11-0012 → 只读复核
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')

// 找可见的「不保存」按钮并真实点击
const btnRect = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button, .el-dialog button')]
    .find((x) => (x.textContent || '').trim() === '不保存' && x.getBoundingClientRect().width > 0)
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('不保存 rect: ' + JSON.stringify(btnRect))
if (btnRect) await page.mouse.click(btnRect.x, btnRect.y, { label: '放弃未保存修改' })
await page.waitForTimeout(3000)

const tab = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.dsr-tab')].find((x) => (x.textContent || '').trim() === '已完成')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('已完成 tab: ' + JSON.stringify(tab))
if (tab) await page.mouse.click(tab.x, tab.y, { label: '切换已完成页签' })
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1500)
  const s = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.dsr-tab')].map((b) => `${(b.textContent || '').trim()}${b.className.includes('active') ? '*' : ''}`),
    has: [...document.querySelectorAll('tr')].some((x) => (x.textContent || '').includes('ZJ-2026-11-0012')),
  }))
  console.log(i + ': ' + JSON.stringify(s))
  if (s.has) break
}
const pickRect = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((x) => (x.textContent || '').includes('ZJ-2026-11-0012'))
  if (!tr) return null
  const cell = [...tr.children].find((c) => (c.textContent || '').includes('ZJ-2026-11-0012')) || tr
  const r = cell.getBoundingClientRect()
  return { x: Math.round(r.x + Math.min(40, r.width / 2)), y: Math.round(r.y + r.height / 2) }
})
console.log('row rect: ' + JSON.stringify(pickRect))
if (pickRect) await page.mouse.click(pickRect.x, pickRect.y, { label: '选中出货检验单' })
await page.waitForTimeout(4500)

const dump = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const cell = (td) => {
    if (!td) return null
    const span = td.querySelector('.qr-cell-text')
    const inner = span || td.querySelector('textarea') || td.querySelector('.el-select') || td.querySelector('.qr-row-del') || td.firstElementChild
    const cs = inner ? getComputedStyle(inner) : null
    const r = td.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), align: cs?.textAlign, lh: cs?.lineHeight, ws: cs?.whiteSpace, nl: span ? (span.innerText.match(/\n/g) || []).length : null, v: inner ? (inner.tagName === 'TEXTAREA' ? inner.value : (span ? span.innerText : txt(inner))) : null }
  }
  return {
    editing: !!document.querySelector('.qr-sheet.is-editing'),
    status: txt(document.querySelector('.as-side-status-row')),
    sheetW: Math.round(document.querySelector('.qr-sheet')?.getBoundingClientRect().width || 0),
    batchHead: [...document.querySelectorAll('.c-batchname')].map((th) => ({ text: txt(th), value: txt(th.querySelector('.qr-batch-value')), hasInput: !!th.querySelector('input') })),
    rowHs: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
    rows: rows.map((tr) => [...tr.children].map(cell)),
  }
})
console.log('DUMP ' + JSON.stringify(dump))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-21-readonly.png' })
