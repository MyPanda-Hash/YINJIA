// round-13: 锁定态下把两行「每箱数量」都填上,确认能填 + 张数/零头提示随之更新;
// 最后点「取消带入」把界面还原(全程不点「确定并打印」,不写库)。
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }) } catch (e) { /* ignore */ }
await page.waitForTimeout(500)

const fill = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const out = []
  const trs = [...d.querySelectorAll('.el-table__body tbody tr')]
  const vals = ['120', '9']
  trs.forEach((tr, i) => {
    const tds = [...tr.querySelectorAll('td')]
    const box = tds[boxIdx]?.querySelector('input')
    const qty = tds[qtyIdx]?.querySelector('input')
    if (!box) return
    box.focus()
    setter.call(box, vals[i] || '1')
    box.dispatchEvent(new Event('input', { bubbles: true }))
    box.dispatchEvent(new Event('change', { bubbles: true }))
    box.blur()
    out.push({ i, qty: qty?.value, qtyDisabled: qty?.disabled, box: box.value, boxDisabled: box.disabled })
  })
  return out
})
await page.waitForTimeout(1000)
const after = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const trs = [...d.querySelectorAll('.el-table__body tbody tr')]
  return {
    boxes: trs.map((tr) => tr.querySelectorAll('td')[boxIdx]?.querySelector('input')?.value ?? null),
    hint: (d.querySelector('.mlq-box-hint')?.textContent || '').replace(/\s+/g, ' ').trim(),
    banner: (d.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('FILL ' + JSON.stringify(fill))
console.log('AFTER ' + JSON.stringify(after))

// 取消带入,界面还原(不写库)
const cancelled = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('取消带入'))
  btn?.click()
  return !!btn
})
await page.waitForTimeout(1500)
const restored = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const d = all.filter((x) => x.getBoundingClientRect().width > 0).pop()
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const tr = d.querySelectorAll('.el-table__body tbody tr')[0]
  return {
    banner: (d.querySelector('.mlq-lock')?.textContent || '').trim(),
    qtyDisabled: tr?.querySelectorAll('td')[qtyIdx]?.querySelector('input')?.disabled ?? null,
  }
})
console.log('CANCELLED ' + cancelled + ' RESTORED ' + JSON.stringify(restored))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-13.json', JSON.stringify({ fill, after, cancelled, restored }, null, 2), 'utf8')
