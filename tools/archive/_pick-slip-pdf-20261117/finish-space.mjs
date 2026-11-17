// finish-space.mjs — 收尾:关闭本次任务的 ego 空间(两张 PDF 已落盘并目检)
const task = await taskSpace(42)
await task.finish({ keep: [] })
console.log('space 42 finished')
