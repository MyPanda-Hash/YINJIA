/**
 * Phase 3 端到端验证(2026-10-14):走**真实后端代码路径**调「转ERP」,验证新建的三条通道。
 *
 * 为什么必须做:前面验的是「字段能不能落库」「面板有没有下发」,而转ERP 是 **Java 代码路径**
 *   (ButtonService.pushToErp → KingdeePushService.pushDocument → 组 body → POST 金蝶 → 回写 MES),
 *   只有真调一次才知道表名/列名/字段口径在运行时是否对得上。
 *
 * 安全边界:
 *   · 会话用 **测试账套**(登录 body 里 factory='YJ_TEST' → DataSourceRouter.TEST),正式库 HSDZ_MES 不动;
 *   · 渲染目标由后端凭证决定 = deploy/push/config.json 的**沙箱**(华实创新),不推客户真实账套。
 *
 * 用法: node tools/archive/_verify-erp-push-e2e-1014.mjs
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const BASE = process.env.YJ_API || 'http://127.0.0.1:8090'
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
if (!login?.data?.token) { console.log('❌ 登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1) }
const token = login.data.token
console.log(`✅ 已用**测试账套**会话登录(${login.data.user?.userName || 'admin'})`)

const CASES = [
  { panel: 'FINISH_IN', label: '产品入库单', doc: 'CPRK-20261014-00005', head: 'bd_finish_in' },
  { panel: 'OTHER_IN', label: '其他入库单', doc: 'QTRK-20261014-00092', head: 'bd_other_in' },
  { panel: 'OTHER_OUT', label: '其他出库单', doc: 'QTCK-20261014-01173', head: 'bd_other_out' },
]
const results = []
for (const c of CASES) {
  const res = await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: c.panel, buttonName: '转ERP', formData: { 单据编号: c.doc }, buttonParam: {} }),
  })).json()
  const ok = res?.code === 0 || res?.success === true || res?.data?.ERP单号
  const msg = res?.data?.message || res?.message || JSON.stringify(res).slice(0, 300)
  results.push({ ...c, ok, msg, erp: res?.data?.ERP单号 || '' })
  console.log(`\n[${c.label}] ${c.doc}`)
  console.log(`  ${ok ? '✅' : '❌'} ${String(msg).slice(0, 400)}`)
}

// 回读 MES:是否已转ERP / ERP单号 是否回写
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST',
  user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
console.log('\n=== 回读 MES(ERP单号是否回写)===')
for (const r of results) {
  const row = (await pool.request().query(`SELECT 单据编号, 是否已转ERP, ERP单号, 转ERP操作人 FROM ${r.head} WHERE 单据编号=N'${r.doc}'`)).recordset[0] || {}
  console.log(`  ${r.label.padEnd(6)} ${r.doc}  是否已转ERP=${row.是否已转ERP || '(空)'}  ERP单号=${row.ERP单号 || '(空)'}  操作人=${row.转ERP操作人 || '(空)'}`)
  r.wrote = row.ERP单号 || ''
}
await pool.close()

const okCnt = results.filter((r) => r.wrote).length
console.log(`\n结论:${okCnt}/${results.length} 条通道推送成功并回写 ERP单号`)
