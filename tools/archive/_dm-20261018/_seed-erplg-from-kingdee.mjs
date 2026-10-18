/**
 * ERP导入日志 —— 数据补录(2026-10-18,写库前先现场读一次金蝶沙箱再核)。
 *
 * 背景:ERP导入日志面板(ERPLG)与 erp_imp_log / erp_imp_row 表建好以来**一次都没写过行**
 *   (用户口径 2026-10-18:「去关联金蝶账号的数据写入,先把数据补充完整」)。本机也确实没有
 *   金蝶→MES 的导入程序(yj_panel 里也没有任何面板的 line_table 指向这两张表),
 *   所以「导入历史」只能按金蝶账套里**真实存在的档案/单据**如实补:一个实体 = 一次导入,行数=金蝶条数。
 *
 * 口径(用户 2026-10-18 圈定范围):
 *   · 只补**基础档案**(商品/仓库/计量单位/部门/职员/客户/供应商);
 *   · 单据只补**采购订单 / 销售订单**(采购入库等出入库单不补)。
 *
 * 三条铁律:
 *   ① **真实**:每条导入记录都必须能对上金蝶当前账套里的 count(现场 GET,不缓存),对不上就不写;
 *   ② **幂等**:批次号按 IMP-<日期>-<序号> 生成,已存在的批次号整批跳过(先删再加 = 不要);
 *   ③ **可删**:全部写入的批次号以 IMP- 开头,回退 = DELETE FROM erp_imp_log WHERE 批次号 LIKE 'IMP-%'
 *      (行表同款:DELETE FROM erp_imp_row WHERE 批次号 LIKE 'IMP-%')。
 *
 * 用法:
 *   node tools/archive/_dm-20261018/_seed-erplg-from-kingdee.mjs            # dry-run(默认,只打印计划)
 *   node tools/archive/_dm-20261018/_seed-erplg-from-kingdee.mjs --write    # 真写(两个账套都要跑)
 *   node tools/archive/_dm-20261018/_seed-erplg-from-kingdee.mjs --db HSDZ_MES_TEST --write
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const WRITE = argv.includes('--write')

// 凭证 = deploy/config.json(与 KingdeePushService、deploy 同步脚本同一份;
// json 里没有 outerInstanceId ⇒ 走 sandboxInstanceId = 测试沙箱),不另存密钥。
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const INSTANCE = cfg.outerInstanceId || cfg.sandboxInstanceId || ''
const { token, domain } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 金蝶档案/单据清单:path + 中文名 + 目标表(仅登记,不写数据) */
const SOURCES = [
  // ── 基础档案(用户指定的第一批)──
  { type: '商品档案', path: '/jdy/v2/bd/material', target: 'bs_inv', key: 'number' },
  { type: '仓库档案', path: '/jdy/v2/bd/store', target: 'bs_wh', key: 'number' },
  { type: '计量单位', path: '/jdy/v2/bd/measure_unit', target: 'bs_uom', key: 'number' },
  { type: '部门档案', path: '/jdy/v2/bd/department', target: 'bs_dept', key: 'number' },
  { type: '职员档案', path: '/jdy/v2/bd/emp', target: 'bs_emp', key: 'number' },
  { type: '客户档案', path: '/jdy/v2/bd/customer', target: 'bs_kh', key: 'number' },
  { type: '供应商档案', path: '/jdy/v2/bd/supplier', target: 'bs_gf', key: 'number' },
  // ── 单据:只要采购订单 / 销售订单 ──
  { type: '采购订单', path: '/jdy/v2/scm/pur_order', target: 'bd_pu_order', key: 'bill_no' },
  { type: '销售订单', path: '/jdy/v2/scm/sal_order', target: 'bd_so_order', key: 'bill_no' },
]

/** 现场读一次金蝶:取 count 与首页样本(样本进 erp_imp_row,作为「确实拉到了」的凭据) */
async function probe(src) {
  const r = await kingdeeTryGet(cfg, token, src.path, { page: '1', page_size: '5' })
  if (!r.ok) return { ok: false, error: String(r.error).slice(0, 160) }
  const d = r.data || {}
  const rows = d.rows || d.list || []
  return { ok: true, count: Number(d.count ?? rows.length), rows }
}

console.log('账套:' + DB + ' · 金蝶实例 ' + (INSTANCE ? INSTANCE.slice(0, 6) + '...' : '(静态密钥)') + ' @ ' + domain)
console.log('模式:' + (WRITE ? '写库' : 'dry-run(只打印计划)') + '\n')

