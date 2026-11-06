const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
// 定位「客户编码」那一格的参照控件并点开
const open = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const idx = tds.findIndex((td) => (td.textContent || '').replace(/\s+/g, ' ').trim() === '客户编码')
  if (idx < 0) return 'NO_LABEL'
  const valueTd = tds[idx + 1]
  const ctl = valueTd && valueTd.querySelector('.rs-ref-ctl')
  if (!ctl) return 'NO_CTL:' + (valueTd ? valueTd.innerHTML.slice(0, 120) : '')
  ctl.click()
  return 'CLICKED'
})
console.log('打开客户编码参照 =', open)
await page.waitForTimeout(3000)
const dlg = await page.evaluate(() => {
  const ds = [...document.querySelectorAll('.el-dialog')].filter((d) => d.getBoundingClientRect().height > 0)
  const d = ds[ds.length - 1]
  if (!d) return { error: 'NO_DIALOG' }
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    headers: [...d.querySelectorAll('th')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8),
    rows: [...d.querySelectorAll('.el-table__row')].slice(0, 5).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
    btns: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter(Boolean),
  }
})
console.log('参照弹窗 =', JSON.stringify(dlg, null, 1))
