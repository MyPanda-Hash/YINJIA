const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
const r = await page.evaluate(() => {
  // 「生产车间」值格 = 含 select 且有「标准库维护」的那个 td
  const tds = [...document.querySelectorAll('td')]
  const cell = tds.find((td) => td.querySelector('.el-select') && [...td.querySelectorAll('span,div')].some((e) => (e.textContent || '').trim() === '⧉ 标准库维护'))
  if (!cell) return { error: 'NO_CELL' }
  const btn = [...cell.querySelectorAll('span,div')].find((e) => (e.textContent || '').trim() === '⧉ 标准库维护')
  const before = (cell.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)
  btn.click()
  return { clicked: true, cellText: before }
})
console.log('点生产车间的标准库维护 =', JSON.stringify(r))
await page.waitForTimeout(2200)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  if (!d) return { error: 'NO_DIALOG' }
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    rows: [...d.querySelectorAll('li, .slm-item')].slice(0, 10).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)),
    btns: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter(Boolean),
  }
})
console.log('维护弹窗 =', JSON.stringify(dlg, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop-lib2.png' })
console.log('shot =', shot)
