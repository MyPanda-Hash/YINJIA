// round-06：界面新建「常规工单」（nth 精确选下拉；常规页签）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
if (!(await page.evaluate(() => !!document.querySelector('.woc-dlg')))) {
  await page.click('text=新增')
  await page.waitForSelector('.woc-dlg', { state: 'visible', timeout: 8000 })
  await page.waitForTimeout(1800)
}
const formState = async () => page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.woc-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const sel = item.querySelector('.el-select__selected-item') || item.querySelector('.el-select__placeholder')
    const inp = item.querySelector('input')
    out[label] = (sel ? sel.textContent : (inp ? inp.value : '')) || ''
  }
  return out
})
// ① 产品编码：第 1 个 select
await page.click('.woc-form .el-select >> nth=0', { label: '产品编码下拉' })
await page.waitForTimeout(500)
await page.keyboard.type('A-32-01', { delay: 30 })
await page.waitForTimeout(2000)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')].map((x) => (x.textContent || '').trim()))
console.log('产品候选=' + JSON.stringify(opts.slice(0, 5)))
if (opts.length) await page.click('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item >> nth=0', { label: '选主物料' })
await page.waitForTimeout(2200)
console.log('选产品后=' + JSON.stringify(await formState()))

// ② 订单数量 = 10
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.woc-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '订单数量')
  const inp = item?.querySelector('input')
  if (!inp) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '10')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await page.waitForTimeout(900)
console.log('填数量后=' + JSON.stringify(await formState()))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r06-normal-filled.png' })

// ③ 保存
await page.click('.woc-dlg .el-dialog__footer button.el-button--primary', { label: '保存常规工单' })
await page.waitForTimeout(4500)
const after = await page.evaluate(() => ({
  dialog: !!document.querySelector('.woc-dlg'),
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
  firstRows: [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 2).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260)),
}))
console.log('保存后=' + JSON.stringify(after, null, 1))
console.log('pageerrors=' + JSON.stringify(errors))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r06-normal-saved.png' })
