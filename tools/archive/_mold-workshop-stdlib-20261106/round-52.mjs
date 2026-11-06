const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
// 点开「生产车间」下拉(值格里含 D05 的那个 select)
const opened = await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')]
  const target = sels.find((s) => (s.textContent || '').includes('D05')) || sels[sels.length - 1]
  if (!target) return 'NO_SELECT'
  const w = target.querySelector('.el-select__wrapper') || target
  w.click()
  return 'CLICKED:' + (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20)
})
console.log('点开下拉 =', opened)
await page.waitForTimeout(1200)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 12))
console.log('下拉选项 =', JSON.stringify(opts))
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
// 点「标准库维护」
const lib = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span,div')].find((e) => (e.textContent || '').trim() === '⧉ 标准库维护')
  if (!el) return 'NO_BTN'
  el.click(); return 'CLICKED'
})
console.log('标准库维护 =', lib)
await page.waitForTimeout(2200)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  if (!d) return { error: 'NO_DIALOG' }
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    rows: [...d.querySelectorAll('li, .slm-item, .el-table__row')].slice(0, 10).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)),
    btns: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter(Boolean).slice(0, 8),
  }
})
console.log('维护弹窗 =', JSON.stringify(dlg, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop-lib.png' })
console.log('shot =', shot)
