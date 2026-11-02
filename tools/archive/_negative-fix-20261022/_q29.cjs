/** 确认 sp_getapplock 那条语句被 expand 误伤 */
const fs = require('node:fs')
const src = fs.readFileSync('D:/YINJIA-main/tools/balance-negative-stock.js', 'utf8')
const start = src.indexOf('const expand = (sql, params = {}) => {')
const end = src.indexOf('return { sql: body, used, params }', start)
const expand = eval('(function(){' + src.slice(start, end) + 'return { sql: body, used, params } }}' )()

const lock = "DECLARE @r int; EXEC @r = sp_getapplock @Resource='balance-negative-stock', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0; SELECT @r AS v"
const before = lock
const after = expand(lock, {}).sql
console.log('原句 :', before)
console.log('展开 :', after)
console.log('是否被改坏:', before !== after)
