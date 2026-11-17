// round-12 — 接管被浏览器提示打断的空间,看当前状态
const spaces = await listTaskSpaces()
console.log('SPACES=' + JSON.stringify(spaces, null, 1))
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114'))
if (!entry) { console.log('NO SPACE'); } else {
  let task
  if (entry.ownership === 'user') task = await takeOverTaskSpace(entry.id)
  else task = await taskSpace(entry.id)
  const tabs = await task.tabs()
  console.log('TABS=' + JSON.stringify(tabs.map((t) => ({ label: t.label, title: t.title, url: t.url, active: t.active, openedBy: t.openedBy })), null, 1))
  const active = tabs.find((t) => t.active) || tabs[0]
  if (active && !active.label) {
    const p = await task.adopt(active.page)
    console.log('ADOPTED=' + p.label)
  }
}
console.log('DONE round-12')
