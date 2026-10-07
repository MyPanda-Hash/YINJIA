/**
 * _verify-archive-save-guard.mjs —— 档案面板「改动行提交」+ 误删护栏 + 商品非必填 的端到端验收
 * =========================================================================================
 * 背景(2026-10-03):「商品」(INV / bs_inv)面板**带筛选保存**时,前端把筛出来的子集当整档提交,
 * 后端按「整表 upsert,缺席行=已删除」把未加载的 3873/3874 行软删(yj_archive_change_log id=8)。
 * 当日定案两件事:
 *   ① 保存改「**只提交改动行**」(`buttonParam.只提交改动行=true`,删除走显式 `作废行id`),
 *      后端绝不按"缺席"推断删除;未声明任何口径的老客户端 → 只 upsert、回传 `未全量跳过软删: N`;
 *   ② 商品面板**不再有必填字段**(原本 所属类别/存货编码/存货名称 required=1,逐行全量校验会卡死保存)。
 *
 * 断言:
 *   ①【回归网·正式库 INV】子集提交且不声明口径 → 回传 `未全量跳过软删` = 存活行数-1,且**一行不少**;
 *   ②【留痕诚实】该次保存的 yj_archive_change_log 记 skippedRemovedRows、removedRows=0;
 *   ③【写入保真】①提交的那一行,除 asp_user2/asp_time2 外所有列值不变;
 *   ④【商品非必填】yj_field 里 INV 必填 = 0(两个账套),且面板配置下发的字段 isRequired 全 false;
 *   ⑤【改动行提交·测试账套 INV】改一行「备注」→ 只提交该行 → 库里值确实变了、**总行数一行不变**,
 *      留痕 changedRows=1/removedRows=0;再改回原值 → 恢复;
 *   ⑥【删除走显式 id·测试账套 UOM】patch 新增一行(无 id)入库 → 再用 `作废行id` 作废它 → 回到基线;
 *   ⑦【收尾】测试账套无存活残留,正式库商品行数保持基线。
 *
 * 账套纪律(ADR-0003):①③ 只读+单行回写走**正式库**(事故现场必须覆盖);⑤⑥ 的造数走**测试账套**。
 * 用法:node tools/archive/_verify-archive-save-guard.mjs   (env: YJ_API / YINJIA_SQL_PASS)
 * 依赖:mssql 取自 D:\jdy-sync(与其他探针同款);HTTP 用 Node 内置 fetch。
 */
import { createRequire } from 'node:module'
const mssql = createRequire('D:/jdy-sync/package.json')('mssql')

const API = process.env.YJ_API || 'http://localhost:8090/api'
const FACTORY_PROD = 'YJ'            // 正式账套
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
  return Object.values(r.recordset[0] || {})[0]
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

/** 整档读取:{ key, rows, total }(key = detail 页签键,动态发现) */
async function arch(api, panelCode, condition = {}) {
  const j = await api.post('/px/queryFormDataList', { panelCode, condition, pageNo: 1, pageSize: 20 })
  if (j.code !== 200) throw new Error(`${panelCode} 查询失败: ` + j.message)
  const doc = j.data.list[0] || {}
  const key = Object.keys(doc.detail || {})[0]
  return { key, rows: (doc.detail || {})[key] || [], total: j.data.totalSize }
}
/** 改动行提交:payload 只带要提交的行(＋可选 作废行id) */
const patchSave = (api, panelCode, key, items, extra = {}) => api.post('/px/callButton', {
  panelCode, buttonName: '保存',
  formData: { detail: { [key]: items }, ...extra },
  buttonParam: { 只提交改动行: true },
})

// ═══════════════════════════════════════════════════════════════
console.log('=== ⓪ 登录 ===')
const prod = mk(await login(FACTORY_PROD))
const test = mk(await login(FACTORY_TEST))
console.log('  [OK] admin@' + FACTORY_PROD + ' / admin@' + FACTORY_TEST)

console.log('=== ① 正式库 INV:子集提交(不声明任何口径)不软删任何行 ===')
const liveBefore = await one('HSDZ_MES', "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'")
const inv = await arch(prod, 'INV')
console.log(`  基线:存活 ${liveBefore} 行 / 整档返回 ${inv.rows.length} 行 / totalSize ${inv.total}`)
ok(liveBefore > 100, '正式库商品存活行数 > 100(事故后已恢复)', String(liveBefore))

