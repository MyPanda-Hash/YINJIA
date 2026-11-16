// round-29:验证「处理意见」选项库自动增项接口(测试账套);验完还原 dict_sql
const { execFileSync } = await import('node:child_process')
const BASE = 'http://127.0.0.1:8090/api'
const tools = 'D:/workspace/yinjia/tools'
const JAVA = 'C:/Users/vigna/.jdk s/ms-25.0.4/bin/java'.replace('.jdk s', '.jdks')
const q = (sql) => execFileSync(JAVA, ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false', 'yinjia', 'Yinjia@2026', sql],
{ cwd: tools, encoding: 'utf8', maxBuffer: 1e7 }).trim()

const before = q("SELECT dict_sql FROM yj_field WHERE panel_code='QC_PROC_INSP' AND label=N'处理方式'")
console.log('BEFORE=' + JSON.stringify(before.split('\n').slice(-2)))
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
const token = login?.data?.token
const call = (option) => fetch(`${BASE}/px/appendFieldOption`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode: 'QC_PROC_INSP', label: '处理方式', option }),
}).then((r) => r.json())
const r1 = await call('测试自动增项')
const after = q("SELECT dict_sql FROM yj_field WHERE panel_code='QC_PROC_INSP' AND label=N'处理方式'")
console.log('ADD=' + JSON.stringify({ resp: r1, afterHasVal: after.includes('测试自动增项'), after: after.split('\n').slice(-2) }))
const r2 = await call('测试自动增项')
console.log('DUP=' + JSON.stringify(r2))
// 还原原始 dict_sql(测试账套)
const origLine = before.split('\n').filter((l) => l.includes('SELECT v FROM')).pop()
const esc = origLine.replace(/'/g, "''")
q(`UPDATE yj_field SET dict_sql = N'${esc}' WHERE panel_code='QC_PROC_INSP' AND label=N'处理方式'`)
const restored = q("SELECT dict_sql FROM yj_field WHERE panel_code='QC_PROC_INSP' AND label=N'处理方式'")
console.log('RESTORED=' + restored.includes('测试自动增项') + ' ' + JSON.stringify(restored.split('\n').slice(-2)))
