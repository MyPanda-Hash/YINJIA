// round-02(#2 仓库仓位预填):切到测试库 → 采购订单批量生单 → 选仓库/仓位 → 套用所有行 → 生单,
// 再从接口读回生成的送料暂收单行,确认 仓库/仓位 落到了下游单上。
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(500)
// 先把上一轮遗留的弹窗关掉(否则重复叠加,取错元素)
await page.evaluate(() => {
  for (let i = 0; i < 3; i++) {
    const x = document.querySelector('.el-dialog__headerbtn')
    if (!x) break
    x.click()
  }
})
await page.waitForTimeout(800)

async function switchFactory(name) {
  const cur = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
  if (cur.includes(name.includes('测试') ? '测试' : 'YINJIA-MES') && cur === name) return cur
  await page.evaluate(() => {
    const el = document.querySelector('.factory')
    el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    el?.click()
  })
  await page.waitForTimeout(900)
  const picked = await page.evaluate((want) => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item, .factory-item')]
    const t = items.find((el) => (el.textContent || '').trim() === want)
    if (!t) return ''
    t.click()
    return (t.textContent || '').trim()
  }, name)
  if (!picked) return 'NOT_FOUND'
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const inp = document.querySelector('.factory-switch-dialog input')
    if (inp) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(inp, '123456')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.factory-switch-dialog button')]
      .find((b) => (b.textContent || '').includes('切换并重新登录'))
    btn?.click()
  })
  await page.waitForTimeout(9000)
  return await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
}

console.log('FACTORY ' + await switchFactory('YINJIA-MES·测试库'))
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)

// 左栏勾一张「已审核」的订单
const rail = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  for (const r of rows) {
    if ((r.querySelector('.dsr-tag')?.textContent || '').trim() !== '已审核') continue
    r.querySelector('.dsr-check input[type="checkbox"], .dsr-check .el-checkbox')?.click()
    const cells = [...r.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    return { ok: true, no: cells[1] }
  }
  return { ok: false }
})
console.log('RAIL ' + JSON.stringify(rail))
await page.waitForTimeout(1200)

// 生单 ▼ → 批量生单
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')]
    .find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').includes('批量生单'))
  it?.click()
})
await page.waitForTimeout(6000)

// 对话框里确认多出「仓库 / 仓位」两列
const cols = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  if (!dlg) return { open: false }
  const heads = [...dlg.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  return {
    open: true,
    heads,
    hasApplyAll: [...dlg.querySelectorAll('button')].some((b) => (b.textContent || '').includes('仓库仓位应用到所有行')),
    rows: dlg.querySelectorAll('.el-table__body tbody tr').length,
    docNo: (dlg.querySelector('.gl-doc-no')?.textContent || '').trim(),
  }
})
console.log('DIALOG ' + JSON.stringify(cols))

// 第一行选仓库(点开该行第 1 个 el-select),再读候选
const opened = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  const row = dlg?.querySelector('.el-table__body tbody tr')
  const sel = row?.querySelectorAll('td .el-select__wrapper')
  if (!sel || !sel.length) return 0
  sel[0].click()
  return sel.length
})
console.log('SEL_PER_ROW ' + opened)
await page.waitForTimeout(900)
const whOpts = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  return items.map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 10)
})
console.log('WH_OPTS ' + JSON.stringify(whOpts))
const whPicked = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  const t = items[0]
  if (!t) return ''
  t.click()
  return (t.textContent || '').trim()
})
console.log('WH_PICKED ' + whPicked)
await page.waitForTimeout(700)

// 仓位候选(第二列)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  const row = dlg?.querySelector('.el-table__body tbody tr')
  const sel = row?.querySelectorAll('td .el-select__wrapper')
  sel?.[1]?.click()
})
await page.waitForTimeout(900)
const binPicked = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  return { count: items.length, texts: items.map((el) => (el.textContent || '').trim()).slice(0, 8) }
})
console.log('BIN_OPTS ' + JSON.stringify(binPicked))
const bin = await page.evaluate(() => {
  const pops = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent)
  const items = pops.length ? [...pops[pops.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  const t = items[0]
  if (!t) return ''
  t.click()
  return (t.textContent || '').trim()
})
console.log('BIN_PICKED ' + bin)
await page.waitForTimeout(600)

// 「仓库仓位应用到所有行」
const applied = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('仓库仓位应用到所有行'))
  if (!btn) return false
  btn.click()
  return true
})
await page.waitForTimeout(800)
const perRow = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  return [...dlg.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
    const inputs = [...tr.querySelectorAll('td .el-select__selected-item, td .el-select__placeholder')]
    return inputs.map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 2)
  })
})
console.log('APPLIED ' + applied + ' PER_ROW=' + JSON.stringify(perRow))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-02.json',
  JSON.stringify({ rail, cols, whOpts, whPicked, binPicked, bin, applied, perRow }, null, 2), 'utf8')

// 确定生单
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  const btn = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定生单'))
  btn?.click()
})
await page.waitForTimeout(9000)
const made = await page.evaluate(() => [...document.querySelectorAll('.el-message__content')].map((el) => (el.textContent || '').trim()))
console.log('MADE ' + JSON.stringify(made))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-02-made.json', JSON.stringify({ made }, null, 2), 'utf8')
