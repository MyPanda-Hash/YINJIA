SET NOCOUNT ON;
SELECT DB_NAME() AS db, COUNT(*) AS heads FROM rd_insp_plan_head;
SELECT DB_NAME() AS db, COUNT(*) AS today_heads FROM rd_insp_plan_head WHERE [单据日期] = '2026-11-17';
SELECT DB_NAME() AS db, COUNT(*) AS rows_total,
       COUNT(DISTINCT ISNULL([不合格应对措施], N'(null)')) AS distinct_measure,
       SUM(CASE WHEN [不合格应对措施] LIKE N'%合并格验证%' THEN 1 ELSE 0 END) AS test_marker_rows
FROM rd_insp_plan_detail;
GO
