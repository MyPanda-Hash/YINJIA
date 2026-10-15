/*
 * _verify-first-insp-link.mjs — **专门验证「首件检验单 ↔ 成型工艺清单」这条关联链路**。
 *
 * 用户口径(2026-10-15 第四轮):「同时检查当前关联是否成功实现关联到成型工艺清单的检验项目」。
 *
 * 探什么:
 *   ① 取数接口从《成型工艺清单》RD_MOLD_PROC 取值:外径/公差/内径/公差/长度/重量/
 *      跌落(高度/次数/要求)/挤压强度(间距/速度/强度)/压降(标准/是否测试);
 *   ② 这些值**一条不差**地落到纸面的「标准」行上(按检验列对位,不是按顺序);
 *   ③ 有/无工艺清单两条路都验:有 ⇒ 每列标准都带值;无 ⇒ 列还在、标准留白(不编造);
 *   ④ 工艺清单改版后重取:新值覆盖旧标准(不是追加一列重复列)。
 *
 * ⚠ 全在**测试账套** HSDZ_MES_TEST 上跑;fixture 自取自清(不动正式账,不动库里原有单据)。
 *    Fixture = 一张临时工艺清单,产品编码用 E2E 同款工单的产品 ⇒ 顺带验真实产品能否关联上。
 */
import { createRequire } from 'node:module'
const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const DB = 'HSDZ_MES_TEST'
const FACTORY = 'YJ_TEST'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const API = BASE + '/api'

let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }
const p = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect()
const q = async (s) => (await new mssql.Request(p).query(s)).recordset
const lg = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }) }).then((r) => r.json())
const TOKEN = lg.data?.token
if (!TOKEN) { console.error('登录失败', lg.message); process.exit(1) }
const get = async (u) => { const r = await fetch(API + u, { headers: { Authorization: 'Bearer ' + TOKEN } }); return { status: r.status, json: await r.json() } }

// 取一个真实工单产品当被测产品(证明"真实产品也能关联",不只是演示产品)
const wo = (await q(`SELECT TOP 1 pl_no AS 工单号, pl_xc AS 行, dm AS 产品编码, ISNULL(mc,'') AS 产品名称
  FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>'' AND ISNULL(ja,'N') NOT IN ('Y','T')
  ORDER BY id DESC`))[0]
const PROD = wo.产品编码
console.log(`== 首件检验 ↔ 成型工艺清单 关联验收(账套 ${DB},产品 ${PROD})==`)

const FIXTURE = `MP-LINK-${Date.now().toString().slice(-6)}`
const fixtureFields = {
  单据编号: FIXTURE,
  产品编号: PROD, 产品名称: wo.产品名称,
  外径mm: '34.5', 外径公差: '±0.5',
  内径mm: '12.5', 内径公差: '±0.5',
  长度要求: '108.3~109.7mm', 重量要求: '≥22g',
  跌落高度cm: '50', 跌落次数: '3', 跌落要求: '炭棒无断裂',
  测试间距mm: '40', 压头下降速度: '5mm/min', 强度要求kgf: '30',
  压降标准kpa: '20', 压降是否测试: '√',
}
const N = (s) => '[' + s + ']'

