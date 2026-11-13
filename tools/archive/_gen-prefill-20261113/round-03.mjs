// round-03: 诊断 —— ① WH/WHLOC 档案接口是否取到行 ② 生单对话框里仓库下拉的 popper 结构
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')

const q = async (panelCode, pageSize) => {
  const res = await page.fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: {}, pageNo: 1, pageSize }),
  })
  let body = null
  try { body = JSON.parse(String(res.body || '{}')) } catch (e) { body = String(res.body || '').slice(0, 200) }
  return { status: res.status, code: body?.code, total: body?.data?.totalSize, n: body?.data?.list?.length, first: body?.data?.list?.[0], keys: body?.data?.list?.[0] ? Object.keys(body.data.list[0]).slice(0, 20) : [] }
}
console.log('WH ' + JSON.stringify(await q('WH', 5)))
console.log('WHLOC ' + JSON.stringify(await q('WHLOC', 5)))

const dlgState = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  if (!dlg) return { open: false }
  const row = dlg.querySelector('.el-table__body tbody tr')
  const sel = row?.querySelectorAll('td .el-select__wrapper')
  sel?.[0]?.click()
  return { open: true, selects: sel?.length || 0 }
})
console.log('DLG ' + JSON.stringify(dlgState))
await page.waitForTimeout(1200)
const pops = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')].map((p, i) => ({
  i,
  cls: (p.className || '').toString().slice(0, 60),
  display: getComputedStyle(p).display,
  visible: p.offsetParent !== null,
  items: p.querySelectorAll('.el-select-dropdown__item').length,
  rect: (() => { const r = p.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] })(),
})))
console.log('POPPERS ' + JSON.stringify(pops))
const anyItem = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el) => (el.textContent || '').trim()).slice(0, 15))
console.log('ITEMS ' + JSON.stringify(anyItem))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-03.json', JSON.stringify({ pops, anyItem }, null, 2), 'utf8')
