// round-15: ③ 界面查询(先 dump 查询弹窗结构再填) + ④ 点「打印」主按钮。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const MERGED = 'SL-2026-11-0010'
const out = {}

await page.goto('http://localhost:5173/#/panelx/list/QC_RECV', { timeout: 40000 })
await page.waitForTimeout(6000)
// 打开查询
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.tools button, .tools .tb-main')].find((b) => (b.textContent || '').trim() === '查询')
  btn?.click()
})
await page.waitForTimeout(2500)
out.dialogDump = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('查询'))
  if (!dlg) return { open: false }
  const fields = [...dlg.querySelectorAll('.el-form-item, .qf-item, .query-field, .field')].map((it) => ({
    label: (it.querySelector('label')?.textContent || '').trim(),
    ph: [...it.querySelectorAll('input')].map((i) => i.placeholder || '').join('|'),
    inputCount: it.querySelectorAll('input').length,
  })).filter((f) => f.label || f.ph)
  const allInputs = [...dlg.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', val: i.value, type: i.type }))
  return { open: true, title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(), fields: fields.slice(0, 20), allInputs: allInputs.slice(0, 20) }
})
console.log('DLG_DUMP ' + JSON.stringify(out.dialogDump).slice(0, 1200))

// 填「采购订单号」(按 label 文本匹配最内层 field)
out.fill = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('查询'))
  const labels = [...dlg.querySelectorAll('label')]
  const lab = labels.find((l) => (l.textContent || '').trim() === '采购订单号')
  if (!lab) return { ok: false, why: '没找到 采购订单号 label', labels: labels.map((l) => (l.textContent || '').trim()).slice(0, 20) }
  const box = lab.closest('.el-form-item, .qf-item, .query-field, .field') || lab.parentElement
  const inp = box.querySelector('input')
  if (!inp) return { ok: false, why: '没找到 input' }
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, 'PO-2026-11-0015')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true, value: inp.value }
})
console.log('FILL ' + JSON.stringify(out.fill))
await page.waitForTimeout(600)
// 点查询/确定
out.clickQuery = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('查询'))
  const btns = [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
  const btn = [...dlg.querySelectorAll('button')].find((b) => /^(查询|确定|搜索)$/.test((b.textContent || '').trim()))
  btn?.click()
  return { btns, clicked: !!btn }
})
console.log('CLICK_QUERY ' + JSON.stringify(out.clickQuery))
await page.waitForTimeout(6000)
out.afterQuery = await page.evaluate((no) => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    dialogClosed: ![...document.querySelectorAll('.el-dialog')].some((d) => (d.textContent || '').includes('查询') && d.getBoundingClientRect().width > 0),
    rows: rows.length, hitMerged: rows.some((t) => t.includes(no)), first: rows.slice(0, 2),
    countText: (document.querySelector('.dsr-total, .doc-count, .rail-total')?.textContent || '').trim(),
  }
}, MERGED)
console.log('③ 过滤后 → ' + JSON.stringify(out.afterQuery))

// ④ 打印:直接点「打印」组主按钮
await page.goto('http://localhost:5173/#/panelx/list/QC_RECV', { timeout: 40000 })
await page.waitForTimeout(6000)
await page.evaluate((no) => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  rows.find((r) => (r.textContent || '').includes(no))?.click()
}, MERGED)
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '打印')
  t?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(8000)
out.print = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()),
  dialogs: [...document.querySelectorAll('.el-dialog__title')].map((t) => (t.textContent || '').trim()),
  bodyHasPrinting: document.body.className.includes('printing'),
}))
console.log('④ 点「打印」→ ' + JSON.stringify(out.print))
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-15.json', JSON.stringify(out, null, 2), 'utf8')
