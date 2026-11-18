// round-06: 新增草稿 → 勾选(品质/滤芯/只要数据) → 制造商「其他」手填 → 选择检验项目带入 1 行
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(500)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(6000)

// 新增(as-side-btn)
const added = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('add=' + added)
await T(7000)

const editState = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    editable: !!sheet && sheet.className.includes('is-editing'),
    meta: txt(sheet?.querySelector('.ic-meta')),
    inputs: sheet ? sheet.querySelectorAll('input').length : -1,
    datePicker: !!sheet?.querySelector('.ic-date-pick'),
    msg: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).join(' | '),
  }
})
console.log('edit=' + JSON.stringify(editState))

// 委托单位「品质」/ 样品类别「滤芯」/ 报告类型「只要数据」
const picks = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const clickOpt = (rowMatch, optText) => {
    const tr = rows.find((r) => (r.textContent || '').includes(rowMatch))
    if (!tr) return 'no-row:' + rowMatch
    const o = [...tr.querySelectorAll('.ic-opt')].find((x) => (x.textContent || '').replace(/\s+/g, '').includes(optText))
    if (!o) return 'no-opt:' + optText + ' in ' + (tr.textContent || '').replace(/\s+/g, ' ').slice(0, 40)
    o.click()
    return 'ok:' + optText
  }
  return [clickOpt('委托单位/单位地址', '品质'), clickOpt('样品型号/规格', '滤芯'), clickOpt('报告类型', '只要数据')]
})
console.log('picks=' + JSON.stringify(picks))
await T(1000)

// 制造商「其他」→ 填名称
const other = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const tr = rows.find((r) => (r.textContent || '').includes('制造商/地址'))
  const opts = [...tr.querySelectorAll('.ic-opt')]
  const o = opts.find((x) => (x.textContent || '').replace(/\s+/g, '') === '□其他')
  if (!o) return 'no-other:' + opts.map((x) => (x.textContent || '').replace(/\s+/g, '')).join(',')
  o.click()
  return 'clicked'
})
console.log('manufacturer-other=' + other)
await T(800)

const typed = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const tr = rows.find((r) => (r.textContent || '').includes('制造商/地址'))
  const inp = [...tr.querySelectorAll('input')].find((i) => !i.value && i.offsetParent)
  if (!inp) return 'no-input:' + [...tr.querySelectorAll('input')].map((i) => i.placeholder).join('|')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '惠州市第三水厂')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return 'typed:' + inp.value
})
console.log('manufacturer-type=' + typed)
await T(600)

// 选择检验项目 → 弹窗 → 勾第一行 → 带入
const openDlg = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
  if (!btn) return 'no-btn'
  btn.click()
  return 'opened'
})
console.log('dialog=' + openDlg)
await T(4000)

const dlgInfo = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    title: txt(dlg?.querySelector('.el-dialog__title')),
    rows: dlg ? dlg.querySelectorAll('.el-table__body tr').length : -1,
    body: txt(dlg).slice(0, 240),
  }
})
console.log('dlg=' + JSON.stringify(dlgInfo))

const carry = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  if (!dlg) return 'no-dialog'
  const row = dlg.querySelector('.el-table__body tr')
  if (!row) return 'no-rows'
  const cb = row.querySelector('.el-checkbox')
  if (cb) cb.click()
  return 'checked'
})
console.log('carry-check=' + carry)
await T(800)

const confirm = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const btn = [...dlg.querySelectorAll('button')].find((b) => /带入/.test(b.textContent || ''))
  if (!btn) return 'no-btn'
  btn.click()
  return 'confirmed'
})
console.log('carry-confirm=' + confirm)
await T(3500)

const state = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    meta: txt(sheet.querySelector('.ic-meta')),
    metaInputs: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
    items: sheet.querySelectorAll('.ic-items tbody tr').length,
    total: txt(sheet.querySelector('.ic-items-total')),
    rows: [...sheet.querySelectorAll('tbody > tr')].slice(0, 8).map((tr) => txt(tr).slice(0, 150)),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: dir + '/shots/round-06-filled.png', fullPage: false })
