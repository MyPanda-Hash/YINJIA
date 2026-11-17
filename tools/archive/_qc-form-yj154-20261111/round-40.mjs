// round-40:①确认弹窗可关闭(取消/✕) ②API 验证选项长度上限 200(测试账套,验完还原)
const { execFileSync } = await import('node:child_process')
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')
const dlgOpen = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('处理意见选项维护'))
  if (!d) return false
  const r = d.getBoundingClientRect()
  return getComputedStyle(d).display !== 'none' && r.width > 0 && r.height > 0
})

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2200)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(2600)
await page.evaluate(() => document.querySelector('.qr-label .qr-opt-mgr')?.click())
await page.waitForTimeout(1500)
console.log('OPEN=' + (await dlgOpen()))
await page.evaluate(() => { const b = [...document.querySelectorAll('.el-dialog__footer button')].find((x) => (x.textContent || '').includes('取消')); b?.click() })
await page.waitForTimeout(1800)
console.log('AFTER_CANCEL=' + (await dlgOpen()))
await page.evaluate(() => document.querySelector('.qr-label .qr-opt-mgr')?.click())
await page.waitForTimeout(1200)
await page.evaluate(() => { const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('处理意见选项维护')); d?.querySelector('.el-dialog__headerbtn')?.click() })
await page.waitForTimeout(1800)
console.log('AFTER_X=' + (await dlgOpen()))

// ---- API:长度上限 200 ----
const BASE = 'http://127.0.0.1:8090/api'
const tools = 'D:/workspace/yinjia/tools'
const JAVA = 'C:/Users/vigna/.jdks/ms-25.0.4/bin/java'
const q = (sql) => execFileSync(JAVA, ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false', 'yinjia', 'Yinjia@2026', sql],
{ cwd: tools, encoding: 'utf8', maxBuffer: 1e7 }).trim()
const dictOf = () => q("SELECT dict_sql FROM yj_field WHERE panel_code='QC_PROC_INSP' AND label=N'处理方式'").split('\n').filter((l) => l.includes('SELECT v FROM')).pop()
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const save = (options) => fetch(`${BASE}/px/saveFieldOptions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ panelCode: 'QC_PROC_INSP', label: '处理方式', options }) }).then((r) => r.json())
const before = dictOf()
const long60 = '本批次外观与尺寸符合控制计划要求，功能性测试结果合格，同意放行并在下道工序继续流转使用（六十字符示例）'
const r60 = await save([...['允收', '合格', '不合格', '报废'], long60])
const afterAdd = dictOf()
const r201 = await save([...['允收', '合格', '不合格', '报废'], 'x'.repeat(201)])
// 还原
const base = before.split('\n').filter((l) => l.includes('SELECT v FROM')).pop()
const lit = [...base.matchAll(/N'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"))
const rRestore = await save(lit)
const restored = dictOf()
console.log('API=' + JSON.stringify({
  len60: long60.length,
  add60: r60?.data,
  dictHas60: afterAdd.includes(long60.slice(0, 12)),
  reject201: r201?.data,
  restore: rRestore?.data,
  restoredHas60: restored.includes(long60.slice(0, 12)),
}))
