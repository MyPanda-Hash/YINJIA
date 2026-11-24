// round-10:收尾 —— 关掉本轮开的分页/任务空间(不 keep)
const task = await taskSpace('merge-pick-docs-20261124')
const pages = await task.pages()
console.log('PAGES', JSON.stringify(pages.map((p) => p.label)))
for (const p of pages) {
  try { await p.close() } catch (e) { console.log('close skip ' + p.label + ': ' + e.message) }
}
await task.finish({ keep: [] })
console.log('done round-10')
