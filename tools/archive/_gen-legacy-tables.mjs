// _gen-legacy-tables.mjs — 从参考库结构 dump 生成「本机缺失的遗留表」建表迁移
//
// 背景:2026-10-03 拉取远端后实测,本机两账套(HSDZ_MES / HSDZ_MES_TEST)缺少三张**在册**遗留表
//   plang(工单) / plang_pc(工单排产) / scjl(生产记录)—— 远端库有(源自参考库),仓库里没有建表脚本,
//   于是迁移链跑到 migrate-plang-workorder.sql 就报「找不到对象 dbo.plang」而中止,
//   排在它后面的库存三表/表定册/备用列池等全部跑不到。
//
// 数据源:tools/archive/_ref-dump/01-table-structure.txt(参考库表结构 dump,
//   格式:==== TABLE <name> ==== / 表头 name|typ|is_nullable|dflt|is_identity|cmt)
//
// 用法:node tools/archive/_gen-legacy-tables.mjs [输出路径]
//   默认写 tools/migrate-legacy-plang-scjl-tables.sql(直接 fs.writeFileSync 写 UTF-8 无 BOM ——
//   不要用 PowerShell 的 `>` 重定向:PS 5.1 默认写 UTF-16LE,SqlRunner 读它必报「Input length = 1」)。
//   生成物需人工复核(尤其 PK/默认值),再登记进 tools/db-migrations.txt 链(插在 plang/scjl 迁移之前)。
import fs from 'node:fs'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '..', '..')
const dump = fs.readFileSync(path.join(repo, 'tools', 'archive', '_ref-dump', '01-table-structure.txt'), 'utf8')

const WANT = ['plang', 'plang_pc', 'scjl']
const tables = new Map()
let cur = null
for (const raw of dump.split('\n')) {
  const line = raw.replace(/\r$/, '')
  const m = line.match(/^==== TABLE (\S+) ====$/)
  if (m) { cur = m[1]; tables.set(cur, []); continue }
  if (!cur) continue
  if (/^name \| typ \|/.test(line)) continue
  if (!line.trim()) continue
  const p = line.split('|').map((s) => s.trim())
  if (p.length < 6) continue
  const [name, typ, isNullable, dflt, isIdentity, ...cmt] = p
  tables.get(cur).push({ name, typ, isNullable, dflt, isIdentity, cmt: cmt.join('|').trim() })
}

