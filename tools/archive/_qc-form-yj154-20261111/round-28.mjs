// round-28:验证两处修复 ①新增检验项连点 3 次 = 3 行 ②处理意见下拉 4 个选项 + 提示
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')

const state = () => page.evaluate(() => {
  const sheet = document.querySelector('.qr-sheet')
  const rows = sheet ? [...sheet.querySelectorAll('.qr-grid tbody tr')] : []
  const th = [...document.querySelectorAll('.qr-foot-table th')].find((x) => (x.textContent || '').includes('处理意见'))
  const td = th?.nextElementSibling
  return {
    rows: rows.length,
    resultCells: sheet ? sheet.querySelectorAll('.qr-grid tbody .c-result').length : 0,
    rowTexts: rows.map((tr) => [...tr.querySelectorAll('td')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 7)),
    disposalTitle: td?.querySelector('.el-select')?.getAttribute('title') || td?.querySelector('.el-select__wrapper')?.getAttribute('title') || null,
    disposalPlaceholder: (td?.querySelector('.el-select__placeholder')?.textContent || '').trim(),
  }
})

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6500)
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(3000)
console.log('BASE=' + JSON.stringify(await state()))
for (let i = 1; i <= 3; i++) {
  await page.evaluate(() => [...document.querySelectorAll('.qr-band-acts .qr-band-act')].find((x) => (x.textContent || '').includes('新增检验项'))?.click())
  await page.waitForTimeout(1200)
  const s = await state()
  console.log('ADD_' + i + ' rows=' + s.rows + ' resultCells=' + s.resultCells + ' texts=' + JSON.stringify(s.rowTexts.map((r) => r.slice(0, 2))))
}
// 处理意见下拉
const opened = await page.evaluate(() => {
  const th = [...document.querySelectorAll('.qr-foot-table th')].find((x) => (x.textContent || '').includes('处理意见'))
  const w = th?.nextElementSibling?.querySelector('.el-select__wrapper')
  if (!w) return false
  w.click()
  return true
})
await page.waitForTimeout(1200)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')].filter((l) => l.offsetParent !== null).map((l) => [...l.querySelectorAll('.el-select-dropdown__item')].map((li) => (li.textContent || '').trim())))
const st = await state()
console.log('DISPOSAL=' + JSON.stringify({ opened, opts, title: st.disposalTitle }))
await page.evaluate(() => location.reload())
await page.waitForTimeout(2500)
