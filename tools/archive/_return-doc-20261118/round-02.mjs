/**
 * round-02:收尾 —— 关闭本次两个只读核对用的 task space。
 */
for (const name of ['return-scan-8090-20261118', 'return-scan-5173-20261118']) {
  const task = await taskSpace(name)
  await task.finish({ keep: [] })
  console.log('finished', name)
}
