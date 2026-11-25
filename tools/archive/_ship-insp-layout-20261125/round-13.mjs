// 第 13 轮:改完复核 —— 只读态(已审核)批次号是否回来 + 五列是否一套居中口径 + 手工换行是否保留
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
try {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1900, height: 1050, deviceScaleFactor: 1, mobile: false })
} catch (e) { console.log('metrics skip: ' + e.message) }
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)

const clickText = async (label, sel = 'span,div,button,a') => {
  const ok = await page.evaluate(([t, s]) => {
    const el = [...document.querySelectorAll(s)].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === t)
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    if (!el) return false
    el.click(); return true
  }, [label, sel])
  await page.waitForTimeout(2500)
  return ok
}
console.log('tab 已完成: ' + (await clickText('已完成')))
const picked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((x) => (x.textContent || '').includes('ZJ-2026-11-0012'))
  if (!tr) return false
  ;[...tr.children][1]?.click() || tr.click()
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
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      align: cs?.textAlign, lh: cs?.lineHeight, ws: cs?.whiteSpace,
      lines: span ? span.innerText.split('\n').length : null,
      v: inner ? (inner.tagName === 'TEXTAREA' ? inner.value : (span ? span.innerText : txt(inner))) : null,
    }
  }
  return {
    editing: !!document.querySelector('.qr-sheet.is-editing'),
    status: txt(document.querySelector('.as-side-status-row')),
    sheetW: Math.round(document.querySelector('.qr-sheet')?.getBoundingClientRect().width || 0),
    batchHeadText: [...document.querySelectorAll('.c-batchname')].map((th) => ({
      text: txt(th), value: txt(th.querySelector('.qr-batch-value')), hasInput: !!th.querySelector('input'),
    })),
    rowHs: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
    rows: rows.map((tr) => [...tr.children].map(cell)),
  }
})
console.log(JSON.stringify(dump, null, 1))
const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-13-readonly.png' })
