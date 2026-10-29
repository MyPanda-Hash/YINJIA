/**
 * 负库存配平(可直接放服务器上跑的单文件脚本)
 * ============================================================================
 * 做什么:
 *   ① 自动识别「测试造数」并把它们从库存账里删干净(测试物料整条链、跨批重复记账行)
 *   ② 把真实负库存配平成 **严格大于 0**(不是补到 0:补到 0 的行在月结 reconcileKucun 里
 *      会被当「零余额批次」清掉,那个批次号就从库存明细里消失了)
 *   ③ 用**新建其他入库单 + 审核过账**的正规方式改库存,不是直接 UPDATE kucun
 *   ④ 全程一个事务,失败整笔回滚;动手前自动备份;跑完自动复核
 *
 * 为什么必须走单据(不能直接改 kucun):
 *   库存三表口径:流水 inh/outh 是唯一真源,kucun 只是结存缓存。直接 UPDATE kucun 会留下
 *   「结存 ≠ Σ流水」的暗账,月结重算一跑就被打回负数,库存台账/收发存/成本全部对不上。
 *
 * 审核人口径(照抄 9–10 月既有入库单):
 *   yj_doc_status 实测:OTHER_IN 14 张 shr 全是 admin;PURCHASE_IN / FINISH_IN / TRANSFER 也是 admin。
 *   代码里「直接审核仅管理员」,非管理员只能走「提交审批→审批通过」,shr 会是普通账号,与其它单不一致。
 *
 * 用法(服务器上):
 *   node balance-negative-stock.js --check                 # 只看不改:负数多少、测试数据多少
 *   node balance-negative-stock.js --dry-run               # 预演:列出要删的、要补的清单
 *   node balance-negative-stock.js --apply                 # 真跑(要输入大写 YES 确认)
 *   node balance-negative-stock.js --apply --yes           # 真跑(无人值守)
 *   node balance-negative-stock.js --verify                # 只读复核
 *
 * 常用参数:
 *   --db <库名>        默认取环境变量 YINJIA_SQL_DB,再默认 HSDZ_MES
 *   --server/--port/--user/--password   也可用环境变量 YINJIA_SQL_HOST / _PORT / _USER / _PASS
 *   --auditor <账号>   审核人,默认 admin
 *   --target <n>       真实负库存配平到的目标值,默认 1(**严格大于 0**;填 0 就会在月结时被清掉)
 *   --min-qty <n>      数量小于该值视为 0,默认 0.0001
 *   --no-test-cleanup  不动测试数据(只配平)
 *   --keep-next        不关闭「下月月初的结转行」(默认会关掉,否则补的料会被带进期末)
 *   --audit-now        审核时间 = 运行时刻(默认 = 单据日期当日 17:30)
 *   --lot-policy <p>   批号取值:as-is(默认,照抄) / pc0000(无批号补 PC0000)
 *   --business-type <p> 业务类型:其他入库(默认)
 *   --supplier <码|none> 供应商,默认沿用既有单的 GYS00014
 *   --out <目录>       备份/报告目录,默认脚本同目录下 _balance-out
 *
 * 退出码:0 成功 / 2 参数错 / 3 体检不过 / 4 用户取消 / 5 写库失败已回滚 / 1 其它异常
 * ----------------------------------------------------------------------------
 * 依赖:只需要 tedious(若在仓库内运行会自动用 deploy/node_modules 里的那份)
 *   npm i tedious        # 服务器上单独放这一个脚本时
 * ============================================================================
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createInterface } = require('node:readline')

// ── tedious:优先本地 node_modules,其次仓库内 deploy/node_modules ──
function loadTedious() {
  const tries = []
  try { return require('tedious') } catch { tries.push('tedious') }
  try { return require(path.join(__dirname, 'deploy', 'node_modules', 'tedious')) } catch { tries.push('deploy/node_modules/tedious') }
  try { return require(path.join(__dirname, '..', 'deploy', 'node_modules', 'tedious')) } catch { tries.push('../deploy/node_modules/tedious') }
  console.error(`[✗] 找不到 tedious 模块(试过:${tries.join(' , ')})\n    在脚本同目录执行:npm i tedious`)
  process.exit(1)
}
const tds = loadTedious()

// ════════════════════════════════ 参数 ════════════════════════════════
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d = null) => {
  const i = argv.indexOf(f)
  if (i < 0) return d
  const v = argv[i + 1]
  return v && !v.startsWith('--') ? v : d
}
const env = process.env

const CFG = {
  db: val('--db', env.YINJIA_SQL_DB || 'HSDZ_MES'),
  server: val('--server', env.YINJIA_SQL_HOST || '127.0.0.1'),
  port: Number(val('--port', env.YINJIA_SQL_PORT || '1433')),
  user: val('--user', env.YINJIA_SQL_USER || 'yinjia'),
  password: val('--password', env.YINJIA_SQL_PASS || 'Yinjia@2026'),
  check: has('--check'),
  dryRun: has('--dry-run'),
  apply: has('--apply'),
  verify: has('--verify'),
  yes: has('--yes'),
  auditor: val('--auditor', 'admin'),
  target: Number(val('--target', '1')),
  minQty: Number(val('--min-qty', '0.0001')),
  cleanTests: !has('--no-test-cleanup'),
  closeNextCarry: !has('--keep-next'),
  auditNow: has('--audit-now'),
  lotPolicy: val('--lot-policy', 'as-is'),
  businessType: val('--business-type', '其他入库'),
  supplier: val('--supplier', 'GYS00014'),
  out: val('--out', path.join(__dirname, '_balance-out')),
}

function die(code, msg) {
  console.error('\x1b[31m[✗] ' + msg + '\x1b[0m')
  process.exit(code)
}
if (CFG.apply && CFG.dryRun) die(2, '--apply 与 --dry-run 不能同时给')
if (!Number.isFinite(CFG.target) || CFG.target < 0) die(2, '--target 必须是 >= 0 的数')
if (!['as-is', 'pc0000'].includes(CFG.lotPolicy)) die(2, "--lot-policy 只能是 as-is / pc0000")
if (!['其他入库'].includes(CFG.businessType)) die(2, "--business-type 目前只支持 '其他入库'")
if (CFG.target === 0) {
  console.warn('\x1b[33m[!] --target 0:补到 0 的行会在下次月结被当「零余额批次」清掉,该批次号将从库存明细消失。')
  console.warn('    用户口径是「大于 0」,建议保持默认 --target 1。\x1b[0m')
}

// ════════════════════════════════ 常量 ════════════════════════════════
const C = {
  PANEL: 'OTHER_IN',
  HEAD: 'bd_other_in',
  LINE: 'bl_other_in',
  SRC: 3,                 // StockFlowService.inSrc('OTHER_IN') = 3
  DOC_TYPE: '其他入库单',   // StockLedgerService.loadRows('OTHER_IN') 里硬写的值
  CARRY_TYPE: '月结结转',   // 月结行是期末标记,不是真实入库,累计净额要排除
  NO_PREFIX: 'QTRK',      // 既有 14 张其他入库单的编号规则
  SEQ_WIDTH: 5,
  // 明显错误的单据日期:早于 2000 年(期初占位)或晚于「今天 + 90 天」(迁移回填写错的年份)
  FUTURE_SLACK_DAYS: 90,
  // 测试数据识别:编码带这些片段的,或编码/名称以外独立命中的
  TEST_CODE_RE: '(^|[^A-Za-z])(TEST|DEMO|DUMMY|SAMPLE)[-_]?[A-Za-z0-9]*$|^__TEST|^ZZ_TEST|^TMP[-_]',
  TEST_NAME_RE: '测试|演示|样例|示例|^test$|^demo$',
  // 「期初」以外的入库都算真实入库(期初 INIT-* 是 1900 年占位日期)
  INIT_TYPE: '期初结存',
}

const pad = (s, n) => String(s ?? '').padEnd(n)
const lpad = (s, n) => String(s ?? '').padStart(n)
const r4 = (v) => Math.round(Number(v || 0) * 10000) / 10000
const n2 = (v) => Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const ok = (m) => console.log('\x1b[32m[✓] ' + m + '\x1b[0m')
const warn = (m) => console.log('\x1b[33m[!] ' + m + '\x1b[0m')
const bad = (m) => console.log('\x1b[31m[✗] ' + m + '\x1b[0m')
const info = (m) => console.log(m)
const ymd = (d) => (d ? String(d).slice(0, 10) : '')
const ymdCompact = (d) => ymd(d).replace(/-/g, '')
const addDays = (dateStr, n) => {
  const d = new Date(ymd(dateStr) + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ════════════════════════════════ 数据库 ════════════════════════════════
/** 极简 tedious 封装:p.query(sql, params) → 行对象数组;p.tx 里走同一连接的事务。 */
function makeSession(dbName, { transactional = false } = {}) {
  return new Promise((resolve, reject) => {
    const conn = new tds.Connection({
      server: CFG.server,
      authentication: { type: 'default', options: { userName: CFG.user, password: CFG.password } },
      options: {
        port: CFG.port, database: dbName, encrypt: false, trustServerCertificate: true,
        requestTimeout: 300000, connectTimeout: 20000, rowCollectionOnRequestCompletion: true,
        useColumnNames: true, tdsVersion: '7_4',
      },
    })
    conn.on('error', (e) => reject(e))

    /**
     * 执行一条 SQL。
     *
     * ⚠ 这里刻意**不用 tedious 的 TYPES.Decimal**:本机实测(tedious 16.7.1 + 这台 SQL Server),
     *   Decimal/Numeric 参数会把小数**截成整数**('0.0001' → 0、'782587.2' → 782587),
     *   查询条件 `yl < -:m` 于是变成 `yl < 0` 的退化版、过账数量也全被截整,属于静默算错(最危险那种)。
     *   现做法:参数一律按 **nvarchar** 传原文,并在 SQL 里用 CONVERT(decimal(38,10), 参数) 显式转换 ——
     *   精度由 SQL 端保证,不依赖驱动的类型编码。Float/Money 实测正常,但 decimal 业务不用浮点。
     *
     * 拼声明:每个 :num 参数在语句前 DECLARE 成 decimal,每个 :str 参数 DECLARE 成 nvarchar。
     */
    const expand = (sql, params = {}) => {
      const used = {}
      const body = String(sql).replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (m, name) => {
        if (!(name in params)) return m          // 不是参数(比如时间字面量)就原样留着
        used[name] = true
        const v = params[name]
        if (v === null || v === undefined) return `CONVERT(nvarchar(500), NULL)`
        const isNum = typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))
        return isNum ? `CONVERT(decimal(38,10), N'${String(v)}')` : `N'${String(v).replace(/'/g, "''")}'`
      })
      return { sql: body, used, params }
    }

    const send = (sql, params = {}) => new Promise((res, rej) => {
      const { sql: body } = expand(sql, params)
      const req = new tds.Request(body, (err, rowCount, rows) => {
        if (err) {
          // 附带出错的 SQL 片段,便于定位(否则只有一句 "Incorrect syntax near ':'")
          err.sqlSnippet = body.replace(/\s+/g, ' ').slice(0, 400)
          const rest = [...body.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[0])
          if (rest.length) err.unexpanded = [...new Set(rest)]
          return rej(err)
        }
        // useColumnNames:true ⇒ 每个单元格是 { value, metadata },这里摊平成普通值
        res({ rowCount, rows: (rows || []).map((cols) => {
          const o = {}
          for (const [k, cell] of Object.entries(cols)) o[k] = cell && typeof cell === 'object' && 'value' in cell ? cell.value : cell
          return o
        }) })
      })
      conn.execSql(req)
    })

    conn.connect(async (err) => {
      if (err) return reject(err)
      const api = {
        query: async (sql, params) => (await send(sql, params)).rows,
        exec: async (sql, params) => (await send(sql, params)).rowCount,
        begin: () => new Promise((r, j) => conn.beginTransaction((e) => (e ? j(e) : r()), 'BALANCE_NEG_STOCK')),
        commit: () => new Promise((r, j) => conn.commitTransaction((e, t) => (e ? j(e) : r(t)))),
        rollback: () => new Promise((r) => conn.rollbackTransaction(() => r())),
        close: () => new Promise((r) => { conn.close(); r() }),
      }
      if (transactional) {
        try { await api.begin() } catch (e) { return reject(e) }
      }
      resolve(api)
    })
  })
}

