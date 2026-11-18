/**
 * round-12:收尾 —— 关闭本次验证的 ego task space。
 */
const task = await taskSpace('return-doc-20261118')
await task.finish({ keep: [] })
console.log('finished space return-doc-20261118')
