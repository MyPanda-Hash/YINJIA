const task = await takeOverTaskSpace(3)
const pages = await task.pages()
const p = pages[0]
console.log('URL=' + await p.url())
const st = await p.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    dialogs: [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null).map((x) => txt(x.querySelector('.el-dialog__title'))),
    msgs: [...document.querySelectorAll('.el-message')].map((m) => txt(m)),
    anchors: [...document.querySelectorAll('a[download]')].length,
    sheet: !!document.querySelector('.fi-grid'),
  }
})
console.log('STATE=' + JSON.stringify(st))
const tabs = await task.tabs()
console.log('TABS=' + JSON.stringify(tabs.map((t) => ({ label: t.label, title: t.title, url: t.url, active: t.active }))))
console.log('DONE round-15')