// ════════════════════════════════ 分析 ════════════════════════════════
/**
 * 一次读全量,在内存里算清楚,再决定写什么(写库那一步只按分析结果执行)。
 * 返回 { plan } — plan 是「要干什么」的完整清单,预演和真跑走同一份。
 */
async function analyze(p) {
  const [negRows, inFlows, outFlows, whs, invs, docInvRows] = [
    await p.query(`
      SELECT id, RTRIM(wzdm) AS w, ISNULL(RTRIM(ckdm),'') AS c, ISNULL(RTRIM(lot_no),'') AS l,
             CAST(ISNULL(yl,0) AS decimal(18,4)) AS yl, ISNULL(预警数量,0) AS warnq, ISNULL(asp_user1,'') AS u1
        FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -:m
       ORDER BY wzdm, ckdm, lot_no`, { m: CFG.minQty }),
    await p.query(`
      SELECT i.id, i.rid, RTRIM(i.物料编码) AS w, ISNULL(RTRIM(i.仓库编码),'') AS c, ISNULL(RTRIM(i.批号),'') AS l,
             CONVERT(varchar(10), i.单据日期, 120) AS d, CAST(i.数量 AS decimal(18,4)) AS q,
             ISNULL(i.单据类型,'') AS t, ISNULL(i.src,-1) AS src, ISNULL(i.单据编号,'') AS no,
             -- rid 是否仍能指回单据明细行(回填写入的老行 rid 早已失效)
             CASE WHEN i.单据类型 = N'采购入库单' AND EXISTS (SELECT 1 FROM bl_purchase_in x WHERE x.id = i.rid) THEN 1
                  WHEN i.单据类型 = N'产成品入库单' AND EXISTS (SELECT 1 FROM bl_finish_in x WHERE x.id = i.rid) THEN 1
                  WHEN i.单据类型 = N'其他入库单' AND EXISTS (SELECT 1 FROM bl_other_in x WHERE x.id = i.rid) THEN 1
                  ELSE 0 END AS ridHit
        FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y'`),
    await p.query(`
      SELECT id, RTRIM(物料编码) AS w, ISNULL(RTRIM(仓库编码),'') AS c, ISNULL(RTRIM(批号),'') AS l,
             CONVERT(varchar(10), 单据日期, 120) AS d, CAST(数量 AS decimal(18,4)) AS q,
             ISNULL(单据类型,'') AS t, ISNULL(src,-1) AS src, ISNULL(单据编号,'') AS no
        FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'`),
    await p.query(`SELECT 仓库编码 AS c, 仓库名称 AS n FROM bs_wh`),
    await p.query(`SELECT 存货编码 AS c, 存货名称 AS n, 规格型号 AS s, 计量单位 AS u,
                          ISNULL(最近采购入库成本, ISNULL(参考成本,0)) AS px
                     FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'`),
    // 单据明细里留着的物料名称/规格/单位/单价 —— 档案漏同步时可据此补建 bs_inv,不必去查金蝶
    await p.query(`
      SELECT 存货编码 AS c, 存货名称 AS n, 规格型号 AS s, 计量单位 AS u, 单价 AS px, 'bl_purchase_in' AS src FROM bl_purchase_in
       WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存货编码,'')<>''
      UNION ALL
      SELECT 材料编码, 材料名称, 规格型号, 计量单位, 单价, 'bl_material_out' FROM bl_material_out
       WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(材料编码,'')<>''
      UNION ALL
      SELECT 产品编码, 产品名称, 规格型号, 计量单位, 单价, 'bl_finish_in' FROM bl_finish_in
       WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(产品编码,'')<>''`),
  ]
  const whName = new Map(whs.map((r) => [String(r.c).trim(), r.n]))
  const invMap = new Map(invs.map((r) => [String(r.c).trim(), r]))
  // 单据侧档案备胎:同一物料取「最近出现且有名称」的那条明细
  const docInv = new Map()
  for (const r of docInvRows) {
    const code = String(r.c).trim()
    const cur = docInv.get(code)
    if (!cur || (!cur.n && r.n)) docInv.set(code, { n: r.n, s: r.s, u: r.u, px: r.px })
  }

  // ── ① 认测试物料 ──
  const testMatSet = new Set()
  const testReason = new Map()
  const allW = new Set([...negRows.map((r) => r.w), ...inFlows.map((r) => r.w), ...outFlows.map((r) => r.w)])
  for (const w of allW) {
    const inv = invMap.get(String(w).trim())
    const name = inv ? String(inv.n || '') : ''
    if (new RegExp(C.TEST_CODE_RE, 'i').test(w)) { testMatSet.add(w); testReason.set(w, `编码命中测试规则(${w})`) }
    else if (!inv && new RegExp(C.TEST_NAME_RE, 'i').test(name)) { testMatSet.add(w); testReason.set(w, `名称命中测试规则(${name})`) }
    else if (/^(TEST|DEMO)/i.test(w)) { testMatSet.add(w); testReason.set(w, '编码以 TEST/DEMO 开头') }
  }

  const keyOf = (w, c, l) => `${w}\u0001${c}\u0001${l}`
  const negKeys = new Map()
  for (const r of negRows) negKeys.set(keyOf(r.w, r.c, r.l), r)

  // ── ② 按 (物料,仓库) 分组,算「资产 vs 负债」 ──
  const group = new Map() // w|c → { keys: Map(l → flow{in,out,balance}) }
  const touch = (w, c, l) => {
    const g = `${w}\u0001${c}`
    if (!group.has(g)) group.set(g, { w, c, keys: new Map(), flows: [] })
    const G = group.get(g)
    if (!G.keys.has(l)) G.keys.set(l, { l, inq: 0, outq: 0, lastIn: '', lastOut: '', hasRealIn: false })
    return G.keys.get(l)
  }
  for (const f of inFlows) {
    if (f.t === C.CARRY_TYPE) continue          // 月结结转是期末标记,不是真实入库,不参与累计
    const K = touch(f.w, f.c, f.l)
    K.inq = r4(K.inq + Number(f.q))
    if (f.d && f.d > (K.lastIn || '')) K.lastIn = f.d
    if (f.t !== C.INIT_TYPE) K.hasRealIn = true
    group.get(`${f.w}\u0001${f.c}`).flows.push(f)
  }
  for (const f of outFlows) {
    const K = touch(f.w, f.c, f.l)
    K.outq = r4(K.outq + Number(f.q))
    if (f.d && f.d > (K.lastOut || '')) K.lastOut = f.d
  }
  // kucun 里可能有流水里没出现的键(历史残影),并进来
  for (const r of negRows) touch(r.w, r.c, r.l)

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const futureLimit = addDays(todayStr, C.FUTURE_SLACK_DAYS)

  /** 把明显写错的日期规范化:1900(期初占位)→ 留空;超过今天+90天 → 平移到同月同日 2026 年 */
  function normalizeDate(d) {
    if (!d) return { d: '', fixed: false }
    if (d < '2000-01-01') return { d: '', fixed: true, why: `该流水日期是 ${d}(期初占位/笔误)` }
    if (d > futureLimit) {
      const guess = '2026' + d.slice(4)
      return { d: guess <= todayStr ? guess : todayStr, fixed: true, why: `该流水日期是 ${d},晚于今天+${C.FUTURE_SLACK_DAYS} 天,按 2026 年同日更正` }
    }
    return { d, fixed: false }
  }

  // ── 入库单的明细行数(判断「流水比明细多」= 重复登记)。三类入库面板各查一次 ──
  const docLineCount = new Map()   // 单据编号 → { lines, head }
  {
    const rows = [
      ['采购入库单', await p.query(`SELECT 单据编号 AS no, COUNT(*) AS lines FROM bl_purchase_in
                                      WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号`)],
      ['产成品入库单', await p.query(`SELECT 单据编号 AS no, COUNT(*) AS lines FROM bl_finish_in
                                        WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号`)],
      ['其他入库单', await p.query(`SELECT 单据编号 AS no, COUNT(*) AS lines FROM bl_other_in
                                      WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号`)],
    ]
    for (const [, list] of rows) for (const r of list) docLineCount.set(String(r.no), { lines: Number(r.lines) })
  }

  // ── ③ 逐 (物料,仓库) 决定:整条链删测试 / 删重复记账 / 配平 ──
  const delTest = { keys: [], mats: new Set(), rows: { inh: [], outh: [], kucun: [] } }
  const delDup = { keys: [], flows: [], notes: [] }
  const balance = []
  const notes = []
  const testedGroups = new Set()

  // ── 重复入库:同一入库单里,同一物料 + 同数量的流水出现两遍,且**流水的行数多于单据明细的行数** ──
  //   实测(2026-10-22)两类长得一样、本质不同,必须分开:
  //     · 产成品入库 CPRK-20261005-00005:A-48-19 是真的分 3 行入(明细 6 行 = 流水 6 行)⇒ 正常业务,不动;
  //     · 采购入库 CGRK-20260915-03213:明细只有 1 行 2000,流水却有 2 行 2000
  //       (id=10 rid=11 批号 NULL ← 回填时写的;id=1384 rid=786 批号 SX-20260915 ← 正常审核写的)
  //       ⇒ 回填与审核各写一遍,是重复。
  //   判据就用「流水行数 > 明细行数」,并保留 rid 仍能指回现存明细行的那一条。
  const dupPlan = []
  for (const [g, G] of group) {
    if (testMatSet.has(G.w)) continue
    // 本组涉及的单据(只需查有重复候选的单据)
    const byNo = new Map()
    for (const f of G.flows) {
      if (!f.no || f.t === C.CARRY_TYPE || f.t === C.INIT_TYPE) continue
      if (!byNo.has(f.no)) byNo.set(f.no, [])
      byNo.get(f.no).push(f)
    }
    for (const [no, list] of byNo) {
      const byKey = new Map()
      for (const f of list) {
        const k = `${f.w}\u0001${f.c}\u0001${r4(f.q)}`
        if (!byKey.has(k)) byKey.set(k, [])
        byKey.get(k).push(f)
      }
      for (const [, same] of byKey) {
        if (same.length < 2) continue
        const info = docLineCount.get(no)
        if (!info || info.lines >= list.length) continue      // 明细行数 ≥ 流水行数 ⇒ 正常多行,跳过
        const sorted = same.slice().sort((a, b) => (b.ridHit - a.ridHit) || ((b.l ? 1 : 0) - (a.l ? 1 : 0)) || (a.id - b.id))
        const [keep, ...drop] = sorted
        dupPlan.push({ no, w: G.w, c: G.c, l: keep.l, qty: r4(keep.q), keepId: keep.id, dropIds: drop.map((x) => x.id) })
      }
    }
  }

  for (const [g, G] of group) {
    if (testMatSet.has(G.w)) {
      testedGroups.add(g)
      delTest.mats.add(G.w)
      continue
    }
    const keys = [...G.keys.values()]
    for (const K of keys.filter((k) => negKeys.has(keyOf(G.w, G.c, k.l)))) {
      const row = negKeys.get(keyOf(G.w, G.c, K.l))
      const inq = r4(K.inq), outq = r4(K.outq)
      const balAt = r4(inq - outq)
      const yl = Number(row.yl)
      const qty = r4(CFG.target - yl)          // 补到 target(默认 1,严格大于 0)
      const nOut = normalizeDate(K.lastOut)
      const nIn = normalizeDate(K.lastIn)
      let date = nOut.d || nIn.d
      if (!date) {
        // 该键没有出库也没有入库(纯挂账残影):退到同 (物料,仓库) 其它批次的最晚出库日
        const cand = keys.map((x) => normalizeDate(x.lastOut).d).filter(Boolean).sort()
        date = cand.length ? cand[cand.length - 1] : todayStr
      }
      const why = nOut.d && nOut.fixed ? nOut.why : (nIn.d && nIn.fixed ? nIn.why : null)
      const label = `${G.w}@${G.c}@${K.l || '(无批号)'}`
      balance.push({
        w: G.w, c: G.c, l: K.l, yl, qty, date,
        inq, outq, balAt, lastOut: K.lastOut, lastIn: K.lastIn,
        dateFixed: Boolean(why), dateWhy: why || null,
        warnq: Number(row.warnq || 0),
        hasWh: whName.has(String(G.c).trim()),
        hasInv: invMap.has(String(G.w).trim()),
      })
      if (why) notes.push(`${label}:${why} → 补单日期取 ${date}`)
    }
  }

  // 重复入库的重复行删掉后,该键要按「剩下的流水」重算结存(与删测试物料同款:同步改 kucun)
  for (const d of dupPlan) {
    delDup.keys.push(d)
    notes.push(`重复入库:${d.no} 的 ${d.w}@${d.c} 批号${d.l || '(无批号)'} 有 ${d.dropIds.length + 1} 行数量相同的入库`
      + ` → 保留 1 行,删除多余 ${d.dropIds.length} 行`)
  }

  const totalNeg = r4(negRows.reduce((s, r) => s + Number(r.yl), 0))
  const testNegRows = negRows.filter((r) => testMatSet.has(r.w))
  const totalTest = r4(testNegRows.reduce((s, r) => s + Number(r.yl), 0))

  return {
    raw: { negRows, inFlows, outFlows },
    maps: { whName, invMap, docInv },
    summary: {
      negCount: negRows.length, totalNeg, testNegRows: testNegRows.length, totalTest,
      testMats: [...delTest.mats], testReason, testedGroups: [...testedGroups],
    },
    delTest, delDup, balance, notes, today: todayStr,
  }
}

