const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const rows = await page.evaluate(() => [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => {
  const itemSel = tr.querySelector('td.c-item .el-select__selected-item')
  const itemInput = tr.querySelector('td.c-item input')
  const std = tr.querySelector('td.c-std textarea')
  return {
    item: itemSel ? (itemSel.textContent || '').trim() : (itemInput ? itemInput.value : ''),
    std: std ? std.value.slice(0, 40) : '',
  }
}))
console.log(JSON.stringify(rows, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-76-carry-rows.png' })
