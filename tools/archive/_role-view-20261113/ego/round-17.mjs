// round-17.mjs —— 表头调整里「恢复继承」→ 供应商那一格回到纸上(把临时状态清干净)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

await page.evaluate(() => document.body.click())
await page.waitForTimeout(500)

await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  more?.closest('.tb-group')?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表头调整')
  if (it) it.click()
})
await page.waitForTimeout(1600)

const clicked = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表头调整'))
  const btn = [...(box?.querySelectorAll('.el-dialog__footer button') || [])].find((b) => (b.textContent || '').trim() === '恢复继承')
  if (btn) btn.click()
  return !!btn
})
console.log('点恢复继承 = ' + clicked)
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-message-box__btns button')]
  const ok = btns.find((b) => /确定|OK/.test((b.textContent || '').trim()))
  if (ok) ok.click()
})
await page.waitForTimeout(4000)

const after = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  hasSupplierCell: [...document.querySelectorAll('.el-form-item__label, .hd-label, .cell-label, label')]
    .some((e) => (e.textContent || '').replace(/[:：\s]/g, '') === '供应商'),
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').split('附件')[0].slice(-160),
}))
console.log(JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-17-header-restored.png' })
