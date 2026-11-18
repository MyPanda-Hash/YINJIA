// round-12.mjs — 取证结束:关闭本任务的 ego 任务空间(截图已落盘 tools/archive/_row-click-select-20261117/)
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : null
if (task) {
  await task.finish({ keep: [] })
  console.log('空间已关闭')
} else {
  console.log('空间不存在(已关闭)')
}
