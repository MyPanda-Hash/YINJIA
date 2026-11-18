// finish-space-43.mjs — 收尾:关闭物料码二维码任务的 ego 空间
const task = await taskSpace(43)
await task.finish({ keep: [] })
console.log('space 43 finished')
