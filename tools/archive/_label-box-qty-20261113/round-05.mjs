// round-05: 先把按钮滚进可视区,再用真实鼠标点「按这次打印打码」→ 量 本次打印数量/每箱数量 的锁定
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)

const found = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const po = [...(d?.querySelectorAll('.el-collapse-item') || [])].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btns = po ? [...po.querySelectorAll('button')].filter((b) => (b.textContent || '').includes('按这次打印打码')) : []
  if (!btns.length) return { found: false }
  const btn = btns[0]
  btn.scrollIntoView({ block: 'center' })
  return { found: true, count: btns.length }
})
console.log('FOUND ' + JSON.stringify(found))
await page.waitForTimeout(800)
const rect = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const po = [...(d?.querySelectorAll('.el-collapse-item') || [])].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btn = po ? [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码')) : null
  if (!btn) return null
  const r = btn.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return { r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], hit: (hit?.textContent || '').trim().slice(0, 30) }
})
console.log('RECT ' + JSON.stringify(rect))
if (rect) await page.mouse.click(rect.r[0] + rect.r[2] / 2, rect.r[1] + rect.r[3] / 2)
await page.waitForTimeout(6000)

const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const rows = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const q = tds[qtyIdx]?.querySelector('input')
    const b = tds[boxIdx]?.querySelector('input')
    return q || b ? { qty: q?.value ?? null, qtyDisabled: q?.disabled ?? null, box: b?.value ?? null, boxDisabled: b?.disabled ?? null } : null
  }).filter(Boolean)
  return {
    rows,
    banner: (d?.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim(),
    hasCancel: [...(d?.querySelectorAll('button') || [])].some((b) => (b.textContent || '').includes('取消带入')),
    msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()),
  }
})
console.log('AFTER ' + JSON.stringify(after, null, 2))

// 在锁定态下往「每箱数量」输入 100,确认能填进去
const typed = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = d?.querySelectorAll('.el-table__body tbody tr')[0]
  const inp = tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')
  if (!inp) return { ok: false, why: 'no input' }
  if (inp.disabled) return { ok: false, why: 'disabled' }
  inp.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '100')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.blur()
  return { ok: true, value: inp.value }
})
await page.waitForTimeout(900)
const final = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = d?.querySelectorAll('.el-table__body tbody tr')[0]
  return {
    boxValue: tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')?.value ?? null,
    hint: (d?.querySelector('.mlq-box-hint')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('TYPED ' + JSON.stringify(typed) + ' FINAL ' + JSON.stringify(final))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-05.json', JSON.stringify({ rect, after, typed, final }, null, 2), 'utf8')
