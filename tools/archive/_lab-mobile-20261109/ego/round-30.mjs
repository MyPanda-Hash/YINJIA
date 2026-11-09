const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// ① 先取消误触的「删除确认」——数据库里什么都没删(当前 第 0/0,没有打开的单)
await page.click('loc=role:button[name="取消"]')
await page.waitForTimeout(800)
// ② 用文本精确点「查询单据」
await page.click('css:.approval-side .as-side-btn:text-is("查询单据")')
await page.waitForTimeout(2500)
const d1 = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return dlg ? {
    title: dlg.querySelector('.el-dialog__title')?.textContent?.trim(),
    text: (dlg.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    rows: [...dlg.querySelectorAll('tbody tr')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
    buttons: [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 10),
  } : null
})
console.log('d1=' + JSON.stringify(d1, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-30-query.png' })
