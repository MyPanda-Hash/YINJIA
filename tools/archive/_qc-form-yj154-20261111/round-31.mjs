// round-31:验证「处理意见选项库」整体维护接口(测试账套):删一项 → 复位 → 空清单拒绝 → 非下拉字段拒绝
const { execFileSync } = await import('node:child_process')
const BASE = 'http://127.0.0.1:8090/api'
const tools = 'D:/workspace/yinjia/tools'
const JAVA = 'C:/Users/vigna/.jdks/ms-25.0.4/bin/java'
const q = (sql) => execFileSync(JAVA, ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false', 'yinjia', 'Yinjia@2026', sql],
{ cwd: tools, encoding: 'utf8', maxBuffer: 1e7 }).trim()
const dictOf = () => q("SELECT dict_sql FROM yj_field WHERE panel_code='QC_PROC_INSP' AND label=N'处理方式'").split('\n').filter((l) => l.includes('SELECT v FROM')).pop()

const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const save = (options, label = '处理方式', panelCode = 'QC_PROC_INSP') => fetch(`${BASE}/px/saveFieldOptions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode, label, options }),
}).then((r) => r.json())

const before = dictOf()
console.log('BEFORE=' + JSON.stringify(before))
const r1 = await save(['允收', '合格', '不合格'])                 // 删掉「报废」
const afterDel = dictOf()
console.log('DELETE_ONE=' + JSON.stringify({ resp: r1, has报废: afterDel.includes('报废'), after: afterDel }))
const r2 = await save(['允收', '合格', '不合格', '报废'])           // 复位
const restored = dictOf()
console.log('RESTORE=' + JSON.stringify({ resp: r2, restored, sameAsBefore: restored.replace(/\s+/g, '') === before.replace(/\s+/g, '') }))
const r3 = await save([])
const r4 = await save(['x'.repeat(31)])
const r5 = await save(['a'], '处理方式', 'NO_SUCH_PANEL')
const r6 = await save(['a'], '检验员')                            // 非下拉框字段
console.log('REJECTS=' + JSON.stringify({ empty: r3?.data, tooLong: r4?.data, badPanel: r5?.data, nonDropdown: r6?.data }))
