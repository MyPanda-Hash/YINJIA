const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
const r = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const cell = tds.find((td) => {
    const sel = td.querySelector('.el-select')
    if (!sel) return false
    const t = (sel.textContent || '').replace(/\s+/g, ' ').trim()
    return /^D0\d/.test(t) || t === 'D05'
  })
  if (!cell) {
    const all = tds.filter((td) => td.querySelector('.el-select')).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24))
    return { error: 'NO_CELL', selects: all.slice(0, 12) }
  }
  const btn = [...cell.querySelectorAll('span,div')].find((e) => (e.textContent || '').trim() === '⧉ 标准库维护')
  const txt = (cell.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)
  if (btn) btn.click()
  return { cellText: txt, clicked: !!btn }
})
console.log('生产车间格 =', JSON.stringify(r))
await page.waitForTimeout(2200)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  if (!d) return { error: 'NO_DIALOG' }
  return { title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    rows: [...d.querySelectorAll('li, .slm-item')].slice(0, 10).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)),
    btns: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter(Boolean) }
})
console.log('维护弹窗 =', JSON.stringify(dlg, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop-lib3.png' })
console.log('shot =', shot)
