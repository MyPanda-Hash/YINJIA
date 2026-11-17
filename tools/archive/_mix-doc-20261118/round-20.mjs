/**
 * round-20:收尾 —— 关闭本次验证的 ego task space(保留结果页无意义,全部关闭)。
 */
const task = await taskSpace('mix-doc-20261118')
await task.finish({ keep: [] })
console.log('finished space mix-doc-20261118')