const victim = inv.rows[inv.rows.length - 1]
const snapSql = `SELECT * FROM dbo.bs_inv WHERE id = ${Number(victim.id ?? victim.__id)}`
const snapBefore = (await new mssql.Request(await pool('HSDZ_MES')).query(snapSql)).recordset[0]
const legacySave = await prod.post('/px/callButton', {
  panelCode: 'INV', buttonName: '保存',
  formData: { detail: { [inv.key]: [victim] } }, buttonParam: {},
})
ok(legacySave.code === 200, '保存调用成功', legacySave.message || '')
ok(Number((legacySave.data || {})['未全量跳过软删'] || 0) === liveBefore - 1,
  `回传「未全量跳过软删」= 存活行数-1(=${liveBefore - 1})`, String((legacySave.data || {})['未全量跳过软删']))
const liveAfter = await one('HSDZ_MES', "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(liveAfter === liveBefore, '保存后存活行数一行不少(旧代码此处会掉到 1 行)', `${liveBefore} → ${liveAfter}`)

console.log('=== ② 留痕诚实:记 skippedRemovedRows 而非 removedRows ===')
const meta = JSON.parse(await one('HSDZ_MES',
  "SELECT TOP 1 change_meta FROM dbo.yj_archive_change_log WHERE panel_code='INV' ORDER BY id DESC"))
ok(Number(meta.removedRows) === 0, '最新 INV 留痕 removedRows = 0', String(meta.removedRows))
ok(Number(meta.skippedRemovedRows || 0) === liveBefore - 1,
  `最新 INV 留痕 skippedRemovedRows = ${liveBefore - 1}`, String(meta.skippedRemovedRows))

console.log('=== ③ 写入保真:那一行除留痕列外全部列值不变 ===')
const snapAfter = (await new mssql.Request(await pool('HSDZ_MES')).query(snapSql)).recordset[0]
const IGNORE = new Set(['asp_user2', 'asp_time2'])
const diff = Object.keys(snapBefore).filter((k) => !IGNORE.has(k) && String(snapBefore[k]) !== String(snapAfter[k]))
ok(diff.length === 0, '行内业务列无差异(asp_user2/asp_time2 除外)', diff.slice(0, 8).join(','))

console.log('=== ④ 商品面板不再有必填字段 ===')
for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  const req = await one(db, "SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code='INV' AND ISNULL(required,0)<>0")
  ok(Number(req) === 0, `${db}: yj_field INV 必填字段数 = 0`, String(req))
}
const invCfg = await prod.get('/px/getPanelConfig?panelCode=INV')
const invFields = invCfg.data?.dataSchema?.fields || []
ok(invFields.length > 0, '面板配置下发字段正常', String(invFields.length))
ok(invFields.every((f) => !f.isRequired), '下发字段 isRequired 全为 false',
  invFields.filter((f) => f.isRequired).map((f) => f.dataName).slice(0, 5).join(','))

console.log('=== ⑤ 改动行提交:测试账套 INV 改一行备注 → 只写该行,总行数不变 ===')
const tInv = await arch(test, 'INV')
const tLive0 = await one('HSDZ_MES_TEST', "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'")
// 挑一个「原值非空」的(行,字段)组合:后端 labelsToCols 把空串当"未填"跳过(既有口径,
// 见下注),所以"改回空值"这条路在保存链上本来就写不进去 —— 要验证"改回原值",原值必须非空。
// ⚠ 附带发现(既有行为,非本次改动):文本字段清空后保存**不会落库**(空串被跳过),清空需求要另立任务。
const CAND_FIELDS = ['备注', '规格型号', '品牌', '产地']
let target = null, field = ''
for (const r of tInv.rows) {
  const f = CAND_FIELDS.find((x) => String(r[x] ?? '').trim())
  if (f && String(r['存货编码'] || '').trim()) { target = r; field = f; break }
}
ok(!!target, `找到可验证的非空字段(${field || '无'})`,
  target ? `${target['存货编码']} ${field}=${JSON.stringify(String(target[field]))}` : '')
