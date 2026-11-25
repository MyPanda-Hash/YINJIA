// 第 23 轮:宽视口只读态(已审核)—— 批次号是否印在纸上 + 五列一套居中 + 判定可见
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
const tab = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.dsr-tab')].find((x) => (x.textContent || '').trim() === '已完成')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
if (tab) await page.mouse.click(tab.x, tab.y, { label: '切换已完成页签' })
let rect = null
for (let i = 0; i < 8 && !rect; i++) {
  await page.waitForTimeout(1500)
  rect = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tr')].find((x) => (x.textContent || '').includes('ZJ-2026-11-0012'))
    if (!tr) return null
    const cell = [...tr.children].find((c) => (c.textContent || '').includes('ZJ-2026-11-0012')) || tr
    const r = cell.getBoundingClientRect()
    return { x: Math.round(r.x + Math.min(30, r.width / 2)), y: Math.round(r.y + r.height / 2) }
  })
}
console.log('row rect: ' + JSON.stringify(rect))
if (rect) await page.mouse.click(rect.x, rect.y, { label: '选中已审核出货检验单' })
await page.waitForTimeout(4500)
const dump = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const cell = (td) => {
    if (!td) return null
    const span = td.querySelector('.qr-cell-text')
    const inner = span || td.querySelector('textarea') || td.querySelector('.el-select') || td.querySelector('.qr-row-del') || td.firstElementChild
    const cs = inner ? getComputedStyle(inner) : null
    return { align: cs?.textAlign, lh: cs?.lineHeight, tag: inner?.tagName, v: span ? span.innerText : txt(inner) }
  }
  return {
    editing: !!document.querySelector('.qr-sheet.is-editing'),
    status: txt(document.querySelector('.as-side-status-row')),
    sheetW: Math.round(document.querySelector('.qr-sheet')?.getBoundingClientRect().width || 0),
    batchHead: [...document.querySelectorAll('.c-batchname')].map((th) => ({ text: txt(th), hasInput: !!th.querySelector('input') })),
    foot: [...document.querySelectorAll('.qr-foot-table .qr-value')].map(txt),
    rows: rows.map((tr) => [...tr.children].map(cell)),
  }
})
console.log('DUMP ' + JSON.stringify(dump))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-23-readonly.png' })
