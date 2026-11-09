const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn, button')].find((x) => (x.textContent || '').trim() === '新增')
  if (!b) return 'NO_BTN'
  b.click(); return 'CLICKED'
})
console.log('点新增 =', clicked)
await page.waitForTimeout(3500)
const st = await page.evaluate(() => ({
  msg: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()).slice(0, 2),
  buttons: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').trim()).slice(0, 10),
  addRow: [...document.querySelectorAll('button, .ds-add-row, [class*="add-row"]')].map((b) => (b.textContent || '').replace(/\s+/g, '')).filter((t) => /新增样品|新增行/.test(t)).slice(0, 3),
  rowEditable: document.querySelectorAll('table input, table textarea').length,
  heads: [...document.querySelectorAll('table thead th')].map((e) => (e.textContent || '').trim()).slice(0, 15),
}))
console.log('草稿态 =', JSON.stringify(st, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/local-sample-int-new.png' })
console.log('shot =', shot)
