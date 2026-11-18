// round-02:选一条产线 → 明细行/日期列出来 → 打开「列设置」看弹窗(截图为证)
const task = await taskSpace('wo-board-column-settings-20261118')
const page = task.page('p1')

const clickLine = async () => {
  const ok = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.wb-line')]
    const hit = lines.find((el) => !el.classList.contains('off')) || lines[0]
    if (!hit) return null
    hit.click()
    return (hit.textContent || '').replace(/\s+/g, ' ').trim()
  })
  return ok
}
console.log('选中产线:', await clickLine())
await page.waitForTimeout(3500)

const state = await page.evaluate(() => ({
  行数: document.querySelectorAll('.el-table__body tr').length,
  日期列表头: [...document.querySelectorAll('.el-table__header th .dp-date')].map((el) => el.textContent.trim()),
  表头列数: document.querySelectorAll('.el-table__header th').length,
}))
console.log(JSON.stringify(state, null, 2))

await page.click('button.el-button:has-text("列设置")', { label: '打开列设置' }).catch(async () => {
  // :has-text 不是本 API 的语法 ⇒ 退回按文本找按钮
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '列设置')
    if (btn) btn.click()
  })
})
await page.waitForTimeout(1200)
const dlg = await page.evaluate(() => ({
  弹窗标题: (document.querySelector('.csd-dialog .el-dialog__title') || {}).textContent || null,
  条目: [...document.querySelectorAll('.csd-dialog .csd-item')].map((el) => ({
    label: (el.querySelector('.csd-label') || {}).textContent || '',
    checked: !!el.querySelector('.el-checkbox.is-checked'),
    locked: el.classList.contains('is-locked'),
  })),
  提示: [...document.querySelectorAll('.csd-dialog .csd-tip')].map((el) => el.textContent.trim()),
}))
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-02-dialog.png' })
