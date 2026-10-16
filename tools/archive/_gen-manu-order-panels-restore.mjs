/**
 * _gen-manu-order-panels-restore.mjs — 为「下架 生产工单明细表/统计表」生成**回退脚本**(2026-10-17)。
 *
 * 用户口径:「检查当前生产工单明细标和生产工单统计表,查看当前这两个表是否没有作用,不存在作用的话删除掉」。
 * 本批要删:视图 2 + yj_panel 2 + yj_field 34 + yj_role_panel 6 + yj_translation 18
 * ⇒ 回退脚本必须**逐行原样**能插回去。为避免手抄(抄错一个字段类型就回不去),
 * 这里连库现读:视图定义取自 sys.sql_modules,元数据行按 INFORMATION_SCHEMA 逐列取值后生成 INSERT。
 *
 * 用法(仓库根): node tools/archive/_gen-manu-order-panels-restore.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const OUT = 'tools/archive/_manu-order-report-panels-20261017'
const CODES = ['MANU_ORDER_DETAIL', 'MANU_ORDER_STATS']
const NAMES = ['生产工单明细表', '生产工单统计表']
const VIEWS = ['v_manu_order_detail', 'v_manu_order_stats']

/** 按类型把值转成 T-SQL 字面量 */
function lit(v, type) {
  if (v === null || v === undefined) return 'NULL'
  if (type === 'bit') return v ? '1' : '0'
  if (['int', 'smallint', 'tinyint', 'bigint', 'decimal', 'numeric', 'float', 'real', 'money'].includes(type)) return String(v)
  if (v instanceof Date) return `'${v.toISOString().slice(0, 23).replace('T', ' ')}'`
  return `N'${String(v).replace(/'/g, "''")}'`
}
const isNum = (t) => ['int', 'smallint', 'tinyint', 'bigint', 'decimal', 'numeric', 'float', 'real', 'money'].includes(t)

async function dumpFor(db) {
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: db, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const q = async (s) => (await new mssql.Request(pool).query(s)).recordset
  const L = []
  L.push(`-- restore-${db === 'HSDZ_MES' ? 'prod' : 'test'}.sql`)
  L.push(`--   回退脚本:把「生产工单明细表 MANU_ORDER_DETAIL / 生产工单统计表 MANU_ORDER_STATS」原样插回 ${db}`)
  L.push('--   由 tools/archive/_gen-manu-order-panels-restore.mjs 连库现读生成(视图定义= sys.sql_modules;元数据= 逐列取值)')
  L.push('--   用法: 先确认库名,再整份执行;幂等(已存在则跳过)。')
  L.push(`--   生成时间: ${new Date().toISOString()}`)
  L.push('SET NOCOUNT ON;')
  L.push('GO')
  L.push(`PRINT N'[库] ' + DB_NAME() + N' — 回退 生产工单明细表/统计表';`)
  L.push('GO')

  // ── ① 视图 ──
  for (const v of VIEWS) {
    const r = await q(`SELECT m.definition FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.${v}')`)
    if (!r.length) { L.push(`-- ⚠ 目标库里 ${v} 已不存在,无定义可回退`); L.push('GO'); continue }
    const def = String(r[0].definition).trim().replace(/;\s*$/, '')
    L.push(`IF OBJECT_ID('dbo.${v}','V') IS NULL`)
    L.push('EXEC(N\'' + def.replace(/'/g, "''") + '\');')
    L.push(`ELSE PRINT N'[视图] ${v} 已存在(跳过)';`)
    L.push('GO')
  }

  // ── ② yj_panel / yj_field / yj_role_panel ──
  const TABLES = [
    { t: 'yj_panel', where: `panel_code IN (${CODES.map((c) => `'${c}'`).join(',')})` },
    { t: 'yj_field', where: `panel_code IN (${CODES.map((c) => `'${c}'`).join(',')})` },
    { t: 'yj_role_panel', where: `panel_code IN (${CODES.map((c) => `'${c}'`).join(',')})` },
    { t: 'yj_translation', where: `scope = N'panel' AND ref_key IN (${NAMES.map((n) => `N'${n}'`).join(',')})` },
  ]
  for (const { t, where } of TABLES) {
    const cols = await q(`SELECT c.name, ty.name AS type, c.is_identity FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('dbo.${t}') ORDER BY c.column_id`)
    const names = cols.map((c) => c.name)
    const hasIdentity = cols.some((c) => c.is_identity)
    const rows = await q(`SELECT ${names.map((n) => `[${n}]`).join(',')} FROM dbo.${t} WHERE ${where}`)
    L.push(`-- ── ${t}:${rows.length} 行${hasIdentity ? '(含自增列,按 IDENTITY_INSERT 原值回插)' : ''} ──`)
    if (!rows.length) { L.push('-- (无)'); L.push('GO'); continue }
    // 幂等守卫:id 列(自增)存在即跳过;yj_translation 没有 id,用 (scope,ref_key,locale) 三元组
    const keyCol = t === 'yj_translation' ? ['scope', 'ref_key', 'locale'] : ['id']
    const guard = (r) => 'NOT EXISTS (SELECT 1 FROM dbo.' + t + ' x WHERE '
      + keyCol.map((k) => {
        const c = cols.find((x) => x.name === k)
        return isNum(c?.type) ? `x.[${k}] = ${lit(r[k], 'int')}` : `x.[${k}] = ${lit(r[k], 'nvarchar')}`
      }).join(' AND ') + ')'
    if (hasIdentity) L.push(`SET IDENTITY_INSERT dbo.${t} ON;`)
    for (const r of rows) {
      const vals = cols.map((c) => lit(r[c.name], c.type)).join(', ')
      L.push(`INSERT INTO dbo.${t} (${names.map((n) => `[${n}]`).join(', ')}) SELECT ${vals} WHERE ${guard(r)};`)
    }
    if (hasIdentity) L.push(`SET IDENTITY_INSERT dbo.${t} OFF;`)
    L.push('GO')
  }
  await pool.close()
  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, db === 'HSDZ_MES' ? 'restore-prod.sql' : 'restore-test.sql')
  fs.writeFileSync(file, L.join('\n') + '\n', 'utf8')
  console.log(`已生成 ${file}(${L.length} 行)`)
}

await dumpFor('HSDZ_MES')
await dumpFor('HSDZ_MES_TEST')
