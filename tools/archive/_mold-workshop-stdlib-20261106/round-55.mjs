const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
const r = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const cell = tds.find((td) => {
    const sel = td.querySelector('.el-select')
    return sel && /^5#/.test((sel.textContent || '').replace(/\s+/g, ' ').trim())
  })
  if (!cell) return { error: 'NO_CELL' }
  const btn = [...cell.querySelectorAll('span,div')].find((e) => (e.textContent || '').trim() === '⧉ 标准库维护')
  if (btn) btn.click()
  return { clicked: !!btn }
})
console.log('点 5# 那格的维护 =', JSON.stringify(r))
await page.waitForTimeout(2200)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  if (!d) return { error: 'NO_DIALOG' }
  return { title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    rows: [...d.querySelectorAll('li, .slm-item')].slice(0, 10).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)),
    btns: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter(Boolean) }
})
console.log('维护弹窗 =', JSON.stringify(dlg, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop-lib4.png' })
console.log('shot =', shot)
