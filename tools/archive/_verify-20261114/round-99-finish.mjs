// round-99 — 结束本次验收的 ego 任务空间（默认关闭空间，不保留页签）
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.id === 3 || (s.name || '').includes('verify-20261114'))
if (!entry) { console.log('SPACE_NOT_FOUND'); } else {
  const task = entry.ownership === 'agentDelegatedToUser' || entry.ownership === 'user'
    ? await takeOverTaskSpace(entry.id)
    : await taskSpace(entry.id)
  await task.finish({ keep: [] })
  console.log('FINISHED space=' + entry.id + ' name=' + entry.name)
}
console.log('DONE round-99')
