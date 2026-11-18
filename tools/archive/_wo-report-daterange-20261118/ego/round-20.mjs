const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.hover('loc=css:.query-date-range', { label: '悬停日期段控件' })
await page.waitForTimeout(600)
const vis = await page.evaluate(() => {
  const el = document.querySelector('.query-date-range .el-range__close-icon')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity }
})
console.log('close-icon style', JSON.stringify(vis))
await page.click('loc=css:.query-date-range .el-range__close-icon', { label: '清空日期段' })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const field = [...document.querySelectorAll('.udl-fields .field')].find((f) => (f.querySelector('label') || {}).textContent?.includes('单据日期'))
  return {
    inputs: field ? [...field.querySelectorAll('input')].map((i) => i.value) : null,
    count: (document.querySelector('.report-count') || {}).textContent,
    heading: (document.querySelector('.report-heading') || {}).textContent,
    footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
  }
})
console.log('CLEARED', JSON.stringify(info))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-20-cleared.png' })
