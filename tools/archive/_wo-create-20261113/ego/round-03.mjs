// round-03：接续 round-02（弹窗已打开、日排产日期列草稿已取消勾选）→ 保存 → 再恢复
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const state = async () => await page.evaluate(() => ({
  dialog: !!document.querySelector('.csd-dialog'),
  count: (document.querySelector('.csd-dialog .csd-count') || {}).textContent || '',
  dateCols: [...document.querySelectorAll('.wol-table th')].filter((th) => /^\d{2}-\d{2}$/.test((th.textContent || '').trim())).length,
  typeCol: [...document.querySelectorAll('.wol-table th')].some((th) => (th.textContent || '').trim() === '工单类型'),
}))
console.log('初始=' + JSON.stringify(await state()))
if (!(await state()).dialog) {
  await page.click('text=列设置')
  await page.waitForSelector('.csd-dialog', { state: 'visible', timeout: 8000 })
  await page.waitForTimeout(500)
}
// 保存（主按钮 = 保存）
await page.click('.csd-dialog .el-dialog__footer button.el-button--primary')
await page.waitForTimeout(2500)
console.log('保存后=' + JSON.stringify(await state()))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r03-dates-hidden.png' })

// 重新打开，勾回「日排产日期列」并保存
await page.click('text=列设置')
await page.waitForSelector('.csd-dialog', { state: 'visible', timeout: 8000 })
await page.waitForTimeout(500)
const before = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.csd-dialog .csd-item')].find((r) => (r.querySelector('.csd-label') || {}).textContent === '日排产日期列')
  return { checked: !!row?.querySelector('.el-checkbox.is-checked'), count: (document.querySelector('.csd-dialog .csd-count') || {}).textContent }
})
console.log('重开：日排产日期列 checked=' + before.checked + ' ' + before.count)
if (!before.checked) {
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.csd-dialog .csd-item')].find((r) => (r.querySelector('.csd-label') || {}).textContent === '日排产日期列')
    row?.querySelector('.el-checkbox')?.click()
  })
  await page.waitForTimeout(300)
}
await page.click('.csd-dialog .el-dialog__footer button.el-button--primary')
await page.waitForTimeout(2500)
const after = await state()
console.log('恢复后=' + JSON.stringify(after))
// 工单类型列有值（前几行应有 常规/临时）
const typeVals = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wol-table th')]
  const idx = ths.findIndex((th) => (th.textContent || '').trim() === '工单类型')
  if (idx < 0) return []
  return [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 6)
    .map((tr) => ((tr.querySelectorAll('td')[idx] || {}).textContent || '').trim())
})
console.log('工单类型列前 6 行=' + JSON.stringify(typeVals))
console.log('pageerrors=' + JSON.stringify(errors))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r03-restored.png' })
