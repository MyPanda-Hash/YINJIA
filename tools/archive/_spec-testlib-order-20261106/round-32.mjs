const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
const pos = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('检验项目标准库')).pop()
  if (!dlg) return 'NO_DIALOG'
  const groups = [...dlg.querySelectorAll('.lib-group')]
  const t = groups.find((g) => ((g.querySelector('.lib-group-name') || {}).textContent || '').includes('黄水'))
  if (t) t.scrollIntoView({ block: 'start' })
  return groups.map((g) => ((g.querySelector('.lib-group-name') || {}).textContent || '').trim()).slice(5, 13)
})
console.log('滚动到的邻域 =', JSON.stringify(pos))
await page.waitForTimeout(900)
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/after-add-missing.png' })
console.log('shot =', shot)
