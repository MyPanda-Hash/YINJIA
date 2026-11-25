// 第 19 轮:真实鼠标点「已完成」页签(坐标) + 选 ZJ-2026-11-0012 → 只读复核
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const rect = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.dsr-tab')].find((x) => (x.textContent || '').trim() === '已完成')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('tab rect: ' + JSON.stringify(rect))
if (rect) await page.mouse.click(rect.x, rect.y, { label: '切换已完成页签' })
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1500)
  const s = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.dsr-tab')].map((b) => `${(b.textContent || '').trim()}${b.className.includes('active') ? '*' : ''}`),
    has: [...document.querySelectorAll('tr')].some((x) => (x.textContent || '').includes('ZJ-2026-11-0012')),
    first: [...document.querySelectorAll('tbody tr')].slice(0, 3).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
  }))
  console.log(i + ': ' + JSON.stringify(s))
  if (s.has) break
}
const picked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((x) => (x.textContent || '').includes('ZJ-2026-11-0012'))
  if (!tr) return false
  const cell = [...tr.children].find((c) => (c.textContent || '').includes('ZJ-2026-11-0012'))
  ;(cell || tr).click()
  return true
})
console.log('pick: ' + picked)
await page.waitForTimeout(4000)
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
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-19-readonly.png' })
