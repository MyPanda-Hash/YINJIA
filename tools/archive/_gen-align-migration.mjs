/**
 * _gen-align-migration.mjs — 生成「测试库字段对齐正式库」迁移脚本(2026-10-08)
 *
 * 输入(两步取证产物,命令见脚本头/README):
 *   ① yj_field 对齐 SQL:tools/archive/_YjFieldAlign.java <正式库> <测试库> yinjia env ALL --sql
 *      → 取其中「--- 对齐 SQL(目标库执行...)---」与「--- 对齐 SQL 结束 ---」之间的部分
 *   ② 视图定义:tools/archive/_DumpSqlObject.java <正式库> ... dbo.v_manu_schedule <out.sql>
 *
 * 输出:tools/migrate-align-ledger-fields-20261008.sql(UTF-8,幂等;正式库上为 no-op)
 *
 * 用法(仓库根目录):
 *   node tools/archive/_gen-align-migration.mjs <yjfield-sql.txt> <view-def.sql> [输出路径]
 */
import fs from 'node:fs'
import path from 'node:path'

const [yjFile, viewFile, outArg] = process.argv.slice(2)
if (!yjFile || !viewFile) {
  console.error('用法: node tools/archive/_gen-align-migration.mjs <yjfield-sql.txt> <view-def.sql> [out.sql]')
  process.exit(2)
}
const out = outArg || 'tools/migrate-align-ledger-fields-20261008.sql'

// ① 取 yj_field 对齐 SQL 段
const yjRaw = fs.readFileSync(yjFile, 'utf8')
const m = yjRaw.match(/--- 对齐 SQL\(目标库执行[^\n]*\)---\r?\n([\s\S]*?)\r?\n--- 对齐 SQL 结束 ---/)
if (!m) throw new Error('没在输入里找到「对齐 SQL」段: ' + yjFile)
const yjSql = m[1].split(/\r?\n/).filter((l) => l.trim() && l.trim() !== 'SET NOCOUNT ON;')
const del = yjSql.filter((l) => l.startsWith('DELETE')).length
const upd = yjSql.filter((l) => l.startsWith('UPDATE')).length
const ins = yjSql.filter((l) => l.startsWith('IF NOT EXISTS')).length
const hid = yjSql.filter((l) => l.includes('hidden=')).length

// ② 视图定义 → EXEC(N'...') 内联(单引号加倍)
const viewDef = fs.readFileSync(viewFile, 'utf8').replace(/^\uFEFF/, '').trim()
const viewEsc = viewDef.replace(/'/g, "''")
if (!/^CREATE\s+VIEW/i.test(viewDef)) throw new Error('视图定义不是 CREATE VIEW 开头,拒绝内联')

const header = `-- migrate-align-ledger-fields-20261008.sql
-- 目的:把测试库(HSDZ_MES_TEST)的**字段元数据与结构**对齐正式库(HSDZ_MES)。依据:
--   docs/development/采购链四单字段与显示字段.md(四单字段与显示字段唯一基线)
--
-- 取证(2026-10-08,均为只读对比):
--   tools/DbSchemaDiff.java  HSDZ_MES vs HSDZ_MES_TEST  →  RESULT: DIFF-22
--     · 列:bs_line_capacity 缺 备用1-20(20 列);bl_sale_out.仓库 测试库是 nvarchar(500)、正式库 nvarchar(1000)
--     · 视图:测试库缺 v_manu_schedule
--     · yj_field:测试库多 10 行(QC_INSP_REQ 备用1/2/21、QC_INSP_REQ_SERIES 备用2-8,早期探针残留)
--   tools/archive/_YjFieldAlign.java(按值比,18 个属性列)ALL → RESULT: DIFF-244
--     · 多 10 行(同上)、改 ${upd} 行(四单 seq 顺序差异为主,其中 ${hid} 行同时带 hidden/visible 变化 ——
--       一律以正式库口径为准,例:PURCHASE_IN.基本单位名称 / QC_INSP.部门名称 正式库是 hidden=1、visible=0)
--
-- 幂等与安全:
--   · 全部语句带存在性/取值守卫,**在正式库上执行等于 no-op**(列已存在、视图已存在、行不匹配即 0 行);
--   · 只改测试库:删的是测试库多出来的行,改的是与正式库取值不同的行;
--   · 视图定义按正式库定义逐字节内联(EXEC(N'...')),不引用任何库名,可直接随部署包发到服务器;
--   · 不删表、不改类型宽度以外的东西,不动业务数据。
--
-- 执行(两个账套都跑,顺序:正式 → 测试):
--   tools/ 下: YINJIA_SQL_DB=HSDZ_MES      java -cp lib\\mssql-jdbc.jar DbSync.java run migrate-align-ledger-fields-20261008.sql
--              YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\\mssql-jdbc.jar DbSync.java run migrate-align-ledger-fields-20261008.sql
-- 校验:DbSchemaDiff → RESULT: IDENTICAL;_YjFieldAlign(ALL)→ RESULT: IDENTICAL

SET NOCOUNT ON;
GO

-- ═══ 一、物理结构对齐 ═══

-- 1.1 产线产能表补 备用1-20(动态字段备用列池;正式库已有,测试库缺)
`

const cols = Array.from({ length: 20 }, (_, i) => i + 1)
const colSql = cols
  .map((n) => `IF COL_LENGTH('dbo.bs_line_capacity', N'备用${n}') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用${n}] nvarchar(500) NULL;`)
  .join('\n')

const body = `GO

-- 1.2 销售出库单.仓库 宽度对齐(nvarchar(500) → nvarchar(1000),与正式库一致)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bl_sale_out') AND name = N'仓库' AND max_length < 2000)
  ALTER TABLE dbo.bl_sale_out ALTER COLUMN [仓库] nvarchar(1000) NULL;
GO

-- 1.3 视图 v_manu_schedule(正式库有、测试库缺;定义取自正式库 sys.sql_modules,逐字节内联)
IF OBJECT_ID('dbo.v_manu_schedule') IS NULL
  EXEC(N'${viewEsc}');
GO

-- ═══ 二、yj_field 元数据对齐(按值:显示名/顺序/位置/参照源/可见性…) ═══
-- 2.1 删除测试库多出来的 ${del} 行(早期探针残留,正式库没有)
`

const sql = header + colSql + '\n' + body + yjSql.join('\n') + '\nGO\n'
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
fs.writeFileSync(out, sql, 'utf8')
console.log(`[ok] ${out}`)
console.log(`     yj_field: 删 ${del} / 改 ${upd} / 增 ${ins};备用列 ${cols.length} 条;视图内联 ${viewDef.length} 字符`)
