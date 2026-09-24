// 由参考库结构导出生成 tools/migrate-op-time-table.sql(gxgs 建表迁移)。
// 数据源:tools/archive/_ref-dump/01-table-structure.txt 的 `==== TABLE gxgs ====` 段
// (每行:name | typ | is_nullable | dflt | is_identity | cmt)。
// 用法: node tools/archive/_gen-gxgs-migration.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dump = fs.readFileSync(path.join(root, 'tools/archive/_ref-dump/01-table-structure.txt'), 'utf8').split(/\r?\n/);
const start = dump.findIndex((l) => l.trim() === '==== TABLE gxgs ====');
if (start < 0) throw new Error('未找到 gxgs 段');
const cols = [];
for (let i = start + 2; i < dump.length; i++) {
  const line = dump[i];
  if (!line.trim()) break;
  if (/^--\s*\d+\s*rows/.test(line.trim())) break;
  const [name, typ, nullable, dflt, identity, cmt] = line.split('|').map((s) => s.trim());
  if (!name) continue;
  cols.push({ name, typ, nullable: nullable === '1', dflt, identity: identity === '1', cmt });
}
if (cols.length !== 71) throw new Error(`列数不是 71,而是 ${cols.length}`);

const q = (s) => `N'${s.replace(/'/g, "''")}'`;
const defs = cols.map((c) => {
  const identity = c.identity ? ' IDENTITY(1,1)' : '';
  const nullSql = c.nullable ? 'NULL' : 'NOT NULL';
  const dflt = c.dflt && c.dflt !== '' ? ` CONSTRAINT DF_gxgs_${c.name} DEFAULT ${c.dflt}` : '';
  return `    [${c.name}] ${c.typ}${identity} ${nullSql}${dflt}`;
});
// id 主键(参考库 id 为自增;面板 pk_col=id)
defs.push('    CONSTRAINT PK_gxgs PRIMARY KEY CLUSTERED ([id])');

const props = [];
props.push(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.gxgs') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序工时(按 客户×物料×工序 维护 换线/标准·最快·最慢·平均时间与加工单价;排产产能与计件依据;参考库同名表结构重建)', N'SCHEMA', N'dbo', N'TABLE', N'gxgs';`);
for (const c of cols) {
  if (!c.cmt) continue;
  props.push(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'${c.name}', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', ${q(c.cmt)}, N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'${c.name}';`);
}

const header = `-- migrate-op-time-table.sql — 工序工时 gxgs 建表(2026-09-24)
-- ═════════════════════════════════════════════════════════════════════════════
-- 背景:OP_TIME「工序工时」面板 line_table = gxgs,但本机两账套**没有这张表** ——
--   旧脚本 migrate-op-time-and-scx.sql 的前提是「参考库 gxgs 已存在,只补面板与字段」,
--   于是面板建了、表却没建,点开即报「对象名 'gxgs' 无效」(2026-09-24 下拉生产域时实测)。
-- 本脚本按参考库实测结构逐列重建(来源:tools/archive/_ref-dump/01-table-structure.txt
--   「==== TABLE gxgs ====」段,71 列;列名/类型/可空/默认值/中文注明全部对齐,由
--   tools/archive/_gen-gxgs-migration.mjs 生成,避免手抄 71 列出错)。
-- 幂等:表已存在则整段跳过;注明用 extended_properties 幂等补充(有则不动)。
-- 依赖:无。登记位置在 db-migrations.txt 中 **migrate-op-time-and-scx.sql 之前**
--   (面板注册先于建表也能工作,但按语义先有表更清晰)。
-- 说明:不含业务数据 —— 参考库该表仅 1 行样本(见 _ref-dump/03-counts-samples.txt),
--   需要演示数据时另起 seed,不混在建表迁移里。
SET NOCOUNT ON;
GO
IF OBJECT_ID('dbo.gxgs') IS NULL
CREATE TABLE dbo.gxgs (
${defs.join(',\n')}
);
GO
-- 中文注明(表 + 非空注释列,幂等)
${props.join('\nGO\n')}
GO
-- 自检(⚠ PRINT 里不能直接放子查询:Msg 1046「只能使用常量表达式」,必须先赋变量)
IF OBJECT_ID('dbo.gxgs') IS NULL RAISERROR(N'[op-time-table] 自检失败:gxgs 不存在', 16, 1);
ELSE BEGIN
  DECLARE @col_count int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.gxgs'));
  PRINT N'[op-time-table] gxgs 就绪,列数 = ' + CAST(@col_count AS nvarchar(10));
END
GO
`;

fs.writeFileSync(path.join(root, 'tools/migrate-op-time-table.sql'), header);
console.log(`已生成 tools/migrate-op-time-table.sql:${cols.length} 列,中文注明 ${props.length - 1} 列`);
