// round-07：可靠地界面新建「常规工单」（用 DOM 定位 label + JS 事件填值）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))

// 关掉可能残留的下拉/弹窗
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
const dlgVisible = async () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.woc-dlg')].find((x) => x.getBoundingClientRect().width > 100)
  return !!d
})
if (!(await dlgVisible())) {
  // 若列设置弹窗还开着，先取消
  await page.evaluate(() => {
    for (const dlg of document.querySelectorAll('.csd-dialog')) {
      if (dlg.getBoundingClientRect().width > 0) {
        const cancel = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')
        cancel?.click()
      }
    }
  })
  await page.waitForTimeout(800)
  await page.click('text=新增', { label: '打开新增弹窗' })
  await page.waitForTimeout(2500)
}
console.log('弹窗可见=' + (await dlgVisible()))

// ① 产品编码：DOM 定位 + 输入事件触发远程搜索，再点候选
const picked = await page.evaluate(async () => {
  const item = [...document.querySelectorAll('.woc-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  if (!inp) return { err: 'no-input' }
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'A-32-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true, value: inp.value }
})
console.log('输入产品关键字=' + JSON.stringify(picked))
await page.waitForTimeout(2200)
const cand = await page.evaluate(() => {
  const list = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.getBoundingClientRect().height > 0)
    .map((x) => (x.textContent || '').trim())
  return list
})
console.log('候选=' + JSON.stringify(cand.slice(0, 5)))
// 点第一个含 A-32-01 的候选
const hit = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.getBoundingClientRect().height > 0)
    .find((x) => (x.textContent || '').includes('A-32-01'))
  if (!el) return false
  el.click()
  return true
})
console.log('已选主物料=' + hit)
await page.waitForTimeout(2500)
const st = async () => page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.woc-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const sel = item.querySelector('.el-select__selected-item') || item.querySelector('.el-select__placeholder')
    const inp = item.querySelector('input')
    out[label] = ((sel ? sel.textContent : (inp ? inp.value : '')) || '').trim()
  }
  return out
})
console.log('选后=' + JSON.stringify(await st()))

// ② 订单数量 = 10（生产数量应同步）
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
await page.waitForTimeout(1000)
console.log('填数量后=' + JSON.stringify(await st()))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r07-normal-filled.png' })

// ③ 保存（JS 点主按钮）
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.woc-dlg')].find((x) => x.getBoundingClientRect().width > 100)
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '保存')
  btn?.click()
})
await page.waitForTimeout(5000)
const after = await page.evaluate(() => ({
  dialog: [...document.querySelectorAll('.woc-dlg')].some((x) => x.getBoundingClientRect().width > 100),
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
  rows: [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 2).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300)),
}))
console.log('保存后=' + JSON.stringify(after, null, 1))
console.log('pageerrors=' + JSON.stringify(errors))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r07-normal-saved.png' })
