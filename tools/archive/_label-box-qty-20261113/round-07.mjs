// round-07: 让「按这次打印打码」真正可点 —— 滚的是**弹窗 body** 而不是页面,再核对 elementFromPoint
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)

const diag = await page.evaluate(() => {
  const vis = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
  const d = vis[vis.length - 1]
  if (!d) return { ok: false }
  const body = d.querySelector('.el-dialog__body')
  const po = [...d.querySelectorAll('.el-collapse-item')].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btn = po ? [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码')) : null
  if (!btn) return { ok: false, why: 'no btn' }
  // 滚弹窗 body,把按钮滚进可视区
  body.scrollTop = 100000
  const br = body.getBoundingClientRect()
  const r = btn.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return {
    ok: true,
    bodyScrollTop: body.scrollTop, bodyScrollH: body.scrollHeight, bodyClientH: body.clientHeight,
    bodyRect: [Math.round(br.x), Math.round(br.y), Math.round(br.width), Math.round(br.height)],
    btnRect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    hit: (hit?.textContent || '').trim().slice(0, 24),
    hitIsBtn: hit === btn || btn.contains(hit),
    bodyOverflow: getComputedStyle(body).overflow,
  }
})
console.log('DIAG ' + JSON.stringify(diag))
if (diag.ok && diag.hitIsBtn) {
  await page.mouse.click(diag.btnRect[0] + diag.btnRect[2] / 2, diag.btnRect[1] + diag.btnRect[3] / 2)
  await page.waitForTimeout(7000)
  const after = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('.el-dialog')]
      .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
    const d = vis[vis.length - 1]
    const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
    const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
    const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
    const rows = [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
      const tds = [...tr.querySelectorAll('td')]
      const q = tds[qtyIdx]?.querySelector('input')
      const b = tds[boxIdx]?.querySelector('input')
      return q || b ? { qty: q?.value ?? null, qtyDisabled: q?.disabled ?? null, box: b?.value ?? null, boxDisabled: b?.disabled ?? null } : null
    }).filter(Boolean)
    return { rows, banner: (d.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim(), msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()) }
  })
  console.log('AFTER_LOAD ' + JSON.stringify(after, null, 2))
  // 锁定态下填每箱数量
  const typed = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('.el-dialog')]
      .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
    const d = vis[vis.length - 1]
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
    const vis = [...document.querySelectorAll('.el-dialog')]
      .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
    const d = vis[vis.length - 1]
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
  await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-07.json', JSON.stringify({ diag, after, typed, final }, null, 2), 'utf8')
}
