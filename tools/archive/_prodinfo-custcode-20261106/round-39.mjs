const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
// 反向:点「客户名称」→ 选另一个客户 → 客户编码应自动跟着变
const open = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const i = tds.findIndex((td) => (td.textContent || '').replace(/\s+/g, ' ').trim() === '客户名称')
  if (i < 0) return 'NO_LABEL'
  const ctl = tds[i + 1].querySelector('.rs-ref-ctl')
  if (!ctl) return 'NO_CTL'
  ctl.click(); return 'CLICKED'
})
console.log('打开客户名称参照 =', open)
await page.waitForTimeout(2500)
const acted = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.getBoundingClientRect().height > 0).pop()
  if (!d) return 'NO_DIALOG'
  const rows = [...d.querySelectorAll('.el-table__row')]
  const target = rows.find((r) => (r.innerText || '').includes('芯悦'))
  const cb = (target || rows[0]).querySelector('.el-checkbox')
  if (cb) cb.click()
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定'))
  if (btn) setTimeout(() => btn.click(), 200)
  return (target || rows[0]).innerText.replace(/\s+/g, ' ').trim().slice(0, 40)
})
console.log('选中的客户 =', acted)
await page.waitForTimeout(2500)
const vals = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const get = (label) => {
    const i = tds.findIndex((td) => (td.textContent || '').replace(/\s+/g, ' ').trim() === label)
    return i < 0 ? null : (tds[i + 1].textContent || '').replace(/\s+/g, ' ').trim()
  }
  return { 客户名称: get('客户名称'), 客户编码: get('客户编码') }
})
console.log('反向回填 =', JSON.stringify(vals))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prodinfo-cust-carry-rev.png' })
console.log('shot =', shot)
