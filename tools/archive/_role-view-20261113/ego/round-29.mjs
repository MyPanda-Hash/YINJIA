// round-29.mjs —— 采购订单:本角色作用域里的「必填」标签 + 新增单据时明细的红星
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(7000)

await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  more?.closest('.tb-group')?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表格调整')
  if (it) it.click()
})
await page.waitForTimeout(1800)
// 切到「本角色」(这一层才会显示「必填」标签)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const role = [...box.querySelectorAll('.col-pref-scope .el-radio-button')].find((e) => (e.textContent || '').trim().startsWith('本角色'))
  if (role) role.click()
})
await page.waitForTimeout(1600)

const rows = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const want = ['单价', '仓库', '数量', '物料编码', '含税单价']
  return [...box.querySelectorAll('.col-pref-row')]
    .map((r) => (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => want.some((w) => t.startsWith(w)))
})
console.log('本角色作用域(带「必填」标签的才算必填) = ' + JSON.stringify(rows, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-29-role-required-tags.png' })

await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  box?.querySelector('.el-dialog__headerbtn')?.click()
})
await page.waitForTimeout(600)

// 新增:看明细单元格有没有红星(截图靠肉眼)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '新增')
  b?.closest('.tb-group')?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(4000)
const newForm = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  return {
    hash: location.hash,
    hasStar: txt.includes('*'),
    // 明细表格列头(含红星时通常以 * 前缀出现)
    headers: [...document.querySelectorAll('.el-table__header th')].map((t) => (t.textContent || '').replace(/\s+/g, '')).filter(Boolean).slice(0, 14),
  }
})
console.log('新增态 = ' + JSON.stringify(newForm, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-29-new-doc.png' })
