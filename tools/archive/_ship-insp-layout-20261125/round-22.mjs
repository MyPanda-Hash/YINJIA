// 第 22 轮:宽视口下取「可编辑态」证据(批次号输入框 / 五列居中 / 手工换行)
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1900, height: 1050, deviceScaleFactor: 1, mobile: false }) } catch (e) { console.log('metrics: ' + e.message) }
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)

// 选 ZJ-2026-11-0012(现在回到未完成页签)
let rect = null
for (let i = 0; i < 8 && !rect; i++) {
  rect = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tr')].find((x) => (x.textContent || '').includes('ZJ-2026-11-0012'))
    if (!tr) return null
    const cell = [...tr.children].find((c) => (c.textContent || '').includes('ZJ-2026-11-0012')) || tr
    const r = cell.getBoundingClientRect()
    return { x: Math.round(r.x + Math.min(30, r.width / 2)), y: Math.round(r.y + r.height / 2) }
  })
  if (!rect) await page.waitForTimeout(1500)
}
console.log('row rect: ' + JSON.stringify(rect))
if (rect) await page.mouse.click(rect.x, rect.y, { label: '选中出货检验单' })
await page.waitForTimeout(4500)

const dump = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const cell = (td) => {
    if (!td) return null
    const ta = td.querySelector('textarea')
    const span = td.querySelector('.qr-cell-text')
    const inner = ta || span || td.querySelector('.el-select') || td.querySelector('.qr-row-del') || td.firstElementChild
    const cs = inner ? getComputedStyle(inner) : null
    const r = td.getBoundingClientRect()
    return {
      w: Math.round(r.width), h: Math.round(r.height), align: cs?.textAlign, lh: cs?.lineHeight,
      tag: inner?.tagName, v: ta ? ta.value : (span ? span.innerText : txt(inner)),
    }
  }
  return {
    editing: !!document.querySelector('.qr-sheet.is-editing'),
    status: txt(document.querySelector('.as-side-status-row')),
    sheetW: Math.round(document.querySelector('.qr-sheet')?.getBoundingClientRect().width || 0),
    batchHead: [...document.querySelectorAll('.c-batchname')].map((th) => ({ text: txt(th), input: th.querySelector('input')?.value ?? null })),
    rowHs: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
    row2: [...(rows[1]?.children || [])].map(cell),
    row1: [...(rows[0]?.children || [])].map(cell),
  }
})
console.log('DUMP ' + JSON.stringify(dump))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-22-editable.png' })
