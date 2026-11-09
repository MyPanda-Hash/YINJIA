const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
const findByColumn = async () => page.evaluate(() => {
  // 找「生产车间」标签格 → 取同一列下一行的值格(纸面是 标签行/值行 两行式)
  const rows = [...document.querySelectorAll('tr')]
  for (let r = 0; r < rows.length; r++) {
    const cells = [...rows[r].children]
    const ci = cells.findIndex((c) => (c.textContent || '').replace(/\s+/g, ' ').trim() === '生产车间')
    if (ci < 0) continue
    const next = rows[r + 1]
    if (!next) continue
    const vc = [...next.children][ci]
    if (!vc) continue
    const hasSelect = !!vc.querySelector('.el-select')
    const libBtn = [...vc.querySelectorAll('span,div,button')].map((e) => (e.textContent || '').trim()).filter((t) => t.includes('标准库'))
    return { rowIdx: r, colIdx: ci, hasSelect, libBtn, text: (vc.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), html: vc.innerHTML.slice(0, 200) }
  }
  return { error: 'NOT_FOUND' }
})
console.log('烧结工艺清单 =', JSON.stringify(await findByColumn(), null, 1))
const shot1 = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop-1.png' })
console.log('shot1 =', shot1)
// 切到 X烧结工艺清单
const tab = await page.evaluate(() => {
  const t = [...document.querySelectorAll('.rsp-page-tab, [class*="page-tab"], .rsp-tab, button, div')].find((e) => (e.textContent || '').trim() === 'X烧结工艺清单')
  if (!t) return 'NO_TAB'
  t.click(); return 'OK'
})
console.log('切 X烧结 =', tab)
await page.waitForTimeout(3500)
console.log('X烧结 =', JSON.stringify(await findByColumn(), null, 1))
const shot2 = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-workshop-2.png' })
console.log('shot2 =', shot2)