// ════════════════════════════════ 预演输出 ════════════════════════════════
function printAnalysis(A) {
  const s = A.summary
  info(`\n${'═'.repeat(78)}`)
  info(` 库:${CFG.db}   服务器:${CFG.server}:${CFG.port}   目标:真实负库存 → 严格大于 0(补到 ${CFG.target})`)
  info(`${'═'.repeat(78)}`)

  info(`\n① 负结存:${s.negCount} 行 / 合计 ${n2(s.totalNeg)}`)

  info(`\n② 测试造数识别:${s.testMats.length} 个物料,占 ${s.testNegRows} 行负结存 / ${n2(s.totalTest)}`)
  if (s.testMats.length) {
    for (const m of s.testMats) info(`   · ${pad(m, 18)} ${s.testReason.get(m) || ''}`)
    info('   → 这些物料的**整条库存链**(入库/出库流水 + kucun 行 + 月结结转行)将被删除')
  } else info('   (未识别到测试物料)')

  info(`\n③ 重复入库(同一单据同物料同仓库的多行):${A.delDup.keys.length} 处,将删除多余 ${A.delDup.keys.reduce((s, k) => s + k.dropIds.length, 0)} 行`)
  for (const k of A.delDup.keys.slice(0, 15))
    info(`   · ${pad(k.no, 22)} ${pad(k.w, 15)} ${pad(k.c, 9)} 批号=${pad(k.l || '(无批号)', 14)} 每行 ${n2(k.qty)} × ${k.dropIds.length + 1}`)
  if (A.delDup.keys.length > 15) info(`   … 其余 ${A.delDup.keys.length - 15} 处见报告文件`)
  if (A.delDup.keys.length) info('   → 保留 1 行、删除多余行,并按剩余流水重算该键结存(不多补一分钱)')

  info(`\n④ 真实负库存配平:${A.balance.length} 行,补货合计 ${n2(A.balance.reduce((x, r) => x + r.qty, 0))}`)
  if (A.balance.length) {
    info('   ' + pad('物料', 16) + pad('仓库', 10) + pad('批号', 18) + lpad('当前结存', 11) + lpad('补货', 11) + '  单据日期')
    const shown = A.balance.slice().sort((a, b) => a.yl - b.yl)
    for (const r of shown.slice(0, 25)) {
      info('   ' + pad(r.w, 16) + pad(r.c, 10) + pad(r.l || '(无批号)', 18) + lpad(n2(r.yl), 11) + lpad(n2(r.qty), 11) + '  ' + r.date
        + (r.dateFixed ? '  ⚠日期已规范化' : ''))
    }
    if (shown.length > 25) info(`   … 其余 ${shown.length - 25} 行见报告文件`)
  }

  if (A.notes.length) {
    info('\n⑤ 日期/口径修正:')
    for (const n of A.notes.slice(0, 20)) info('   · ' + n)
    if (A.notes.length > 20) info(`   … 其余 ${A.notes.length - 20} 条见报告文件`)
  }

  const noWh = A.balance.filter((r) => !r.hasWh)
  const noInv = A.balance.filter((r) => !r.hasInv)
  if (noWh.length) warn(`\n${noWh.length} 行的仓库在 bs_wh 里不存在(无法建单):` + [...new Set(noWh.map((r) => r.c))].join(', '))
  if (noInv.length) warn(`${noInv.length} 行的物料不在 bs_inv:${[...new Set(noInv.map((r) => r.w))].join(', ')}(将按单据明细里的名称自动补建档案)`)

  // 单据归集
  const docs = groupToDocs(A.balance)
  info(`\n⑥ 将新建 ${docs.length} 张「其他入库单」(${A.balance.length} 行),审核人 ${CFG.auditor}`)
  for (const d of docs.slice(0, 10)) info(`   ${pad(d.no, 24)} ${d.date}  ${lpad(d.rows.length, 3)} 行  ${n2(d.rows.reduce((x, r) => x + r.qty, 0))}`)
  if (docs.length > 10) info(`   … 其余 ${docs.length - 10} 张见报告文件`)
  return docs
}

