const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
// 1) 翻到最后一页:合计应仍是整段 647737(不是本页合计)
await page.click('.page-btn >> nth=-1', { label: '翻到最后一页' }).catch(async () => {
  const btns = await page.evaluate(() => [...document.querySelectorAll('.page-btn')].length)
  console.log('page-btn count', btns)
})
await page.waitForTimeout(2000)
let info = await page.evaluate(() => ({
  pageNo: (document.querySelector('.page-no') || {}).textContent,
  count: (document.querySelector('.report-count') || {}).textContent,
  footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
  heading: (document.querySelector('.report-heading') || {}).textContent,
}))
console.log('PAGE7', JSON.stringify(info))
// 2) 滚到表底,截图取合计行证据
await page.evaluate(() => {
  const wrap = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') || document.querySelector('.el-table__body-wrapper')
  if (wrap) wrap.scrollTop = wrap.scrollHeight
})
await page.waitForTimeout(800)
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-19-p7-footer.png' })
// 3) 清空日期段:回到全量 1189 / 合计 2990968
await page.click('loc=css:.query-date-range .el-range__close-icon', { label: '清空日期段' })
await page.waitForTimeout(2500)
info = await page.evaluate(() => {
  const field = [...document.querySelectorAll('.udl-fields .field')].find((f) => (f.querySelector('label') || {}).textContent?.includes('单据日期'))
  return {
    inputs: field ? [...field.querySelectorAll('input')].map((i) => i.value) : null,
    count: (document.querySelector('.report-count') || {}).textContent,
    heading: (document.querySelector('.report-heading') || {}).textContent,
    footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
  }
})
console.log('CLEARED', JSON.stringify(info))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-19-cleared.png' })