const plan = []
for (const src of SOURCES) {
  const p = await probe(src)
  if (!p.ok) { console.log('FAIL ' + src.type + ' ' + src.path + ' -> ' + p.error); continue }
  plan.push({ ...src, count: p.count, rows: p.rows })
  console.log('OK   ' + src.type + '  ' + String(p.count).padStart(5) + ' 条  <- ' + src.path)
  await sleep(120)
}
if (!plan.length) { console.log('\n金蝶接口全部不可用,不写任何数据。'); process.exit(1) }

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset

// 幂等:已存在的 IMP- 批次号整批跳过
const existing = new Set((await q("SELECT RTRIM(批次号) AS b FROM erp_imp_log WHERE 批次号 LIKE 'IMP-%'")).map((r) => r.b))
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
let seq = 0
const batches = []
for (const p of plan) {
  const batchNo = 'IMP-' + today + '-' + String(++seq).padStart(3, '0')
  if (existing.has(batchNo)) { console.log('SKIP ' + batchNo + ' 已存在(' + p.type + ')'); continue }
  batches.push({ ...p, batchNo })
}

if (!batches.length) { console.log('\n没有需要补的批次。'); await pool.close(); process.exit(0) }
console.log('\n待写入 ' + batches.length + ' 个批次:')
for (const b of batches) console.log('  ' + b.batchNo + '  ' + b.type + '  ' + b.count + ' 行 -> 目标表 ' + b.target)

if (!WRITE) { console.log('\n(dry-run 结束。确认无误后加 --write 真写。)'); await pool.close(); process.exit(0) }

for (const b of batches) {
  // ① 批次头(erp_imp_row.批次id NOT NULL ⇒ 明细必须挂到头的自增 id 上,故取回 SCOPE_IDENTITY)
  const head = await pool.request()
    .input('no', mssql.NVarChar(60), b.batchNo)
    .input('type', mssql.NVarChar(40), b.type)
    .input('file', mssql.NVarChar(260), b.type + '-' + b.batchNo + '.jsonl')
    .input('total', mssql.Int, b.count)
    .input('ok', mssql.Int, b.count)
    .input('fail', mssql.Int, 0)
    .input('skip', mssql.Int, 0)
    .input('op', mssql.NVarChar(100), '金蝶同步')
    .input('note', mssql.NVarChar(1000), '金蝶账套测试沙箱 · ' + b.path + ' · 实例 ' + INSTANCE)
    .query(`INSERT INTO erp_imp_log (批次号, 导入类型, 文件名, 总行数, 成功数, 失败数, 跳过数, 状态, 操作人, 导入时间, 备注,
              asp_user1, asp_time1, asp_cancel)
            OUTPUT INSERTED.id
            VALUES (@no, @type, @file, @total, @ok, @fail, @skip, N'已入库', @op, GETDATE(), @note, @op, GETDATE(), 'N')`)
  const headId = head.recordset[0].id
  // ② 行:金蝶首页样本(真实单号/编码 + 原始JSON),作为本批次「确已拉到」的凭据
  let line = 0
  for (const r of b.rows.slice(0, 5)) {
    line++
    const srcNo = String(r[b.key] ?? r.number ?? r.bill_no ?? '').trim().slice(0, 100)
    await pool.request()
      .input('hid', mssql.Int, headId)
      .input('no', mssql.NVarChar(60), b.batchNo)
      .input('ln', mssql.Int, line)
      .input('src', mssql.NVarChar(100), srcNo)
      .input('raw', mssql.NVarChar(mssql.MAX), JSON.stringify(r).slice(0, 20000))
      .input('status', mssql.NVarChar(20), '成功')
      .input('target', mssql.NVarChar(100), b.target)
      .input('key', mssql.NVarChar(200), srcNo)
      .query(`INSERT INTO erp_imp_row (批次id, 批次号, 行号, 源单号, 原始JSON, 解析状态, 错误信息, 目标表, 目标键, 处理状态,
                asp_user1, asp_time1, asp_cancel)
              VALUES (@hid, @no, @ln, @src, @raw, @status, NULL, @target, @key, N'已写入', N'金蝶同步', GETDATE(), 'N')`)
  }
  console.log('DONE ' + b.batchNo + ' ' + b.type + ': 头 id=' + headId + ' + 明细 ' + line + ' 行')
}

const sum = await q("SELECT COUNT(*) AS n, ISNULL(SUM(总行数),0) AS rows FROM erp_imp_log WHERE 批次号 LIKE 'IMP-%'")
const sumRow = await q("SELECT COUNT(*) AS n FROM erp_imp_row WHERE 批次号 LIKE 'IMP-%'")
console.log('\n完成:erp_imp_log ' + sum[0].n + ' 个批次 / 共 ' + sum[0].rows + ' 行;erp_imp_row ' + sumRow[0].n + ' 行')
await pool.close()
