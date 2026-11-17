// round-06: 先找出「有剩余量」的已审核采购订单,再用界面走一遍预填 + 生单。
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}

// 1) 找有剩余量的已审核订单
const lst = await post('/api/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 60 })
const docs = (lst.body?.data?.list || []).map((d) => ({ no: d['编号'], st: d['单据状态'] })).filter((d) => d.st === '已审核')
let target = null
for (const d of docs.slice(0, 12)) {
  const lines = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [d.no] })
  const rowsD = lines.body?.data?.docs?.[0]?.lines || []
  const usable = rowsD.filter((r) => Number(r['可送上限'] || r['剩余数量'] || 0) > 0)
  if (usable.length) { target = { no: d.no, lines: rowsD.length, usable: usable.length }; break }
}
console.log('TARGET ' + JSON.stringify(target))
if (!target) { console.log('NO_USABLE_DOC'); throw new Error('没有可生单的已审核采购订单') }

// 2) 界面:定位到该单(左栏点行),勾上,再批量生单
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5000)
const picked = await page.evaluate((no) => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  for (const r of rows) {
    const cells = [...r.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    if (!cells.includes(no)) continue
    r.click()                                  // 选中该单
    const box = r.querySelector('.dsr-check input[type="checkbox"]')
    if (box && !box.checked) box.click()        // 勾上(批量生单需要)
    return { ok: true, checked: box?.checked, no }
  }
  return { ok: false }
}, target.no)
console.log('PICK ' + JSON.stringify(picked))
await page.waitForTimeout(1500)

await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')]
    .find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').includes('批量生单'))
  it?.click()
})
await page.waitForTimeout(7000)

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  if (!d) return { open: false, msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()) }
  const first = d.querySelector('.el-table__body tbody tr')
  return {
    open: true, docNo: (d.querySelector('.gl-doc-no')?.textContent || '').trim(),
    rows: d.querySelectorAll('.el-table__body tbody tr').length,
    firstCells: first ? [...first.querySelectorAll('td')].map((td) => (td.textContent || '').trim()) : [],
    confirmDisabled: (() => {
      const b = [...d.querySelectorAll('.el-dialog__footer button')].find((x) => (x.textContent || '').includes('确定生单'))
      return b ? b.disabled : null
    })(),
    checkedRows: d.querySelectorAll('.el-table__body tbody tr td .el-checkbox.is-checked').length,
  }
})
console.log('DLG ' + JSON.stringify(dlg))

// 3) 选仓库 / 仓位(第一行),再套用所有行
const pickSel = async (idx, wantText) => {
  await page.evaluate((i) => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
    const tr = d?.querySelector('.el-table__body tbody tr')
    tr?.querySelectorAll('td .el-select__wrapper')[i]?.click()
  }, idx)
  await page.waitForTimeout(900)
  const texts = await page.evaluate(() => {
    const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent && p.getBoundingClientRect().width > 0)
    const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
    return items.map((el) => (el.textContent || '').trim()).filter(Boolean)
  })
  return { texts, pick: async () => {
    const t = await page.evaluate((want) => {
      const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent && p.getBoundingClientRect().width > 0)
      const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
      const el = (want ? items.find((x) => (x.textContent || '').trim() === want) : null) || items[0]
      if (!el) return ''
      el.click()
      return (el.textContent || '').trim()
    }, wantText)
    await page.waitForTimeout(700)
    return t
  } }
}
const whPick = await pickSel(0)
console.log('WH_OPTS n=' + whPick.texts.length + ' ' + JSON.stringify(whPick.texts.slice(0, 6)))
const wh = await whPick.pick('A仓')
console.log('WH ' + wh)
const binPick = await pickSel(1)
console.log('BIN_OPTS n=' + binPick.texts.length + ' ' + JSON.stringify(binPick.texts.slice(0, 6)))
const bin = await binPick.pick()
console.log('BIN ' + bin)

const applied = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('仓库仓位应用到所有行'))
  btn?.click()
  return !!btn
})
await page.waitForTimeout(800)
const shown = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  return [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')]
    // 仓库/仓位两列的下标:表头里数出来
    return cells.map((td) => (td.querySelector('.el-select') ? (td.textContent || '').trim() : '')).filter(Boolean)
  })
})
console.log('APPLIED ' + applied + ' SHOWN ' + JSON.stringify(shown))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-06.json',
  JSON.stringify({ target, dlg, wh, bin, applied, shown }, null, 2), 'utf8')

// 4) 确定生单
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('生单 →'))
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定生单'))
  btn?.click()
})
await page.waitForTimeout(12000)
const msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message__content')].map((el) => (el.textContent || '').trim()))
console.log('MSGS ' + JSON.stringify(msgs))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-06-msgs.json', JSON.stringify({ msgs }, null, 2), 'utf8')