const esc = (s) => s.replace(/'/g, "''")
const out = []
out.push(`/* =============================================================================
   migrate-legacy-plang-scjl-tables.sql — 补建本机缺失的三张在册遗留表
   (plang 工单 / plang_pc 工单排产 / scjl 生产记录)

   为什么需要(2026-10-03 实测):
     拉取远端 167 提交后跑 DbSync,链在 migrate-plang-workorder.sql 报
       「找不到对象 "dbo.plang",因为它不存在或者你没有所需的权限。」
     根因**不是脚本错**:plang/plang_pc/scjl 是参考库(原始系统)的遗留表,
     远端库有(随参考库恢复带入),本机两账套从未存在过 —— 全库扫描确认本机
     HSDZ_MES / HSDZ_MES_TEST / HSDZ_MES_CHAIN / HSDZ_MES_RESTORE 五库**都没有**这三张表。
     而它们在 tools/db-inuse-tables.txt 里是**在册**表(第 9 组 legacy),
     且下列在链脚本直接依赖:
       · migrate-plang-workorder / migrate-plang-batch / migrate-plang-schedule
       · migrate-plangpc-board / migrate-pc-plang-id
       · migrate-scjl-report / migrate-scjl-single-table
       · migrate-spare-columns-biz(在册业务表 备用1..20 列池,含这三张)
     不补建则这些脚本一律中止,而**库存三表重构等排在它们之后**,整条链跑不到。

   结构来源:tools/archive/_ref-dump/01-table-structure.txt(参考库表结构 dump)。
   生成器:tools/archive/_gen-legacy-tables.mjs(本文件由其生成,勿手改;要改结构改 dump/生成器后重跑)。

   ⚠ 口径声明:
     ① 这是**结构补建**(空表),不含参考库的业务数据 —— 本机无参考库数据备份(43MB 的
        HSDZ_MES_backup_2026_08_28 需 sysadmin 才能 RESTORE,本机 yinjia 账号无该权限)。
        故本机这三张表建成后为空,「生产工单/报工」页在本机取自表的业务数据自然为空。
     ② dump 是「生产管理相关列」子集(plang 56 / plang_pc 56 / scjl 77 列),
        与表清单登记的总列数(78 / 76 / 99)不等 —— 差额列由链上后续迁移补(ALTER ADD),
        或按运行时实测报错逐个补齐;本脚本只保证**结构与已 dump 部分**一致。
     ③ 幂等:OBJECT_ID 守卫建表,列注明逐条先判后加;两账套都要执行。

   依赖:无(纯建表)。被依赖:migrate-plang-*.sql / migrate-scjl-*.sql / migrate-spare-columns-biz.sql
   ⚠ 本脚本**刻意不写** 裸 USE 语句(DbSync 明令拦截:裸 USE 会让「连测试库跑」静默切到正式库),
     一律用当前连接所在的库 —— 两账套各自生效。
   ============================================================================= */
SET NOCOUNT ON;
GO
`)

for (const t of WANT) {
  const cols = tables.get(t)
  if (!cols || !cols.length) throw new Error('dump 中找不到表:' + t)
  out.push(`-- ══════════════════ ${t}(${cols.length} 列,源自参考库 dump) ══════════════════`)
  out.push(`IF OBJECT_ID(N'dbo.${t}') IS NULL`)
  out.push(`BEGIN`)
  out.push(`    CREATE TABLE dbo.${t} (`)
  const defs = cols.map((c) => {
    let d = `        [${c.name}] ${c.typ}`
    if (c.isIdentity === '1') d += ' IDENTITY(1,1)'
    d += c.isNullable === '0' ? ' NOT NULL' : ' NULL'
    if (c.dflt && c.dflt.trim() && c.isIdentity !== '1') {
      // 原样透传 sys.default_constraints.definition 的文本(如 ((0)) / (getdate()) / ('') ——
      // 都是合法 T-SQL,SQL Server 自己脚本化出来的就是这个形态)。
      // ⚠ 别去"解括号":上一版按 /^\(\(/ 与 /\)\)$/ 去壳,把 (getdate()) 截成了 (getdate() → 语法错误。
      d += ` CONSTRAINT [DF_${t}_${c.name}] DEFAULT ${c.dflt.trim()}`
    }
    return d
  })
  // 主键:id 为自增列时作 PK(参考库这三张表都以 id 为行标识;链上迁移用 pc.plang_id = p.id 关联)
  const idCol = cols.find((c) => c.name === 'id')
  if (idCol) defs.push(`        CONSTRAINT [PK_${t}] PRIMARY KEY CLUSTERED ([id])`)
  out.push(defs.join(',\n'))
  out.push(`    );`)
  out.push(`    PRINT N'已建表 ${t}';`)
  out.push(`END`)
  out.push(`GO`)

  // 表级 + 列级中文注明(AGENTS.md:新增表必须带 MS_Description 中文注明)
  const tblCmt = { plang: '工单(参考库遗留表:外部系统直接写单,键=公司+工单号 pl_no+工单行号 pl_xc)', plang_pc: '工单排产(参考库遗留表:plang 的排产行,plang_id 锚回 plang.id)', scjl: '生产记录(参考库遗留表:工序报工/生产记录,gd_id 锚 plang_pc.id)' }[t]
  out.push(`-- 表级中文注明`)
  out.push(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.${t}') AND minor_id=0 AND name=N'MS_Description')`)
  out.push(`    EXEC sp_addextendedproperty N'MS_Description', N'${esc(tblCmt)}', N'SCHEMA', N'dbo', N'TABLE', N'${t}';`)
  out.push(`GO`)
  out.push(`-- 列级中文注明(有 dump 中文名的列逐列注明;无名的列不臆造)`)
  for (const c of cols) {
    if (!c.cmt) continue
    out.push(`IF COL_LENGTH(N'dbo.${t}', N'${esc(c.name)}') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.${t}') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.${t}'), N'${esc(c.name)}', 'ColumnId') AND name=N'MS_Description')`)
    out.push(`    EXEC sp_addextendedproperty N'MS_Description', N'${esc(c.cmt)}', N'SCHEMA', N'dbo', N'TABLE', N'${t}', N'COLUMN', N'${esc(c.name)}';`)
  }
  out.push(`GO`)
  out.push(``)
}

out.push(`-- ══════════════════ 自检:三张表就位 ══════════════════`)
out.push(`SELECT N'遗留表就位' AS 检查, COUNT(*) AS 应等于3`)
out.push(`FROM sys.tables WHERE name IN (N'plang', N'plang_pc', N'scjl');`)
out.push(`GO`)
out.push(`PRINT N'migrate-legacy-plang-scjl-tables 完成';`)
out.push(`GO`)

const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repo, 'tools', 'migrate-legacy-plang-scjl-tables.sql')
fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf8')
console.log('已写出 ' + outPath + '(' + (out.join('\n') + '\n').split('\n').length + ' 行)')