if (!target) { console.log('  (跳过 ⑤)'); } else {
  const targetId = Number(target.id ?? target.__id)
  const oldVal = String(target[field])
  const stamp = '护栏验证-' + new Date().toISOString().slice(11, 19)
  const edited = { ...target, [field]: stamp }
  const r5 = await patchSave(test, 'INV', tInv.key, [edited])
  ok(r5.code === 200, '改动行提交成功', r5.message || '')
  let inDb = await one('HSDZ_MES_TEST', `SELECT [${field}] FROM dbo.bs_inv WHERE id = ${targetId}`)
  ok(String(inDb) === stamp, `库里该行 ${field} = 新值(patch 真写进去了)`, String(inDb))
  const tLive1 = await one('HSDZ_MES_TEST', "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'")
  ok(tLive1 === tLive0, '总存活行数一行不变(只提交改动行 ≠ 整档语义)', `${tLive0} → ${tLive1}`)
  const meta5 = JSON.parse(await one('HSDZ_MES_TEST',
    "SELECT TOP 1 change_meta FROM dbo.yj_archive_change_log WHERE panel_code='INV' ORDER BY id DESC"))
  ok(Number(meta5.changedRows) === 1 && Number(meta5.removedRows) === 0,
    '留痕 changedRows=1 / removedRows=0', JSON.stringify(meta5))
  const r5b = await patchSave(test, 'INV', tInv.key, [{ ...edited, [field]: oldVal }])
  ok(r5b.code === 200, '改回原值成功', r5b.message || '')
  inDb = await one('HSDZ_MES_TEST', `SELECT [${field}] FROM dbo.bs_inv WHERE id = ${targetId}`)
  ok(String(inDb || '') === oldVal, `${field} 已恢复原值`, JSON.stringify({ old: oldVal, now: inDb }))
}

console.log('=== ⑥ 删除走显式作废行id(测试账套 UOM) ===')
const uom = await arch(test, 'UOM')
const uomBase = await one('HSDZ_MES_TEST', "SELECT COUNT(*) FROM dbo.bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(uomBase === uom.rows.length, 'UOM 存活行数 = 整档行数', `${uomBase} / ${uom.rows.length}`)
const probeCode = 'ZZ-VERIFY-GUARD'
const r6 = await patchSave(test, 'UOM', uom.key, [
  ...uom.rows.filter((r) => String(r['计量单位编码'] || '') === probeCode),
  { 计量单位编码: probeCode, 计量单位名称: '护栏验证行' },
])
ok(r6.code === 200, 'patch 新增一行成功', r6.message || '')
let cnt = await one('HSDZ_MES_TEST', "SELECT COUNT(*) FROM dbo.bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(cnt === uomBase + 1, `新增行入库(${uomBase} → ${cnt})`, String(cnt))
const newId = await one('HSDZ_MES_TEST',
  `SELECT id FROM dbo.bs_uom WHERE 计量单位编码 = N'${probeCode}' AND ISNULL(asp_cancel,'N')<>'Y'`)
const r7 = await patchSave(test, 'UOM', uom.key, [], { 作废行id: [newId] })
ok(r7.code === 200, '显式作废该行成功', r7.message || '')
cnt = await one('HSDZ_MES_TEST', "SELECT COUNT(*) FROM dbo.bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(cnt === uomBase, `回到基线(${uomBase})`, String(cnt))

console.log('=== ⑦ 收尾 ===')
const residual = await one('HSDZ_MES_TEST',
  `SELECT COUNT(*) FROM dbo.bs_uom WHERE 计量单位编码 = N'${probeCode}' AND ISNULL(asp_cancel,'N')<>'Y'`)
ok(Number(residual) === 0, '测试行无存活残留')
const invNow = await one('HSDZ_MES', "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'")
ok(invNow === liveBefore, '正式库商品存活行数保持基线', String(invNow))

await Promise.all(Object.values(pools).map((p) => p.close()))
console.log(fail === 0 ? '\n[ALL PASS] 档案保存/商品非必填 验收通过' : `\n[FAILED] ${fail} 项未通过`)
process.exit(fail === 0 ? 0 : 1)
