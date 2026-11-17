// round-99b — 关闭第十一轮补验的 ego 任务空间
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114-r11'))
if (!entry) { console.log('SPACE_NOT_FOUND') } else {
  const task = entry.ownership === 'agent' ? await taskSpace(entry.id) : await takeOverTaskSpace(entry.id)
  await task.finish({ keep: [] })
  console.log('FINISHED space=' + entry.id + ' name=' + entry.name)
}
console.log('DONE round-99b')
