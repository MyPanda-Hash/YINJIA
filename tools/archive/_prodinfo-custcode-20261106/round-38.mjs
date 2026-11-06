const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
// 勾第一行 + 确定
const acted = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  if (!d) return 'NO_DIALOG'
  const cb = d.querySelector('.el-table__row .el-checkbox')
  if (!cb) return 'NO_CHECKBOX'
  cb.click()
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定'))
  if (!btn) return 'NO_CONFIRM'
  setTimeout(() => btn.click(), 200)
  return 'OK'
})
console.log('勾选+确定 =', acted)
await page.waitForTimeout(2500)
const vals = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const get = (label) => {
    const i = tds.findIndex((td) => (td.textContent || '').replace(/\s+/g, ' ').trim() === label)
    return i < 0 ? null : (tds[i + 1].textContent || '').replace(/\s+/g, ' ').trim()
  }
  return { 客户名称: get('客户名称'), 客户编码: get('客户编码'), 客户料号: get('客户料号') }
})
console.log('回填结果 =', JSON.stringify(vals))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prodinfo-cust-carry.png' })
console.log('shot =', shot)
