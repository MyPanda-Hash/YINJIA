/* q-10-writes.sql — 报表读的源表最近有没有被写(只读,动态拼列) */
SET NOCOUNT ON;
GO
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + CASE WHEN @sql = N'' THEN N'' ELSE N' UNION ALL ' END
     + N'SELECT N''' + t.name + N''' AS 表, (SELECT COUNT(*) FROM dbo.' + QUOTENAME(t.name) + N') AS 行数'
     + CASE WHEN COL_LENGTH('dbo.' + t.name, 'asp_time1') IS NOT NULL
            THEN N', (SELECT CONVERT(nvarchar(23), MAX(asp_time1), 121) FROM dbo.' + QUOTENAME(t.name) + N') AS 最近_time1' ELSE N', NULL' END
     + CASE WHEN COL_LENGTH('dbo.' + t.name, 'asp_time2') IS NOT NULL
            THEN N', (SELECT CONVERT(nvarchar(23), MAX(asp_time2), 121) FROM dbo.' + QUOTENAME(t.name) + N') AS 最近_time2' ELSE N', NULL' END
FROM sys.tables t
WHERE t.name IN ('inh','outh','kucun','inv_cost_ledger','bs_inv')
ORDER BY t.name;
EXEC sp_executesql @sql;
GO
SELECT N'单据状态(最近动作)' AS k, panel_code, COUNT(*) AS 单据数,
       CONVERT(nvarchar(23), MAX(shsj), 121) AS 最近审核, CONVERT(nvarchar(23), MAX(pending_at), 121) AS 最近提交
FROM yj_doc_status GROUP BY panel_code HAVING MAX(shsj) >= '2026-10-15' OR MAX(pending_at) >= '2026-10-15'
ORDER BY 最近审核 DESC;
GO
