const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
// 面板可能已开(round-17),这里确保打开
if (!(await page.evaluate(() => !!document.querySelector('.el-picker-panel')))) {
  await page.click('loc=css:.query-date-range', { label: '打开单据日期区间' })
  await page.waitForTimeout(800)
}
await page.click('text=上月', { label: '选择上月区间' })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const field = [...document.querySelectorAll('.udl-fields .field')].find((f) => (f.querySelector('label') || {}).textContent?.includes('单据日期'))
  const dates = [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => (tr.querySelectorAll('td')[2] || {}).textContent?.trim()).filter(Boolean)
  return {
    heading: (document.querySelector('.report-heading') || {}).textContent,
    count: (document.querySelector('.report-count') || {}).textContent,
    inputs: field ? [...field.querySelectorAll('input')].map((i) => i.value) : null,
    footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
    rowDates: { first: dates[0], last: dates[dates.length - 1], n: dates.length },
    toast: [...document.querySelectorAll('.el-message')].map((m) => m.textContent.trim()),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-18.png' })