try {
  // 先确认:装 fixture 之前这个产品**没有**工艺清单(否则说明库里本来就有关联,另当别论)
  const before = await get('/qc/firstInsp/fromMoldProc?productCode=' + encodeURIComponent(PROD))
  const beforeCols = before.json?.data?.columns || []
  const hadSheet = /^\d{4,}/.test(String(before.json?.data?.moldProcNo || ''))
  console.log(`  取数前: 工艺清单=${before.json?.data?.moldProcNo || '(无)'} 列=${beforeCols.length}`)

  // ── 写 fixture:一张专门给该产品的临时工艺清单 ────────────────────────────
  const cols = Object.keys(fixtureFields)
  const names = cols.map((c) => N(c)).join(',')
  const ph = Object.keys(fixtureFields).map((_, i) => '@p' + i).join(',')
  const req = new mssql.Request(p)
  Object.values(fixtureFields).forEach((v, i) => req.input('p' + i, v))
  await req.query(`INSERT INTO dbo.rd_mold_proc_head (${names}) VALUES (${ph})`)
  const no = (await q(`SELECT 单据编号 FROM dbo.rd_mold_proc_head WHERE 产品编号=N'${PROD}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`))[0]?.单据编号
  console.log(`  fixture 已建: ${no}(产品 ${PROD})`)

  // ── ① 取到工艺清单 ───────────────────────────────────────────────────────
  const r = await get('/qc/firstInsp/fromMoldProc?productCode=' + encodeURIComponent(PROD))
  const d = r.json?.data || {}
  ok('① 从成型工艺清单取到该产品的单据', d.moldProcNo === no, `${d.moldProcNo} 期望 ${no}`)
  const cols2 = d.columns || []
  ok('① 返回 10 个测试项目列', cols2.length === 10, String(cols2.length))
  ok('① 表头带上工艺清单单号', d.moldProcNo === no, d.moldProcNo)

  // ── ② 逐列核对:工艺清单的值 === 纸面「标准」 ───────────────────────────────
  const std = {}
  for (const c of cols2) std[c.key] = c.standard
  const cases = [
    ['outer', '34.5', '外径'],
    ['inner', '12.5', '内径'],
    ['length', '108.3', '长度要求'],
    ['weight', '22', '重量要求'],
    ['drop', '50', '跌落高度'],
    ['compress', '30', '强度要求'],
    ['pressure', '20', '压降标准'],
  ]
  for (const [key, expect, what] of cases) {
    ok(`② ${what}:标准行带出工艺清单的值(${expect})`, (std[key] || '').includes(expect), JSON.stringify(std[key]))
  }
  ok('② 公差/次数/是否测试 也带进来了', (std.outer || '').includes('±0.5') && (std.drop || '').includes('3次') && (std.pressure || '').includes('√'),
    JSON.stringify({ outer: std.outer, drop: std.drop, pressure: std.pressure }))

  // ── ③ 取数落成长表行:每列 1 标准 + 8 样品 ────────────────────────────────
  const rows = d.rows || []
  const stdRows = rows.filter((x) => x['行类型'] === '标准')
  const sampleRows = rows.filter((x) => x['行类型'] === '样品')
  ok('③ 长表行 = 每列 1 标准 + 8 样品', stdRows.length === 10 && sampleRows.length === 80,
    `std=${stdRows.length} sample=${sampleRows.length}`)
  ok('③ 标准值落在「标准」行、样品行为空', stdRows.every((x) => x['标准'] !== undefined)
    && sampleRows.every((x) => !String(x['标准'] ?? '').trim()),
    '标准行有值/样品行空')

  // ── ④ 工艺清单改版后重取:覆盖旧标准,不重复加列 ───────────────────────────
  await new mssql.Request(p).query(`UPDATE dbo.rd_mold_proc_head SET 外径mm=N'36.0', 压降标准kpa=N'25'
     WHERE 单据编号=N'${no}'`)
  const r2 = await get('/qc/firstInsp/fromMoldProc?productCode=' + encodeURIComponent(PROD))
  const cols3 = r2.json?.data?.columns || []
  const std2 = {}
  for (const c of cols3) std2[c.key] = c.standard
  ok('④ 改版后外径标准变成新值', (std2.outer || '').includes('36.0'), JSON.stringify(std2.outer))
  ok('④ 改版后压降标准变成新值', (std2.pressure || '').includes('25'), JSON.stringify(std2.pressure))
  ok('④ 改版后列数不变(不重复加列)', cols3.length === cols2.length, `${cols2.length} → ${cols3.length}`)

  // ── ⑤ 关联不到的产品:列仍在、标准留白(不编造) ────────────────────────────
  const none = await get('/qc/firstInsp/fromMoldProc?productCode=NO-SUCH-PRODUCT-XYZ')
  const nd = none.json?.data || {}
  ok('⑤ 无工艺清单:moldProcNo 为空', !nd.moldProcNo, String(nd.moldProcNo))
  ok('⑤ 无工艺清单:仍返回 10 列', (nd.columns || []).length === 10, String((nd.columns || []).length))
  const emptyStd = (nd.columns || []).filter((c) => !c.standard)
  ok('⑤ 无工艺清单:标准留白(表观/浊度仍是 "/")', emptyStd.length === 7
    && (nd.columns || []).filter((c) => c.standard === '/').length === 3,
    `空=${emptyStd.length} 斜线=${(nd.columns || []).filter((c) => c.standard === '/').length}`)
} finally {
  // 清场:删掉 fixture(只删这一张,不碰别的)
  await new mssql.Request(p).query(`DELETE FROM dbo.rd_mold_proc_head WHERE 单据编号=N'${FIXTURE}'`)
  console.log('  fixture 已清除')
  await p.close()
}
console.log(`\n== 首件检验 ↔ 成型工艺清单 关联:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
