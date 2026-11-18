/**
 * 收尾:发出去之前把这次的开场证据留档,并交还浏览器(不 keep 任何页面)。
 */
const task = await taskSpace('other-ret-wh-20261119')
const pages = await task.pages()
console.log('本空间页面:', pages.map((p) => p.label).join(','))
await task.finish({ keep: [] })