let seqSeed = null
function groupToDocs(rows) {
  const byDate = new Map()
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date).push(r)
  }
  const out = []
  let seq = seqSeed ?? 1
  for (const date of [...byDate.keys()].sort()) {
    out.push({
      date,
      no: `${C.NO_PREFIX}-${ymdCompact(date)}-${String(seq).padStart(C.SEQ_WIDTH, '0')}`,
      rows: byDate.get(date),
    })
    seq++
  }
  return out
}

// ════════════════════════════════ 执行 ════════════════════════════════
async function main() {
  fs.mkdirSync(CFG.out, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')

  // ── 先连库、选号 ──
  let p = await makeSession(CFG.db)
  const dbInfo = (await p.query(`SELECT DB_NAME() AS d, @@VERSION AS v`))[0]
  info(`连接成功:${dbInfo.d}`)
  const mx = await p.query(`SELECT MAX(TRY_CAST(RIGHT(单据编号, ${C.SEQ_WIDTH}) AS int)) AS mx
                              FROM ${C.HEAD} WHERE 单据编号 LIKE '${C.NO_PREFIX}-%'`)
  seqSeed = Number(mx[0]?.mx || 0) + 1

  // ── 只读检查(与预演同一条路:算完照常落报告,只是不写库) ──
  if (CFG.check) {
    const A = await analyze(p)
    const docs = printAnalysis(A)
    const f = path.join(CFG.out, `check-${CFG.db}-${stamp}.json`)
    fs.writeFileSync(f, JSON.stringify({ generatedAt: new Date().toISOString(), db: CFG.db, summary: A.summary, docs }, null, 2), 'utf8')
    info(`\n检查结果已存:${f}`)
    await p.close()
    return
  }

  // ── 复核 ──
  if (CFG.verify) {
    await verifyOnly(p)
    await p.close()
    return
  }

  // ── 分析 ──
  const A = await analyze(p)
  const docs = printAnalysis(A)

  // 体检:仓库档案必须齐全;物料档案缺失的,只要**单据明细里有名称**就自动补建,不算阻断问题
  const problems = []
  const willCreate = []           // 要补建的物料档案
  for (const r of A.balance) {
    if (!r.hasWh) problems.push(`仓库档案缺失:${r.c}`)
    if (!r.hasInv) {
      const d = A.maps.docInv.get(String(r.w).trim())
      if (d && d.n) { if (!willCreate.some((x) => x.c === r.w)) willCreate.push({ c: r.w, n: d.n, s: d.s || '', u: d.u || '', px: Number(d.px || 0) }) }
      else problems.push(`物料档案缺失,单据里也查不到名称,无法补建:${r.w}`)
    }
  }
  const auditor = await p.query(`SELECT username FROM yj_user WHERE username = :u`, { u: CFG.auditor })
  if (!auditor.length) problems.push(`审核人账号不存在:${CFG.auditor}`)
  const existNos = new Set((await p.query(`SELECT 单据编号 FROM ${C.HEAD}`)).map((r) => r['单据编号']))
  for (const d of docs) if (existNos.has(d.no)) problems.push(`单据号已存在:${d.no}`)

  if (willCreate.length) {
    info(`\n补建存货档案 ${willCreate.length} 个(bs_inv 漏同步,名称/规格/单位取自单据明细):`)
    for (const x of willCreate) info(`   · ${pad(x.c, 14)} ${x.n} ${x.s} ${x.u}`)
  }

  const report = {
    generatedAt: new Date().toISOString(), db: CFG.db, cfg: CFG,
    summary: A.summary, delTest: A.delTest, delDup: A.delDup, balance: A.balance, docs, notes: A.notes, willCreate,
  }
  const reportFile = path.join(CFG.out, `plan-${CFG.db}-${stamp}.json`)
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8')
  info(`\n计划已存:${reportFile}`)

  if (problems.length) {
    bad('\n体检未通过,未改动任何数据:')
    for (const x of [...new Set(problems)]) info('   · ' + x)
    await p.close()
    process.exit(3)
  }

  if (!CFG.apply) {
    info('\n以上为预演。确认无误后加 --apply 真跑。')
    await p.close()
    return
  }

  // ── 确认 ──
  if (!CFG.yes) {
    const ans = await ask(`\n确认在【${CFG.db}】上执行?删除测试物料 ${A.summary.testMats.length} 个、`
      + `重复记账批次 ${A.delDup.keys.length} 个,新建 ${docs.length} 张其他入库单。\n输入大写 YES 继续:`)
    if (ans.trim() !== 'YES') { warn('已取消,未改动任何数据'); await p.close(); process.exit(4) }
  }

  // ── 备份 ──
  const backup = {
    takenAt: new Date().toISOString(), db: CFG.db,
    negRows: A.raw.negRows,
    testMats: A.summary.testMats,
    kucunAffected: await p.query(`SELECT * FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -:m`, { m: CFG.minQty }),
    watermarks: {
      inhMax: (await p.query(`SELECT MAX(id) AS v FROM inh`))[0]?.v,
      outhMax: (await p.query(`SELECT MAX(id) AS v FROM outh`))[0]?.v,
      headMax: (await p.query(`SELECT MAX(id) AS v FROM ${C.HEAD}`))[0]?.v,
      lineMax: (await p.query(`SELECT MAX(id) AS v FROM ${C.LINE}`))[0]?.v,
      statusMax: (await p.query(`SELECT MAX(id) AS v FROM yj_doc_status`))[0]?.v,
      approvalMax: (await p.query(`SELECT MAX(id) AS v FROM yj_form_approval`))[0]?.v,
    },
    // 测试物料在删除前的全部痕迹(inh / outh / kucun),供人工回滚或事后核对
    testFlowRows: A.summary.testMats.length
      ? {
        inh: await p.query(`SELECT * FROM inh WHERE 物料编码 IN (${A.summary.testMats.map((_, i) => `:m${i}`).join(',')})`,
          Object.fromEntries(A.summary.testMats.map((m, i) => [`m${i}`, m]))),
        outh: await p.query(`SELECT * FROM outh WHERE 物料编码 IN (${A.summary.testMats.map((_, i) => `:m${i}`).join(',')})`,
          Object.fromEntries(A.summary.testMats.map((m, i) => [`m${i}`, m]))),
        kucun: await p.query(`SELECT * FROM kucun WHERE wzdm IN (${A.summary.testMats.map((_, i) => `:m${i}`).join(',')})`,
          Object.fromEntries(A.summary.testMats.map((m, i) => [`m${i}`, m]))),
      }
      : {},
  }
  const backupFile = path.join(CFG.out, `backup-${CFG.db}-${stamp}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8')
  ok(`已备份快照:${backupFile}`)
  await p.close()

  // ── 单事务执行 ──
  p = await makeSession(CFG.db, { transactional: true })
  const stats = { invAdded: 0, testInh: 0, testOuth: 0, testKucun: 0, dupInh: 0, dupOuth: 0, dupKucun: 0,
    heads: 0, lines: 0, flows: 0, kucunUpd: 0, kucunIns: 0, status: 0, trail: 0, carryClosed: 0 }
  try {
    // 应用锁:与月结/其它配平互斥(锁随事务释放)
    const lock = await p.query(`DECLARE @r int; EXEC @r = sp_getapplock @Resource='balance-negative-stock',
                                  @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0; SELECT @r AS v`)
    if (Number(lock[0].v) < 0) throw new Error('另一个配平/月结任务正在执行(拿不到应用锁),请稍后重试')

    // ① 补建漏同步的存货档案(否则其他入库单没有名称/规格/单位可写)
    //    所属类别 NOT NULL:取「同前缀」的既有物料类别(如 YJ-GL-047 → YJ-GL-04x 的类别);
    //    取不到就用该物料在最近一张采购入库单里的分类感较小的默认值 null→'未分类'。
    for (const x of (willCreate || [])) {
      await p.exec(`IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE 存货编码 = :c)
                    INSERT INTO bs_inv (所属类别, 存货编码, 存货名称, 规格型号, 计量单位, 状态,
                                        是否检验, 数据来源, asp_user1, asp_time1, asp_cancel)
                    VALUES (
                      ISNULL((SELECT TOP 1 所属类别 FROM bs_inv
                               WHERE ISNULL(asp_cancel,'N')<>'Y' AND 所属类别 IS NOT NULL
                                 AND LEFT(存货编码, LEN(:c) - 1) = LEFT(:c, LEN(:c) - 1)
                               ORDER BY id), N'未分类'),
                      :c, :n, :s, :u, N'启用', 1, N'配平补建', :who, GETDATE(), 'N')`,
        { c: x.c, n: x.n, s: x.s, u: x.u, who: 'balance-fix' })
      stats.invAdded++
    }
    if (stats.invAdded) ok(`补建存货档案 ${stats.invAdded} 个`)

    // ② 删测试数据:整条链
    if (CFG.cleanTests && A.summary.testMats.length) {
      for (const m of A.summary.testMats) {
        stats.testInh += await p.exec(`DELETE FROM inh WHERE 物料编码 = :m`, { m })
        stats.testOuth += await p.exec(`DELETE FROM outh WHERE 物料编码 = :m`, { m })
        stats.testKucun += await p.exec(`DELETE FROM kucun WHERE RTRIM(wzdm) = :m`, { m })
      }
      ok(`删除测试物料 ${A.summary.testMats.length} 个:inh ${stats.testInh} · outh ${stats.testOuth} · kucun ${stats.testKucun} 行`)
    }

    // ② 删重复入库的多余行(同一单据同物料同仓库、数量相同的那几条),再按剩余流水重算该键结存
    for (const k of A.delDup.keys) {
      for (const id of k.dropIds) {
        stats.dupInh += await p.exec(`DELETE FROM inh WHERE id = :id AND ISNULL(asp_cancel,'N') <> 'Y'`, { id: Number(id) })
      }
      // 该键按剩余流水重算:结存 = 累计入库(排除月结结转) − 累计出库
      const rest = await p.query(`
        SELECT CAST(ISNULL((SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据类型<>N'${C.CARRY_TYPE}'
                             AND RTRIM(物料编码)=:w AND ISNULL(RTRIM(仓库编码),'')=:c AND ISNULL(RTRIM(批号),'')=:l),0) AS decimal(18,4)) AS inq,
               CAST(ISNULL((SELECT SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
                             AND RTRIM(物料编码)=:w AND ISNULL(RTRIM(仓库编码),'')=:c AND ISNULL(RTRIM(批号),'')=:l),0) AS decimal(18,4)) AS outq`,
      { w: k.w, c: k.c, l: k.l })
      const inq = r4(rest[0].inq), outq = r4(rest[0].outq)
      const bal = r4(inq - outq)
      stats.dupKucun += await p.exec(`UPDATE kucun SET rkl = :inq, ckl = :outq, yl = :bal,
                                             update_date = GETDATE(), asp_user2 = 'balance-fix'
                                        WHERE RTRIM(wzdm)=:w AND ISNULL(RTRIM(ckdm),'')=:c AND ISNULL(RTRIM(lot_no),'')=:l
                                          AND ISNULL(asp_cancel,'N')<>'Y'`,
        { inq, outq, bal, w: k.w, c: k.c, l: k.l })
    }
    if (A.delDup.keys.length) ok(`删除重复入库多余行 ${stats.dupInh} 行,kucun 重算 ${stats.dupKucun} 行`)

    // ③ 关掉「下月月初结转行」:它们是期末标记,会把补的料带进下月期初,让下月月结把补货当入库再分摊一次
    if (CFG.closeNextCarry && docs.length) {
      const maxDocDate = docs.map((d) => d.date).sort().pop()
      const nextMonth = `${addDays(maxDocDate.slice(0, 7) + '-01', 32).slice(0, 7)}-01`
      stats.carryClosed = await p.exec(`DELETE FROM inh WHERE 单据类型 = N'${C.CARRY_TYPE}' AND 单据日期 >= :d`, { d: nextMonth })
      if (stats.carryClosed) ok(`关闭 ${nextMonth} 起的下月结转行 ${stats.carryClosed} 行(补单后重做月结即可重新生成)`)
    }

    // ④ 逐张建单 + 过账
    const nowStr = () => {
      const d = new Date(); const z = (x) => String(x).padStart(2, '0')
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`
    }
    const runAt = nowStr()
    const seenKeys = new Set()
    for (const doc of docs) {
      const auditTime = CFG.auditNow ? runAt : `${doc.date} 17:30:00`
      await p.exec(`INSERT INTO ${C.HEAD} (单据日期, 单据编号, 业务类型, 业务类型编码, 业务类型id, 供应商编码, 供应商,
                      备注, 创建人, 创建时间, 修改人, 修改时间, 审核人, 审核时间, 单据状态, 部门, 部门编码, 经手人, 经手人编码,
                      asp_user1, asp_time1, asp_cancel)
                    VALUES (:d, :no, :bt, :btc, :bti, :sc, :sn, :rmk, :u, :ct, :u, :ct, :u, :ct, N'已审核',
                            '', '', '', '', :u, GETDATE(), 'N')`,
        {
          d: doc.date, no: doc.no, bt: CFG.businessType, btc: 'QTRKLX01', bti: '12',
          sc: CFG.supplier === 'none' ? null : CFG.supplier,
          sn: CFG.supplier === 'none' ? null : 'KG',
          rmk: `负库存配平:补足至 ${CFG.target}(原单缺料/批次错配)`, u: CFG.auditor, ct: auditTime,
        })
      stats.heads++

      let lineNo = 0
      for (const r of doc.rows) {
        const key = `${r.w}\u0001${r.c}\u0001${r.l}`
        if (seenKeys.has(key)) throw new Error(`同一库存键在一批里出现两次:${key}`)
        seenKeys.add(key)
        lineNo++
        // 档案缺失的用单据明细里的名称/规格/单位兜底(补建档案后与之一致)
        const inv = A.maps.invMap.get(String(r.w).trim()) || A.maps.docInv.get(String(r.w).trim()) || {}
        const lot = CFG.lotPolicy === 'pc0000' && !r.l ? 'PC0000' : (r.l || null)
        const px = Number(inv.px || 0)
        const je = r4(px * r.qty)
        const ckn = A.maps.whName.get(String(r.c).trim()) || r.c
        const ridRow = await p.query(`
          INSERT INTO ${C.LINE} (单据编号, 序号, 存货编码, 存货名称, 规格型号, 仓库, 仓库编码, 计量单位,
                 基本单位名称, 基本单位编码, 基本单位id, 辅助单位名称, 辅助单位编码, 辅助单位id, 换算率, 换算系数,
                 辅助换算系数, 数量, 辅助数量, 库存数量, 单价, 金额, 明细备注, 成本, 单位成本, 存货图片,
                 批号, asp_user1, asp_time1, asp_cancel)
          VALUES (:no, :sn, :w, :wn, :ws, :ckn, :ck, :uom,
                  :uom, :uom, :uom, NULL, '', '', '', '1', '0',
                  :q, 0, N'0', :px, :je, NULL, N'0', N'0', N'', :lot, :u, GETDATE(), 'N');
          SELECT CAST(SCOPE_IDENTITY() AS bigint) AS rid`, {
          no: doc.no, sn: lineNo, w: r.w, wn: inv.n ?? '', ws: inv.s ?? '', ckn, ck: r.c, uom: inv.u ?? '',
          q: r.qty, px, je, lot, u: CFG.auditor,
        })
        const rid = Number(ridRow[0].rid)
        stats.lines++

        const upd = await p.exec(`UPDATE kucun SET rkl = ISNULL(rkl,0) + :q, yl = ISNULL(yl,0) + :q,
                                        update_date = GETDATE(), asp_user2 = :u, asp_time2 = GETDATE()
                                   WHERE RTRIM(wzdm) = :w AND ISNULL(RTRIM(ckdm),'') = :c
                                     AND ISNULL(RTRIM(lot_no),'') = :l AND ISNULL(asp_cancel,'N') <> 'Y'`,
          { q: r.qty, u: CFG.auditor, w: r.w, c: r.c, l: r.l })
        if (upd > 0) stats.kucunUpd++
        else {
          await p.exec(`INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)
                        VALUES (:w, :c, :lot, GETDATE(), :q, :q, :px, :u, GETDATE(), 'N')`,
            { w: r.w, c: r.c, lot, q: r.qty, px, u: 'stock:' + CFG.auditor })
          stats.kucunIns++
        }

        await p.exec(`INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                        仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 往来单位, 经手人, 含税金额, 税额,
                        asp_user1, asp_time1, asp_cancel)
                      VALUES (:src, :rid, :no, :dt, :d, :w, :wn, :ws, :uom, :ck, :ckn, :lot, :q, :px, :je,
                        NULL, NULL, NULL, NULL, :u, GETDATE(), 'N')`, {
          src: C.SRC, rid, no: doc.no, dt: C.DOC_TYPE, d: doc.date, w: r.w,
          wn: inv.n ?? '', ws: inv.s ?? '', uom: inv.u ?? '', ck: r.c, ckn, lot,
          q: r.qty, px, je, u: CFG.auditor,
        })
        stats.flows++
      }

      await p.exec(`MERGE yj_doc_status AS t USING (VALUES (:p, :no)) AS s(panel_code, doc_no)
                    ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
                    WHEN MATCHED THEN UPDATE SET shr=:u, shsj=:at, canceled='N', pending='N', saved='Y',
                         approve_node=1, update_at=GETDATE()
                    WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, pending, saved, approve_node, update_at)
                         VALUES (s.panel_code, s.doc_no, :u, :at, 'N', 'N', 'Y', 1, GETDATE())
                    ;`,
        { p: C.PANEL, no: doc.no, u: CFG.auditor, at: auditTime })
      stats.status++

      await p.exec(`INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)
                    VALUES (:p, :no, 'SUBMIT', 'PENDING', 1, :u, NULL, :at)`, { p: C.PANEL, no: doc.no, u: CFG.auditor, at: auditTime })
      await p.exec(`INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)
                    VALUES (:p, :no, 'APPROVE', 'APPROVED', 1, :u, NULL, :at)`, { p: C.PANEL, no: doc.no, u: CFG.auditor, at: auditTime })
      stats.trail += 2
    }

    await p.commit()
    ok(`\n事务已提交:单头 ${stats.heads} · 行 ${stats.lines} · 流水 ${stats.flows} · `
      + `kucun 改 ${stats.kucunUpd}/增 ${stats.kucunIns} · 状态 ${stats.status} · 留痕 ${stats.trail}`)
  } catch (e) {
    try { await p.rollback() } catch { /* 连接已断 */ }
    bad(`写库失败,已整笔回滚(库内无任何改动):${e.message}`)
    if (e && e.sqlSnippet) console.error('   出错 SQL: ' + e.sqlSnippet)
    if (e && e.unexpanded) console.error('   未替换的占位符: ' + e.unexpanded.join(', '))
    await p.close()
    process.exit(5)
  }

  fs.writeFileSync(path.join(CFG.out, `result-${CFG.db}-${stamp}.json`), JSON.stringify({ stats, report }, null, 2), 'utf8')
  await p.close()

  // ── 复核 ──
  const v = await makeSession(CFG.db)
  await verifyOnly(v)
  await v.close()
}

