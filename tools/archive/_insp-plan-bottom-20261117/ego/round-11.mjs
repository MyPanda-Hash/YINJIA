// round-11:?new=1 建草稿 → 记下 docNo → ?docNo= 打开 → 加一行 → 频率下拉取证
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(8000)
const docNo = await page.evaluate(() => (document.body.innerText.match(/IP-\d{4}-\d{2}-\d{2}-\d{4}/) || [])[0] || null)
console.log('docNo after ?new=1:', docNo)
await page.goto(`http://localhost:5173/#/panelx/list/RD_INSP_PLAN?docNo=${encodeURIComponent(docNo || '')}`, { timeout: 60000 })
await page.waitForTimeout(7000)
const before = await page.evaluate(() => {
  const dt = document.querySelector('table.rs-dt')
  return {
    rows: dt ? [...dt.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('td.rs-td')).length : 0,
    editable: !!document.querySelector('.rsp-footer-field textarea'),
    addBtn: [...document.querySelectorAll('.rs-add')].map((e) => (e.textContent || '').trim()),
  }
})
console.log('before add row:', JSON.stringify(before))
if (before.addBtn.length) {
  await page.evaluate(() => {
    const add = [...document.querySelectorAll('.rs-add')][0]
    add.click()
  })
  await page.waitForTimeout(1500)
}
const after = await page.evaluate(() => {
  const dt = document.querySelector('table.rs-dt')
  return { rows: dt ? [...dt.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('td.rs-td')).length : 0 }
})
console.log('after add row:', JSON.stringify(after))
// 点新行里的「检查频率」下拉
const clicked = await page.evaluate(() => {
  const td = [...document.querySelectorAll('table.rs-dt tbody td.rs-td')].find((c) => c.querySelector('.el-select'))
  if (!td) return 'no select cell'
  const wrap = td.querySelector('.el-select__wrapper') || td.querySelector('.el-select')
  if (!wrap) return 'no wrapper'
  wrap.click()
  return 'clicked'
})
console.log('freq select:', clicked)
await page.waitForTimeout(1500)
console.log(JSON.stringify(await page.evaluate(() => ({
  visibleOptions: [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((e) => e.getBoundingClientRect().height > 0)
    .map((e) => (e.textContent || '').trim()),
})), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-11.png' })
