// round-12: 用 ego 的 page.click(选择器) 点「按这次打印打码」——它会先把元素滚进可视区再点
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }) } catch (e) { /* ignore */ }
await page.waitForTimeout(600)

const sel = '.el-collapse .el-collapse-item:last-child .el-table__body tbody tr:last-child td:last-child button'
const exists = await page.evaluate((s) => {
  const el = document.querySelector(s)
  return el ? { text: (el.textContent || '').trim(), disabled: el.disabled } : null
}, sel)
console.log('EXISTS ' + JSON.stringify(exists))
let clickErr = ''
try {
  await page.click(sel, { label: '按这次打印打码' })
} catch (e) { clickErr = e.message }
console.log('CLICK_ERR ' + clickErr)
await page.waitForTimeout(7000)

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
    msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()),
  }
})
console.log('STATE ' + JSON.stringify(state, null, 2))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-12.json', JSON.stringify({ exists, clickErr, state }, null, 2), 'utf8')
