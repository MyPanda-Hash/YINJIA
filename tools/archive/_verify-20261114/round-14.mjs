const task = await takeOverTaskSpace(3)
const tabs = await task.tabs()
console.log('TABS=' + JSON.stringify(tabs.map((t) => ({ label: t.label, title: t.title, url: t.url, active: t.active, openedBy: t.openedBy })), null, 1))
for (const t of tabs) { if (!t.label) { const p = await task.adopt(t.page); console.log('ADOPTED=' + p.label + ' url=' + (await p.url())) } }
const pages = await task.pages()
console.log('PAGES=' + JSON.stringify(pages.map((p) => p.label)))
if (pages.length) {
  const p = pages[0]
  console.log('URL=' + await p.url())
  const st = await p.evaluate(() => ({ hash: location.hash, title: document.title }))
  console.log('STATE=' + JSON.stringify(st))
}
console.log('DONE round-14')
