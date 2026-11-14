// round-07 — 紧凑状态 + 保存按钮可见性
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
const st = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const root = document.querySelector('.fi-sheet, [data-fi-sheet], .fi-grid')
  const dialogs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => ({
    title: txt(d.querySelector('.el-dialog__title')), body: txt(d).slice(0, 200),
  }))
  return {
    hash: location.hash,
    rootClass: root ? root.className : null,
    dialogs,
    side: [...document.querySelectorAll('.as-side-btn')].map((e) => ({ t: txt(e), cls: e.className })),
    editingClass: document.querySelector('.is-editing')?.className || null,
    inputs: document.querySelectorAll('.sample-row input').length,
    standardInputs: document.querySelectorAll('.standard-row input, .standard-row textarea').length,
    docStatusTags: [...document.querySelectorAll('.el-tag')].map((e) => txt(e)).filter(Boolean).slice(0, 6),
    aLeftCount: document.querySelectorAll('.a-left.dsr-no').length,
  }
})
console.log('STATE=' + JSON.stringify(st, null, 1))
console.log('DONE round-07')
