SET NOCOUNT ON;
PRINT N'=== 1. yj_schema_log 列结构 ===';
SELECT c.name AS 列, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id;
GO
PRINT N'=== 2. 迁移链最近执行 20 条 ===';
SELECT TOP 20 * FROM dbo.yj_schema_log ORDER BY id DESC;
GO
PRINT N'=== 3. 审计日志里所有含 仓库/WH 的记录(近 30) ===';
SELECT TOP 30 id, panel_code, doc_no, user_name, CONVERT(varchar(19), saved_at, 120) AS 时间,
       LEFT(CAST(change_meta AS nvarchar(300)), 250) AS 摘要
FROM yj_archive_change_log ORDER BY id DESC;
GO
PRINT N'=== 4. 测试库 bs_wh 对照(若仍是 11 行 ⇒ 仅正式库被改) ===';
SELECT id, 仓库编码, 仓库名称 FROM dbo.bs_wh ORDER BY 仓库编码, id;
GO
PRINT N'=== 5. 库内是否有 bs_wh 的备份/快照表 ===';
SELECT name, type_desc FROM sys.objects WHERE name LIKE N'%bs_wh%' OR name LIKE N'%wh[_]bak%' OR name LIKE N'%仓库%' ORDER BY name;
GO
