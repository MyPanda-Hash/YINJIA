// 第 9 轮:只读态(已审核)取证 —— 批次号还在不在、各行对齐/高度是否一致
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
// 视口放宽到 1600(用户截图纸面约 800px;本窗口左侧目录占位更宽)
try {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false })
} catch (e) { console.log('metrics skip: ' + e.message) }
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)

// 选到 ZJ-2026-11-0012(列表里点行)
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tr')]
  const hit = rows.find((tr) => (tr.textContent || '').includes('ZJ-2026-11-0012'))
  if (!hit) return { ok: false, rows: rows.slice(0, 3).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()) }
  hit.click()
  return { ok: true }
})
console.log('pick doc: ' + JSON.stringify(picked))
await page.waitForTimeout(4000)

const dump = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const cell = (td) => {
    if (!td) return null
    const span = td.querySelector('.qr-cell-text')
    const inner = span || td.querySelector('.el-select') || td.querySelector('.el-input') || td.querySelector('.qr-row-del') || td.firstElementChild
    const ir = inner ? inner.getBoundingClientRect() : null
    const r = td.getBoundingClientRect()
    const cs = inner ? getComputedStyle(inner) : null
    return {
      cw: Math.round(r.width), ch: Math.round(r.height),
      ih: ir ? Math.round(ir.height) : null,
      topGap: ir ? Math.round(ir.top - r.top) : null,
      align: cs?.textAlign, vAlign: getComputedStyle(td).verticalAlign, ws: cs?.whiteSpace, disp: cs?.display,
      v: inner ? (inner.tagName === 'TEXTAREA' ? inner.value : txt(inner)) : null,
    }
  }
  return {
    editing: !!document.querySelector('.qr-sheet.is-editing'),
    status: txt(document.querySelector('.as-side-status-row') || {}),
    sideTitle: txt(document.querySelector('.as-side-title') || {}),
    sheetW: Math.round(document.querySelector('.qr-sheet')?.getBoundingClientRect().width || 0),
    batchHeads: [...document.querySelectorAll('.c-batchname')].map((th) => ({ text: txt(th), hasInput: !!th.querySelector('input'), html: th.innerHTML.replace(/\s+/g, ' ').slice(0, 200) })),
    rowH: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
    rows: rows.map((tr) => [...tr.children].map(cell)),
  }
})
console.log(JSON.stringify(dump, null, 1))
const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-09.png' })
