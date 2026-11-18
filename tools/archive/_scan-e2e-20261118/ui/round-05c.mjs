const task = await taskSpace('scan-e2e-20261118')
await task.finish({ keep: [] })
console.log('finished')
