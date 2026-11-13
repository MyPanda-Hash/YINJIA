// round-05：界面新建「常规工单」（主物料 A-32-01，订单数量 10，工艺路线默认已审核）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))

// 弹窗应仍然开着（round-04 打开后没关）；没有就重新打开
const open = await page.evaluate(() => !!document.querySelector('.woc-dlg'))
if (!open) {
  await page.click('text=新增')
  await page.waitForSelector('.woc-dlg', { state: 'visible', timeout: 8000 })
  await page.waitForTimeout(1500)
}

// ① 产品编码：点击第一个 el-select，输入 A-32-01，选第一项
const selects = await page.evaluate(() => [...document.querySelectorAll('.woc-form .el-select')].length)
console.log('下拉数=' + selects)
await page.click('.woc-form .el-select', { label: '产品编码下拉' })
await page.waitForTimeout(500)
await page.keyboard.type('A-32-01', { delay: 30 })
await page.waitForTimeout(1800)
const optCount = await page.evaluate(() => document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item').length)
console.log('产品候选数=' + optCount)
if (optCount > 0) {
  await page.click('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item >> nth=0', { label: '选主物料' })
}
await page.waitForTimeout(2000)
const filled = await page.evaluate(() => {
  const vals = {}
  for (const item of document.querySelectorAll('.woc-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const inp = item.querySelector('input')
    const sel = item.querySelector('.el-select__selected-item, .el-select__placeholder')
    vals[label] = (sel ? sel.textContent : (inp ? inp.value : '')) || ''
  }
  return vals
})
console.log('选后回填=' + JSON.stringify(filled))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r05-product-picked.png' })

// ② 订单数量 = 10（生产数量应自动同步 10）
const qtyInputs = await page.evaluate(() => [...document.querySelectorAll('.woc-form .el-input-number input')].map((i) => i.value))
console.log('数量输入框=' + JSON.stringify(qtyInputs))
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.woc-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '订单数量')
  const inp = item?.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '10')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await page.waitForTimeout(800)
const qtys = await page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.woc-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    if (label.includes('数量')) out[label] = item.querySelector('input')?.value
  }
  return out
})
console.log('数量=' + JSON.stringify(qtys))

// ③ 工艺路线：读当前值（默认应为 GY-CB-STD）
const route = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.woc-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '工艺路线')
  const txt = item?.querySelector('.el-select__selected-item')?.textContent || item?.querySelector('.el-select__placeholder')?.textContent || ''
  return txt.trim()
})
console.log('工艺路线=' + route)
if (!route) {
  await page.evaluate(() => {
    const item = [...document.querySelectorAll('.woc-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '工艺路线')
    item?.querySelector('.el-select')?.click()
  })
  await page.waitForTimeout(1000)
  const routeOpts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')].map((x) => (x.textContent || '').trim()))
  console.log('路线候选=' + JSON.stringify(routeOpts))
  const idx = routeOpts.findIndex((r) => r.startsWith('GY-CB-STD'))
  if (idx >= 0) await page.click(`.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item >> nth=${idx}`, { label: '选默认工艺路线' })
  await page.waitForTimeout(500)
}

// ④ 保存
await page.click('.woc-dlg .el-dialog__footer button.el-button--primary', { label: '保存常规工单' })
await page.waitForTimeout(4000)
const after = await page.evaluate(() => ({
  dialog: !!document.querySelector('.woc-dlg'),
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
  firstRow: (() => {
    const tr = document.querySelector('.wol-table .el-table__body tr')
    if (!tr) return null
    const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    const obj = {}
    ths.forEach((h, i) => { if (h && tds[i] !== undefined) obj[h] = tds[i] })
    return obj
  })(),
}))
console.log('保存后=' + JSON.stringify(after, null, 1).slice(0, 1600))
console.log('pageerrors=' + JSON.stringify(errors))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r05-normal-saved.png' })
