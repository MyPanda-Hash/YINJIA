// 第 11 轮:切「已完成」→ 选 ZJ-2026-11-0012 → 只读态取证(批次号/对齐/换行)
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const txtFn = `(el) => (el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '')`

const clickTab = async (label) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('span, div, button, a')].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === t)
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    if (!el) return false
    el.click()
    return true
  }, label)
  await page.waitForTimeout(2500)
  return ok
}
console.log('tab 已完成: ' + (await clickTab('已完成')))

const picked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((x) => (x.textContent || '').includes('ZJ-2026-11-0012'))
  if (!tr) return { ok: false, rows: [...document.querySelectorAll('tbody tr')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8) }
  ;[...tr.children][1]?.click() || tr.click()
  return { ok: true }
})
console.log('pick: ' + JSON.stringify(picked))
await page.waitForTimeout(4000)

const dump = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const cell = (td) => {
    if (!td) return null
    const span = td.querySelector('.qr-cell-text')
    const inner = span || td.querySelector('.el-select') || td.querySelector('.el-input') || td.querySelector('.qr-row-del') || td.firstElementChild
    const ir = inner ? inner.getBoundingClientRect() : null
    const r = td.getBoundingClientRect()
    const cs = inner ? getComputedStyle(inner) : null
    const rcs = getComputedStyle(td)
    return {
      cw: Math.round(r.width), ch: Math.round(r.height), ih: ir ? Math.round(ir.height) : null,
      topGap: ir ? Math.round(ir.top - r.top) : null,
      align: cs?.textAlign, vAlign: rcs.verticalAlign, ws: cs?.whiteSpace, disp: cs?.display, lh: cs?.lineHeight,
      v: inner ? (inner.tagName === 'TEXTAREA' ? inner.value : txt(inner)) : null,
    }
  }
  return {
    editing: !!document.querySelector('.qr-sheet.is-editing'),
    status: txt(document.querySelector('.as-side-status-row')),
    sheetW: Math.round(document.querySelector('.qr-sheet')?.getBoundingClientRect().width || 0),
    headVals: [...document.querySelectorAll('.qr-head-table .qr-value')].map(txt),
    batchHeads: [...document.querySelectorAll('.c-batchname')].map((th) => ({ text: txt(th), hasInput: !!th.querySelector('input') })),
    rowH: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
    rows: rows.map((tr) => [...tr.children].map(cell)),
  }
})
console.log(JSON.stringify(dump, null, 1))
const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-11.png' })
