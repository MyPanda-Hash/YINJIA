// 第 16 轮:等列表刷新后选中 ZJ-2026-11-0012 → 只读态复核(批次号/居中/换行)
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')

const clickText = async (label, sel = 'span,div,button,a') => {
  const ok = await page.evaluate(([t, s]) => {
    const el = [...document.querySelectorAll(s)].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === t)
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    if (!el) return false
    el.click(); return true
  }, [label, sel])
  await page.waitForTimeout(2000)
  return ok
}
await clickText('已完成')
await page.waitForTimeout(4000)

let picked = { ok: false, sample: '' }
for (let i = 0; i < 10 && !picked.ok; i++) {
  picked = await page.evaluate(() => {
    const trs = [...document.querySelectorAll('tr')]
    const hit = trs.find((x) => (x.textContent || '').includes('ZJ-2026-11-0012'))
    if (hit) {
      const cell = [...hit.children].find((c) => (c.textContent || '').includes('ZJ-2026-11-0012'))
      ;(cell || hit).click()
      return { ok: true, sample: '' }
    }
    return { ok: false, sample: trs.slice(0, 4).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)).join(' | ') }
  })
  if (!picked.ok) await page.waitForTimeout(1200)
}
console.log('pick: ' + JSON.stringify(picked))
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
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      align: cs?.textAlign, lh: cs?.lineHeight, ws: cs?.whiteSpace,
      nl: span ? (span.innerText.match(/\n/g) || []).length : null,
      v: inner ? (inner.tagName === 'TEXTAREA' ? inner.value : (span ? span.innerText : txt(inner))) : null,
    }
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
const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-16-readonly.png' })
