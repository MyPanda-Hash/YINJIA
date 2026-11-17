const task = await taskSpace('purin-whpick-20261117')
const page = task.page('p1')

// 单仓路径:点第 2 行仓库格 → 只勾一个(车间仓)→ 确定 → 行数不变、仓库改掉
const out = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const rows0 = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  const heads = [...document.querySelectorAll('.detail .el-table__header-wrapper th')].map((th) => (th.textContent || '').trim())
  const idx = heads.indexOf('仓库')
  rows0[1].querySelectorAll('td')[idx]?.querySelector('.ref-cell')?.click()
  await sleep(2600)
  const dlg = () => [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const items = [...dlg().querySelectorAll('.pwp-item')]
  const node = (n) => items.find((d) => (d.querySelector('.pwp-name')?.textContent || '').trim() === n)
  // 取消成品B仓,只留车间仓
  if (node('成品B仓')?.querySelector('.el-checkbox.is-checked')) node('成品B仓').querySelector('.el-checkbox').click()
  await sleep(250)
  node('车间仓')?.querySelector('.el-checkbox')?.click()
  await sleep(400)
  const sumText = (dlg().querySelector('.pwp-sum')?.textContent || '').replace(/\s+/g, ' ').trim()
  const hint = (dlg().querySelector('.pwp-hint')?.textContent || '').trim()
  const okBtn = [...dlg().querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  const disabled = okBtn?.disabled
  if (!disabled) okBtn.click()
  await sleep(2500)
  const rows1 = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  return {
    sumText, hint, disabled,
    rowCount: rows1.length,
    row2: (rows1[1]?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70),
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whpick-20261117/g7-single.png' })
