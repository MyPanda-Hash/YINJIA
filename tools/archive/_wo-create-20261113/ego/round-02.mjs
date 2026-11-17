// round-02：列设置弹窗 + 工单类型列 + 日排产日期列整组显隐（保存往返）
const task = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(task.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const snap = async () => await page.evaluate(() => ({
  dialogOpen: !!document.querySelector('.csd-dialog'),
  items: [...document.querySelectorAll('.csd-dialog .csd-item .csd-label')].map((x) => (x.textContent || '').trim()),
  checked: [...document.querySelectorAll('.csd-dialog .csd-item')].filter((row) => row.querySelector('.el-checkbox.is-checked')).map((row) => (row.querySelector('.csd-label') || {}).textContent || ''),
  count: (document.querySelector('.csd-dialog .csd-count') || {}).textContent || '',
}))

// 打开列设置
await page.click('text=列设置')
await page.waitForSelector('.csd-dialog', { state: 'visible', timeout: 8000 })
await page.waitForTimeout(600)
const s1 = await snap()
console.log('列设置弹窗: count=' + s1.count)
console.log('列项:' + JSON.stringify(s1.items))
console.log('已勾选数=' + s1.checked.length)
console.log('含工单类型=' + s1.items.includes('工单类型') + ' 含日排产日期列=' + s1.items.includes('日排产日期列'))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r02-colset.png' })

// 取消「日排产日期列」→ 保存 → 日期列应消失
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.csd-dialog .csd-item')].find((r) => (r.querySelector('.csd-label') || {}).textContent === '日排产日期列')
  const box = row && row.querySelector('.el-checkbox')
  if (box) box.click()
})
await page.waitForTimeout(300)
await page.click('.csd-dialog__footer, .csd-dialog .el-dialog__footer button.el-button--primary, text=保存')
await page.waitForTimeout(2500)
const afterHide = await page.evaluate(() => ({
  dateCols: [...document.querySelectorAll('.wol-table th')].filter((th) => /^\d{2}-\d{2}$/.test((th.textContent || '').trim())).length,
  toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
}))
console.log('隐藏日期列后: 日期列数=' + afterHide.dateCols + ' toast=' + JSON.stringify(afterHide.toast))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r02-dates-hidden.png' })

// 恢复：再打开，勾回「日排产日期列」，保存
await page.waitForTimeout(800)
await page.click('text=列设置')
await page.waitForSelector('.csd-dialog', { state: 'visible', timeout: 8000 })
await page.waitForTimeout(500)
const s2 = await snap()
console.log('重新打开: 日排产日期列勾选状态=' + s2.checked.includes('日排产日期列') + ' count=' + s2.count)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.csd-dialog .csd-item')].find((r) => (r.querySelector('.csd-label') || {}).textContent === '日排产日期列')
  const box = row && row.querySelector('.el-checkbox')
  if (box) box.click()
})
await page.waitForTimeout(300)
await page.click('.csd-dialog .el-dialog__footer button.el-button--primary')
await page.waitForTimeout(2500)
const afterShow = await page.evaluate(() => ({
  dateCols: [...document.querySelectorAll('.wol-table th')].filter((th) => /^\d{2}-\d{2}$/.test((th.textContent || '').trim())).length,
  headers: [...document.querySelectorAll('.wol-table th')].slice(0, 6).map((th) => (th.textContent || '').trim()),
  hasTypeCo: [...document.querySelectorAll('.wol-table th')].some((th) => (th.textContent || '').trim() === '工单类型'),
}))
console.log('恢复后: 日期列数=' + afterShow.dateCols + ' 工单类型列=' + afterShow.hasTypeCo + ' 头=' + JSON.stringify(afterShow.headers))
console.log('pageerrors=' + JSON.stringify(errors))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r02-restored.png' })
