// 第 18 轮:点「已完成」后轮询列表,直到出现 ZJ-2026-11-0012 再选它
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const tabState = async () => page.evaluate(() => [...document.querySelectorAll('.dsr-tab')].map((b) => ({
  t: (b.textContent || '').trim(), cls: b.className, active: b.getAttribute('aria-selected'),
})))
console.log('tabs before: ' + JSON.stringify(await tabState()))
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.dsr-tab')].find((b) => (b.textContent || '').trim() === '已完成')
  if (el) el.click()
})
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(1500)
  const s = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.dsr-tab')].map((b) => `${(b.textContent || '').trim()}${b.className.includes('active') ? '*' : ''}`),
    count: (document.querySelector('.dsr-count, [class*="count"]')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
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
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-18-readonly.png' })
