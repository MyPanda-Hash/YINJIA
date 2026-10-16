/* _probe-plangpc-scjl-ident.sql — 只读：三表 IDENTITY 当前值 vs 实际最大 id(判断是否被重建/重灌过) */
SET NOCOUNT ON;
SELECT 'IDENT_CURRENT' AS k,
       'plang=' + CAST(IDENT_CURRENT('dbo.plang') AS varchar(20))
       + ' (max_id=' + CAST((SELECT MAX(id) FROM dbo.plang) AS varchar(20)) + ')'
       + ' | plang_pc=' + CAST(IDENT_CURRENT('dbo.plang_pc') AS varchar(20))
       + ' (max_id=' + CAST((SELECT MAX(id) FROM dbo.plang_pc) AS varchar(20)) + ')'
       + ' | scjl=' + CAST(IDENT_CURRENT('dbo.scjl') AS varchar(20))
       + ' (max_id=' + CAST((SELECT MAX(id) FROM dbo.scjl) AS varchar(20)) + ')' AS v;

SELECT '== plang 批次号分布(前 8) ==' AS section;
SELECT TOP 8 ISNULL(批次号,'(空)') + ' × ' + CAST(COUNT(*) AS varchar(10)) AS v
FROM dbo.plang GROUP BY 批次号 ORDER BY COUNT(*) DESC;

SELECT '== plang 工单号前缀分布 ==' AS section;
SELECT TOP 10 LEFT(pl_no, CHARINDEX('-', pl_no + '-') - 1) + ' × ' + CAST(COUNT(*) AS varchar(10)) AS v
FROM dbo.plang GROUP BY LEFT(pl_no, CHARINDEX('-', pl_no + '-') - 1) ORDER BY COUNT(*) DESC;

SELECT '== plang_pc / scjl 行是否只覆盖 GD-2026-10-0007 ==' AS section;
SELECT 'plang_pc: ' + ISNULL(STUFF((SELECT DISTINCT ', ' + pl_no FROM dbo.plang_pc FOR XML PATH(''), TYPE).value('.','nvarchar(max)'), 1, 2, ''), '(空)')
     + ' | scjl: ' + ISNULL(STUFF((SELECT DISTINCT ', ' + ISNULL(gldh,'(空 gldh)') FROM dbo.scjl FOR XML PATH(''), TYPE).value('.','nvarchar(max)'), 1, 2, ''), '(空)') AS v;

SELECT '== yj_schema_log 列 ==' AS section;
SELECT STUFF((SELECT ', ' + c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_schema_log') FOR XML PATH(''), TYPE).value('.','nvarchar(max)'), 1, 2, '') AS v;
