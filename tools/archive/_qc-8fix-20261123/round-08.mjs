// round-08: 切到「全部」页签, 找新单并选中; 打开编辑态
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
const dumpList = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-row, .ds-row, .drp-row, .el-table__row, .doc-dir-row')]
  return {
    rowCount: rows.length,
    classes: [...new Set(rows.map((r) => String(r.className)))].slice(0, 6),
    texts: rows.slice(0, 8).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
    body: (document.querySelector('.ds-result, .doc-select, .dsr, .el-table')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  }
})
console.log('before:', JSON.stringify(await dumpList(), null, 1))
const clickTab = async (t) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.dsr-tab')].find((x) => (x.innerText || '').trim() === t)
    if (el) { el.click(); return true }
    return false
  }, t)
  console.log('tab', t, ok)
  await page.waitForTimeout(2500)
}
await clickTab('全部')
console.log('after all:', JSON.stringify(await dumpList(), null, 1))
