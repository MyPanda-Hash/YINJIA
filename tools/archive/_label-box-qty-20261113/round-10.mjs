// round-10: 把「打印采购订单记录」表的内层滚动条滚到底,让按钮真正进入可视区,再点一次并量锁定态
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }) } catch (e) { /* ignore */ }
await page.waitForTimeout(600)

const prep = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
  if (!d) return { ok: false }
  const po = [...d.querySelectorAll('.el-collapse-item')].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  if (!po) return { ok: false, why: 'no po item' }
  // 内层滚动条(scrollbar__wrap)滚到底
  const wraps = [...po.querySelectorAll('.el-scrollbar__wrap, .el-table__body-wrapper')]
  wraps.forEach((w) => { w.scrollTop = 100000 })
  // 外层弹窗 body 也滚一滚
  const body = d.querySelector('.el-dialog__body')
  if (body) body.scrollTop = 100000
  const btn = [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码'))
  if (!btn) return { ok: false, why: 'no btn' }
  btn.scrollIntoView({ block: 'center', inline: 'nearest' })
  const r = btn.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return {
    ok: true, wraps: wraps.length, r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    hitIsBtn: hit === btn || btn.contains(hit), hit: (hit?.textContent || '').trim().slice(0, 20),
  }
})
console.log('PREP ' + JSON.stringify(prep))

if (prep.ok) {
  await page.mouse.click(prep.r[0] + prep.r[2] / 2, prep.r[1] + prep.r[3] / 2)
  await page.waitForTimeout(7000)
}
const state = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
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
    hasCancelBtn: [...(d?.querySelectorAll('button') || [])].some((b) => (b.textContent || '').includes('取消带入')),
    zeroFillDisabled: [...(d?.querySelectorAll('.el-dialog__footer button') || [])].map((b) => ({ t: (b.textContent || '').trim(), d: b.disabled })),
    msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()),
  }
})
console.log('STATE ' + JSON.stringify(state, null, 2))

if (state.rows.length) {
  const typed = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
    const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
    const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
    const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
    const tr = d.querySelectorAll('.el-table__body tbody tr')[0]
    const inp = tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')
    if (!inp) return { ok: false, why: 'no input' }
    if (inp.disabled) return { ok: false, why: 'disabled' }
    inp.focus()
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(inp, '120')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.blur()
    return { ok: true, value: inp.value }
  })
  await page.waitForTimeout(900)
  const final = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
    const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
    const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
    const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
    const tr = d.querySelectorAll('.el-table__body tbody tr')[0]
    return {
      boxValue: tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')?.value ?? null,
      hint: (d.querySelector('.mlq-box-hint')?.textContent || '').replace(/\s+/g, ' ').trim(),
      banner: (d.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim(),
    }
  })
  console.log('TYPED ' + JSON.stringify(typed) + ' FINAL ' + JSON.stringify(final))
  await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-10.json', JSON.stringify({ prep, state, typed, final }, null, 2), 'utf8')
}
