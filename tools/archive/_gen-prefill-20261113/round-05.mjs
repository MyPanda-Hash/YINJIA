// round-05: 从零走一遍 —— 勾一张已审核采购订单 → 批量生单 → 选仓库/仓位 → 套用所有行 → 生单
//          → 接口读回生成的暂收单行,核对 仓库/仓位 是否落到下游。
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(400)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}

// 关掉遗留弹窗
await page.evaluate(() => {
  for (let i = 0; i < 3; i++) document.querySelector('.el-dialog__headerbtn')?.click()
})
await page.waitForTimeout(600)

// 重新进列表页(干净状态)
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)

const before = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.dsr-check input[type="checkbox"]')]
  return { checked: boxes.filter((b) => b.checked).length, total: boxes.length }
})
console.log('RAIL_BEFORE ' + JSON.stringify(before))

// 勾一张「已审核」的订单(先取消所有已勾,再勾目标)
const rail = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  // 先清
  for (const r of rows) {
    const box = r.querySelector('.dsr-check input[type="checkbox"]')
    if (box?.checked) box.click()
  }
  for (const r of rows) {
    if ((r.querySelector('.dsr-tag')?.textContent || '').trim() !== '已审核') continue
    const box = r.querySelector('.dsr-check input[type="checkbox"]')
    box?.click()
    const cells = [...r.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    return { ok: true, no: cells[1], checked: box?.checked }
  }
  return { ok: false }
})
console.log('RAIL ' + JSON.stringify(rail))
await page.waitForTimeout(1500)

// 生单 ▼ → 批量生单
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')]
    .find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
const menu = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')].map((el) => (el.textContent || '').trim()))
console.log('MENU ' + JSON.stringify(menu))
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').includes('批量生单'))
  it?.click()
})
await page.waitForTimeout(7000)

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  if (!d) return { open: false, msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()) }
  return {
    open: true,
    docNo: (d.querySelector('.gl-doc-no')?.textContent || '').trim(),
    heads: [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim()),
    rows: d.querySelectorAll('.el-table__body tbody tr').length,
  }
})
console.log('DLG ' + JSON.stringify(dlg))

// 第一行选仓库
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  d?.querySelector('.el-table__body tbody tr td .el-select__wrapper')?.click()
})
await page.waitForTimeout(1000)
const whOpts = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent && p.getBoundingClientRect().width > 0)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  return items.map((el) => (el.textContent || '').trim()).filter(Boolean)
})
console.log('WH_OPTS ' + JSON.stringify(whOpts.slice(0, 8)) + ' n=' + whOpts.length)
const wh = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent && p.getBoundingClientRect().width > 0)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  const t = items.find((el) => (el.textContent || '').trim()) || items[0]
  if (!t) return ''
  t.click()
  return (t.textContent || '').trim()
})
console.log('WH ' + wh)
await page.waitForTimeout(800)

// 第一行选仓位
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  const sels = d?.querySelectorAll('.el-table__body tbody tr td .el-select__wrapper')
  sels?.[1]?.click()
})
await page.waitForTimeout(1000)
const binOpts = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent && p.getBoundingClientRect().width > 0)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  return items.map((el) => (el.textContent || '').trim()).filter(Boolean)
})
console.log('BIN_OPTS n=' + binOpts.length + ' ' + JSON.stringify(binOpts.slice(0, 6)))
const bin = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent && p.getBoundingClientRect().width > 0)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  const t = items.find((el) => (el.textContent || '').trim()) || items[0]
  if (!t) return ''
  t.click()
  return (t.textContent || '').trim()
})
console.log('BIN ' + bin)
await page.waitForTimeout(800)

// 套用到所有行 + 读回每行显示值
const applied = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('仓库仓位应用到所有行'))
  btn?.click()
  return !!btn
})
await page.waitForTimeout(900)
const perRow = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  return [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => {
    const sel = td.querySelector('.el-select')
    if (!sel) return ''
    const v = td.querySelector('.el-select__selected-item:not(.is-hidden)')
    return (v?.textContent || '').trim()
  }).filter(Boolean))
})
console.log('APPLIED ' + applied + ' PER_ROW ' + JSON.stringify(perRow))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-05.json',
  JSON.stringify({ rail, dlg, whOpts, wh, binOpts, bin, applied, perRow }, null, 2), 'utf8')

// 确定生单
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定生单'))
  btn?.click()
})
await page.waitForTimeout(10000)
const msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message__content')].map((el) => (el.textContent || '').trim()))
console.log('MSGS ' + JSON.stringify(msgs))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-05-msgs.json', JSON.stringify({ msgs }, null, 2), 'utf8')

// 接口读回:暂收单最新单据的明细 仓库/仓位
const list = await post('/api/px/queryFormDataList', { panelCode: 'QC_RECV', condition: {}, pageNo: 1, pageSize: 5 })
const rows = (list.body?.data?.list || []).flatMap((d) => {
  const det = d.detail && typeof d.detail === 'object' ? Object.values(d.detail).find((v) => Array.isArray(v)) : null
  return (det || []).map((it) => ({ doc: d['编号'] || it['单据编号'], 仓库: it['仓库'], 仓位: it['仓位'], 物料编码: it['物料编码'] }))
})
console.log('QC_RECV_ROWS ' + JSON.stringify(rows.slice(0, 6)))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-05-recv.json', JSON.stringify({ rows: rows.slice(0, 20) }, null, 2), 'utf8')
