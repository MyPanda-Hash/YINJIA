// round-11: 用键盘触发「按这次打印打码」(按钮被表格头遮住,鼠标点不到) → 量锁定态 + 锁定态下填每箱数量
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }) } catch (e) { /* ignore */ }
await page.waitForTimeout(600)

const focused = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
  const po = [...d.querySelectorAll('.el-collapse-item')].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btns = po ? [...po.querySelectorAll('button')].filter((b) => (b.textContent || '').includes('按这次打印打码')) : []
  if (!btns.length) return { ok: false, n: 0 }
  btns[0].focus()
  return { ok: true, n: btns.length, disabled: btns[0].disabled, isFocused: document.activeElement === btns[0] }
})
console.log('FOCUS ' + JSON.stringify(focused))
if (focused.ok) {
  await page.keyboard.press('Enter')
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
    footer: [...(d?.querySelectorAll('.el-dialog__footer button') || [])].map((b) => ({ t: (b.textContent || '').trim(), d: b.disabled })),
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
    const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
    const tr = d.querySelectorAll('.el-table__body tbody tr')[0]
    const box = tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')
    const qty = tr?.querySelectorAll('td')[qtyIdx]?.querySelector('input')
    if (!box) return { ok: false, why: 'no box input' }
    if (box.disabled) return { ok: false, why: 'box disabled', qtyDisabled: qty?.disabled }
    box.focus()
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(box, '120')
    box.dispatchEvent(new Event('input', { bubbles: true }))
    box.dispatchEvent(new Event('change', { bubbles: true }))
    box.blur()
    return { ok: true, value: box.value }
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
  await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-11.json', JSON.stringify({ focused, state, typed, final }, null, 2), 'utf8')
}
