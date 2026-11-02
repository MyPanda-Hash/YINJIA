/** 确认 sp_getapplock 那条语句被 expand 误伤(独立实现,避免 eval 坑) */
const PATTERN = /:([A-Za-z_][A-Za-z0-9_]*)/g
function expand(sql, params) {
  return String(sql).replace(PATTERN, (m, name) => (name in params ? '<<' + name + '>>' : m))
}
const lock = "DECLARE @r int; EXEC @r = sp_getapplock @Resource='balance-negative-stock', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0; SELECT @r AS v"
const after = expand(lock, {})
console.log('原句:', lock)
console.log('展开:', after)
console.log('被改坏:', lock !== after)

// 对照:普通参数语句正常
const ok = "SELECT * FROM kucun WHERE yl < -:m AND wzdm = :w"
console.log('普通展开:', expand(ok, { m: 0.0001, w: 'X' }))
