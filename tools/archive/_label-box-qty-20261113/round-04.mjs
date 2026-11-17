// round-04: 诊断「按这次打印打码」按钮为什么点了没反应(disabled / 事件是否到达 / 结构)
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const info = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const po = [...(d?.querySelectorAll('.el-collapse-item') || [])].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btn = po ? [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码')) : null
  if (!btn) return { found: false }
  const r = btn.getBoundingClientRect()
  return {
    found: true,
    disabled: btn.disabled,
    cls: btn.className,
    rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    visible: r.width > 0 && r.height > 0,
    collapseOpen: !!po.querySelector('.el-collapse-item__wrap:not([style*="display: none"])'),
    wrapStyle: (po.querySelector('.el-collapse-item__wrap')?.getAttribute('style') || ''),
  }
})
console.log('BTN ' + JSON.stringify(info))

// 记录 document 上的 click 事件,再用真实鼠标点击一次
await page.evaluate(() => {
  window.__clicks = []
  document.addEventListener('click', (e) => {
    window.__clicks.push({ tag: e.target?.tagName, cls: (e.target?.className || '').toString().slice(0, 60), txt: (e.target?.textContent || '').trim().slice(0, 30) })
  }, true)
})
if (info.found && info.visible) {
  await page.mouse.click(info.rect[0] + info.rect[2] / 2, info.rect[1] + info.rect[3] / 2)
}
await page.waitForTimeout(2500)
const seen = await page.evaluate(() => window.__clicks || [])
console.log('CLICKS_SEEN ' + JSON.stringify(seen))
await page.waitForTimeout(4000)
const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const row0 = d?.querySelectorAll('.el-table__body tbody tr')[0]
  return {
    qty: row0?.querySelectorAll('td')[qtyIdx]?.querySelector('input')?.value ?? null,
    qtyDisabled: row0?.querySelectorAll('td')[qtyIdx]?.querySelector('input')?.disabled ?? null,
    box: row0?.querySelectorAll('td')[boxIdx]?.querySelector('input')?.value ?? null,
    boxDisabled: row0?.querySelectorAll('td')[boxIdx]?.querySelector('input')?.disabled ?? null,
    banner: (d?.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim(),
    poBtnText: [...(d?.querySelectorAll('.el-collapse-item') || [])]
      .filter((it) => (it.textContent || '').includes('打印采购订单记录'))
      .flatMap((it) => [...it.querySelectorAll('button')].map((b) => (b.textContent || '').trim())),
  }
})
console.log('AFTER ' + JSON.stringify(after, null, 2))