// ════════════════════════════════ 复核 ════════════════════════════════
async function verifyOnly(p) {
  info(`\n${'═'.repeat(78)}\n复核 ${CFG.db}\n${'═'.repeat(78)}`)
  const neg = (await p.query(`SELECT COUNT(*) AS n, CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) AS s
                                FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -:m`, { m: CFG.minQty }))[0]
  info(`① 负结存:${neg.n} 行 / 合计 ${n2(neg.s)}`)
  if (Number(neg.n) === 0) ok('   负库存已清零')
  else {
    bad(`   仍有 ${neg.n} 行负结存:`)
    for (const r of await p.query(`SELECT wzdm, ckdm, lot_no, CAST(yl AS decimal(18,4)) AS yl
                                     FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -:m
                                    ORDER BY yl`, { m: CFG.minQty }))
      info(`     ${pad(r.wzdm, 16)} ${pad(r.ckdm, 10)} ${pad(r.lot_no || '(无批号)', 18)} ${lpad(n2(r.yl), 11)}`)
  }

  const zero = (await p.query(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ABS(ISNULL(yl,0)) <= :m`, { m: CFG.minQty }))[0]
  info(`② 结存为 0 的行:${zero.n} 行${Number(zero.n) ? '(月结时会被当零余额批次清掉,注意)' : ''}`)

  const mine = await p.query(`SELECT h.单据编号, CONVERT(varchar(10),h.单据日期,120) AS d, h.审核人,
                                     COUNT(l.id) AS n, CAST(SUM(l.数量) AS decimal(18,4)) AS q
                                FROM ${C.HEAD} h LEFT JOIN ${C.LINE} l ON l.单据编号 = h.单据编号
                               WHERE h.备注 LIKE N'负库存配平%'
                               GROUP BY h.单据编号, h.单据日期, h.审核人 ORDER BY h.单据日期`)
  if (mine.length) {
    info(`③ 配平单:${mine.length} 张 / ${mine.reduce((x, r) => x + Number(r.n), 0)} 行 / ${n2(mine.reduce((x, r) => x + Number(r.q), 0))}`)
    info(`   审核人:${[...new Set(mine.map((r) => r.审核人))].join(',')}   日期 ${mine[0].d} ~ ${mine[mine.length - 1].d}`)
    info(`   单号 ${mine[0]['单据编号']} ~ ${mine[mine.length - 1]['单据编号']}`)
  } else info('③ 未发现配平单(尚未执行?)')

  const test = await p.query(`SELECT COUNT(*) AS n FROM inh WHERE 物料编码 LIKE '%TEST%'`)
  info(`④ 流水里 TEST* 物料行:${test[0].n} 行${Number(test[0].n) ? '(未清净)' : '(已清净)'}`)
}

// ════════════════════════════════ 交互 ════════════════════════════════
function ask(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a) }))
}

main().catch((e) => {
  console.error('\x1b[31m[✗] 异常:' + (e && e.message ? e.message : e) + '\x1b[0m')
  if (e && e.sqlSnippet) console.error('   出错 SQL: ' + e.sqlSnippet)
  if (e && e.unexpanded) console.error('   未替换的占位符: ' + e.unexpanded.join(', '))
  process.exit(1)
})
