// round-04：确认列设置落库（刷新后仍在）→ 打开「新增生产工单」弹窗并记录表单/页签
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
// 关掉可能还在的列设置弹窗
await page.evaluate(() => {
  const dlg = document.querySelector('.csd-dialog')
  if (!dlg) return
  const cancel = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')
  cancel?.click()
})
await page.waitForTimeout(800)
// 刷新页面：列设置应保留（后端持久化 panelCode=WORK_ORDER_LIST）
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
const persisted = await page.evaluate(() => ({
  typeCol: [...document.querySelectorAll('.wol-table th')].some((th) => (th.textContent || '').trim() === '工单类型'),
  dateCols: [...document.querySelectorAll('.wol-table th')].filter((th) => /^\d{2}-\d{2}$/.test((th.textContent || '').trim())).length,
  colSetBtn: [...document.querySelectorAll('.wol-btns button')].some((b) => (b.textContent || '').trim() === '列设置'),
}))
console.log('刷新后列设置持久化=' + JSON.stringify(persisted))

// 打开新增弹窗
await page.click('text=新增')
await page.waitForSelector('.woc-dlg', { state: 'visible', timeout: 8000 })
await page.waitForTimeout(2000)
const dlg = await page.evaluate(() => {
  const d = document.querySelector('.woc-dlg')
  const tabs = [...d.querySelectorAll('.el-tabs__item')].map((x) => (x.textContent || '').trim())
  const labels = [...d.querySelectorAll('.el-form-item__label')].map((x) => (x.textContent || '').trim())
  const inputs = [...d.querySelectorAll('.el-form-item')].map((item) => ({
    label: (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || '',
    value: (item.querySelector('input') || {}).value || '',
  }))
  const btns = [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean)
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    tabs, labels, inputs, btns,
    requiredStars: [...d.querySelectorAll('.el-form-item.is-required .el-form-item__label')].map((x) => (x.textContent || '').trim()),
  }
})
console.log('弹窗标题=' + dlg.title + ' 页签=' + JSON.stringify(dlg.tabs))
console.log('必填=' + JSON.stringify(dlg.requiredStars))
console.log('字段值=' + JSON.stringify(dlg.inputs))
console.log('按钮=' + JSON.stringify(dlg.btns))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r04-create-normal.png' })
console.log('pageerrors=' + JSON.stringify(errors))
