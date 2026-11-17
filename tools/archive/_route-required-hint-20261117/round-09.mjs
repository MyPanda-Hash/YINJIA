const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const before = await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
}))
console.log('before:', JSON.stringify(before))

// ① 新增(测试库上建一张空白草稿,后面会删掉)
await page.evaluate(() => {
  const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '新增')
  if (s) s.click()
})
await page.waitForTimeout(5000)
console.log('afterAdd:', JSON.stringify(await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  headValues: [...document.querySelectorAll('.fields .field')].map((f) => ({ code: f.dataset.code, value: f.querySelector('input')?.value ?? '' })),
  rowCount: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
}))))

// ② 点第一行「工序编码」格 → 起一行并弹参照
await page.evaluate(() => {
  const tr = document.querySelector('.el-table__body-wrapper tbody tr')
  const td = tr?.querySelectorAll('td')?.[0]
  if (td) td.click()
})
await page.waitForTimeout(2500)
console.log('dialog:', JSON.stringify(await page.evaluate(() => ({
  visible: !!document.querySelector('.el-dialog'),
  title: (document.querySelector('.el-dialog__title')?.textContent || '').trim(),
  rows: document.querySelectorAll('.el-dialog .el-table__body-wrapper tbody tr').length,
  firstRow: [...(document.querySelector('.el-dialog .el-table__body-wrapper tbody tr')?.querySelectorAll('td') || [])].slice(0, 4).map((td) => (td.innerText || '').trim()),
}))))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-09-refpick.png' })
