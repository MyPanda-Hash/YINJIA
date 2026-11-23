/* 只读:yj_schema_log 里本任务两条脚本的记账行(证明 DbSync 已记账、后续 sync 不会重放) */
SET NOCOUNT ON;

SELECT N'[schema_log] 本任务两条' AS 标签, script_name, applied_at, content_hash
FROM dbo.yj_schema_log
WHERE script_name IN (N'migrate-sample-catalog-rev-20261119.sql', N'migrate-sample-reg-detail-tab-20261119.sql')
ORDER BY script_name;

SELECT N'[schema_log] 总行数' AS 标签, CAST(COUNT(*) AS nvarchar(20)) AS 行数 FROM dbo.yj_schema_log;
