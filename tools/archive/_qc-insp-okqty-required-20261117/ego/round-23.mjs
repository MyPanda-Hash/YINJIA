// round-23: 逐行 dump 明细(不保存),看新增行的 送检数量/合格数量/不合格数量 到底是什么
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
await page.goto(`${BASE}/#/panelx/list/QC_INSP`, { timeout: 30000 })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  for (const tr of rows) if ((tr.textContent || '').includes('草稿')) { (tr.querySelector('td') || tr).click(); return }
  if (rows.length) (rows[0].querySelector('td') || rows[0]).click()
})
await page.waitForTimeout(5000)

const dump = async (tag) => {
  const d = await page.evaluate(() => {
    const ths = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/[⇅×]/g, '').trim())
    const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
    return rows.map((tr, i) => ({
      i,
      cls: tr.className,
      cells: [...tr.querySelectorAll('td')].map((td) => ((td.textContent || '').trim() || '∅')),
      vals: [...tr.querySelectorAll('td')].map((td) => td.querySelector('input')?.value ?? null).filter((v) => v !== null),
    }))
  })
  console.log('--- ' + tag + ' ---')
  console.log('列 =', JSON.stringify(d?.[0] ? undefined : undefined))
  d.forEach((r) => console.log(`row${r.i} [${r.cls}]`, JSON.stringify(r.cells)))
  return d
}
await dump('点新增前')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, .el-button, .as-side-btn, span, div')]
    .filter((e) => e.offsetParent !== null && /^(\+ )?新增数据$/.test((e.textContent || '').trim()))
  if (btn.length) btn[0].click()
})
await page.waitForTimeout(2000)
await dump('点新增后')
console.log('done round-23(未保存)')
