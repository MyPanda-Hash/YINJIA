// round-08 — 单行紧凑状态
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
const st = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const dialogs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => ({
    title: txt(d.querySelector('.el-dialog__title')), body: txt(d).slice(0, 160),
  }))
  const overlays = [...document.querySelectorAll('.el-overlay')].filter((d) => d.offsetParent !== null).length
  return {
    hash: location.hash,
    dialogs,
    overlays,
    editing: !!document.querySelector('.fi-sheet.is-editing'),
    inputs: document.querySelectorAll('.sample-row input').length,
    title: document.title,
    firstRowNo: txt(document.querySelector('.a-left.dsr-no')),
    selCur: txt(document.querySelector('.el-table__body-wrapper tbody tr.current-row') || document.querySelector('tr.current-row')),
  }
})
console.log('STATE=' + JSON.stringify(st))
console.log('DONE round-08')
