/**
 * _verify-archive-save-guard.mjs —— 档案面板「带筛选保存」误删护栏 端到端验收探针
 * =====================================================================================
 * 事故(2026-10-03 19:07:10,用户报「商品的数据怎么只剩一行了」):「商品」(INV / bs_inv)面板**带筛选保存**时,
 * 前端把"筛出来的子集"当整档提交,后端 saveArchive 按「缺席行=已删除」把未加载的 3873/3874 行软删
 * (yj_archive_change_log id=8: removedRows=3873)。修复:客户端须声明 `buttonParam.档案全量=true`
 * 后端才做缺席行软删;未声明则只 upsert 提交行 + 回传 `未全量跳过软删: N`。
 *
 * 断言:
 *   ①【回归网】正式库 INV:提交**一行子集**且不声明整档 → 响应回传 `未全量跳过软删` = 存活行数-1,
 *      且**库里存活行数一行不少**(旧代码在此会把 3873 行标 asp_cancel='Y');
 *   ②【留痕诚实】该次保存的 yj_archive_change_log 记 `skippedRemovedRows`、`removedRows=0`
 *      (不能让留痕说"删了 N 行"而库里还在);
 *   ③【正路未堵】测试账套里声明 `档案全量=true` + 提交整档 → 正常保存:新增行入库;
 *      再来一次不带该行的整档保存 → 该行按「缺席=删除」软删(整档语义保持);
 *   ④【写入保真】①那次保存指向的那一行,除 asp_user2/asp_time2 外**所有列值不变**(子集保存只更新已加载行)。
 *
 * 账套纪律(ADR-0003):①只读+单行回写走**正式库**(就是事故现场,必须覆盖);
 *   ③的造数走**测试账套 factory=YJ_TEST**(用完即删,正式库只录真实业务)。
 * 用法:node tools/archive/_verify-archive-save-guard.mjs
 * 依赖:mssql 取自 D:\jdy-sync(与其他探针同款);HTTP 用 Node 内置 fetch。
 */
import { createRequire } from 'node:module'
const mssql = createRequire('D:/jdy-sync/package.json')('mssql')

const API = process.env.YJ_API || 'http://localhost:8090/api'
const FACTORY_PROD = 'YJ'            // 正式账套(登录工厂码;不传=默认账套)
const FACTORY_TEST = 'YJ_TEST'       // 测试账套
const SQLBASE = { server: '127.0.0.1', port: 1433, user: 'yinjia',
  // 与 tools/DbSync.java 同款:密码可用环境变量覆盖(默认值即本机开发库口令)
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true } }

const pools = {}
async function pool(db) {
  if (!pools[db]) pools[db] = await new mssql.ConnectionPool({ ...SQLBASE, database: db }).connect()
  return pools[db]
}
async function one(db, sql) {
  const r = await new mssql.Request(await pool(db)).query(sql)
  const row = r.recordset[0] || {}
  return Object.values(row)[0]
}

let fail = 0
const ok = (cond, msg, extra = '') => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + msg + (extra ? '  ' + extra : ''))
  if (!cond) fail++
}

