const task = await taskSpace('purin-whgroup')
const page = task.page('p1')

// 重新打开弹窗(页面刚重载过,直接点按钮)
const openRes = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const btn = [...document.querySelectorAll('.tools .tb-main')].filter(vis).find((b) => (b.textContent || '').trim() === '多仓库入库')
  btn?.click()
  await sleep(3500)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return 'no-dialog'
  return {
    rows: [...dlg.querySelectorAll('.el-table__body-wrapper tr')].filter(vis).map((tr) => ({
      cls: tr.className.includes('pmw-alloc-row') ? 'alloc' : 'line',
      text: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44),
    })),
    foot: (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('OPEN=' + JSON.stringify(openRes, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whgroup/g8-grouped.png' })

// 点「合并回一行」→ 确定
const mergeRes = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '合并回一行')
  if (!btn) return 'no-btn'
  btn.click()
  await sleep(700)
  const allocs = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const foot = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  const ok = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  const out = { allocRows: allocs.length, foot, disabled: ok?.disabled }
  if (!ok?.disabled) ok.click()
  await sleep(8000)
  return out
})
console.log('MERGE=' + JSON.stringify(mergeRes))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whgroup/g9-merged.png' })
