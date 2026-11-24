const task = await taskSpace('qc detail index verify after rebase')
await task.finish({ keep: [] })
console.log('space finished')