/** 登录(账套绑令牌,ADR-0003) */
async function login(factory) {
  const body = { userName: 'admin', password: '123456' }
  if (factory) body.factory = factory
  const j = await (await fetch(API + '/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) })).json()
  if (j.code !== 200) throw new Error('登录失败: ' + j.message)
  return j.data.token
}
const mk = (token) => ({
  get: async (u) => (await (await fetch(API + u, { headers: { Authorization: 'Bearer ' + token } })).json()),
  post: async (u, b) => (await (await fetch(API + u, { method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(b) })).json()),
})

/** 整档读取:返回 { key, rows, total }(key = detail 页签键,动态发现) */
async function arch(api, panelCode, condition = {}) {
  const j = await api.post('/px/queryFormDataList', { panelCode, condition, pageNo: 1, pageSize: 20 })
  if (j.code !== 200) throw new Error(`${panelCode} 查询失败: ` + j.message)
  const doc = j.data.list[0] || {}
  const key = Object.keys(doc.detail || {})[0]
  return { key, rows: (doc.detail || {})[key] || [], total: j.data.totalSize }
}

// ═══════════════════════════════════════════════════════════════
console.log('=== ⓪ 登录(正式账套) ===')
const prodToken = await login(FACTORY_PROD)
const prod = mk(prodToken)
console.log('  [OK] admin@' + FACTORY_PROD)

console.log('=== ① 正式库 INV:子集提交(不声明整档)不软删任何行 ===')
const liveBefore = await one('HSDZ_MES', "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'")
const inv = await arch(prod, 'INV')
console.log(`  基线:存活 ${liveBefore} 行 / 整档返回 ${inv.rows.length} 行 / totalSize ${inv.total}`)
ok(liveBefore > 100, '正式库商品存活行数 > 100(事故后已恢复)', String(liveBefore))

const victim = inv.rows[inv.rows.length - 1]                    // 取末行(最不易被人正在编辑)
const victimId = victim.id ?? victim.__id
const snapshotSql = `SELECT * FROM dbo.bs_inv WHERE id = ${Number(victimId)}`
const snapBefore = (await new mssql.Request(await pool('HSDZ_MES')).query(snapshotSql)).recordset[0]

const saveRes = await prod.post('/px/callButton', {
  panelCode: 'INV', buttonName: '保存',
  formData: { detail: { [inv.key]: [victim] } },                 // ← 子集:只有 1 行
  buttonParam: {},                                               // ← 刻意不声明「档案全量」
})
ok(saveRes.code === 200, '保存调用成功', saveRes.message || '')
const skipped = Number((saveRes.data || {})['未全量跳过软删'] || 0)
ok(skipped === liveBefore - 1, `回传「未全量跳过软删」= 存活行数-1(=${liveBefore - 1})`, String(skipped))

const liveAfter = await one('HSDZ_MES', "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(liveAfter === liveBefore, '保存后存活行数一行不少(旧代码此处会掉到 1 行)',
  `${liveBefore} → ${liveAfter}`)

console.log('=== ② 留痕诚实:记 skippedRemovedRows 而非 removedRows ===')
const meta = await one('HSDZ_MES',
  "SELECT TOP 1 change_meta FROM dbo.yj_archive_change_log WHERE panel_code='INV' ORDER BY id DESC")
const metaObj = JSON.parse(meta)
ok(Number(metaObj.removedRows) === 0, '最新 INV 留痕 removedRows = 0', String(metaObj.removedRows))
ok(Number(metaObj.skippedRemovedRows || 0) === liveBefore - 1,
  `最新 INV 留痕 skippedRemovedRows = ${liveBefore - 1}`, String(metaObj.skippedRemovedRows))

console.log('=== ④ 写入保真:那一行除留痕列外全部列值不变 ===')
const snapAfter = (await new mssql.Request(await pool('HSDZ_MES')).query(snapshotSql)).recordset[0]
const IGNORE = new Set(['asp_user2', 'asp_time2'])
const diff = Object.keys(snapBefore).filter((k) => !IGNORE.has(k) && String(snapBefore[k]) !== String(snapAfter[k]))
ok(diff.length === 0, '行内业务列无差异(asp_user2/asp_time2 除外)', diff.slice(0, 8).join(','))

console.log('=== ③ 正路未堵:测试账套声明「档案全量」→ 整档保存语义保持 ===')
const testToken = await login(FACTORY_TEST)
const test = mk(testToken)
const uom = await arch(test, 'UOM')
console.log(`  测试账套 UOM:整档 ${uom.rows.length} 行(detail 键 ${uom.key})`)
ok(uom.rows.length > 0, 'UOM 整档可读')

// 3a) 声明整档 + 追加一行 → 应入库
const probeCode = 'ZZ-VERIFY-GUARD'
const withNew = [...uom.rows, { 计量单位编码: probeCode, 计量单位名称: '护栏验证行' }]
const r1 = await test.post('/px/callButton', {
  panelCode: 'UOM', buttonName: '保存',
  formData: { detail: { [uom.key]: withNew } }, buttonParam: { 档案全量: true },
})
ok(r1.code === 200, '整档保存(含新增行)成功', r1.message || '')
ok(!(r1.data || {})['未全量跳过软删'], '声明整档时不回传「未全量跳过软删」')
let cnt = await one('HSDZ_MES_TEST', "SELECT COUNT(*) FROM dbo.bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(cnt === uom.rows.length + 1, `新增行入库(存活 ${uom.rows.length} → ${cnt})`, String(cnt))

// 3b) 再声明整档、不带该行 → 应按「缺席=删除」软删
const uom2 = await arch(test, 'UOM')
const dropNew = uom2.rows.filter((r) => String(r['计量单位编码'] || '') !== probeCode)
const r2 = await test.post('/px/callButton', {
  panelCode: 'UOM', buttonName: '保存',
  formData: { detail: { [uom2.key]: dropNew } }, buttonParam: { 档案全量: true },
})
ok(r2.code === 200, '整档保存(移除该行)成功', r2.message || '')
cnt = await one('HSDZ_MES_TEST', "SELECT COUNT(*) FROM dbo.bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(cnt === uom.rows.length, `整档缺席行已软删(回到 ${uom.rows.length} 行)`, String(cnt))
const residual = await one('HSDZ_MES_TEST',
  `SELECT COUNT(*) FROM dbo.bs_uom WHERE 计量单位编码 = N'${probeCode}' AND ISNULL(asp_cancel,'N')<>'Y'`)
ok(Number(residual) === 0, '测试行无存活残留')

// ═══════════════════════════════════════════════════════════════
await Promise.all(Object.values(pools).map((p) => p.close()))
console.log(fail === 0 ? '\n[ALL PASS] 档案保存护栏验收通过' : `\n[FAILED] ${fail} 项未通过`)
process.exit(fail === 0 ? 0 : 1)
