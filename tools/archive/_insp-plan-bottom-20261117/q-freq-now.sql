SET NOCOUNT ON;
SELECT 'LIB' AS kind, lib_code, item_code, content, enabled, seq, ISNULL(asp_cancel, N'N') AS cancel
FROM yj_std_lib WHERE lib_code = N'INSP_FREQ' ORDER BY seq, item_code;
GO
SELECT 'FIELD' AS kind, panel_code, col_name, data_type, dict_sql, visible, hidden
FROM yj_field
WHERE col_name IN (N'检查频率', N'检测频率', N'不合格应对措施')
ORDER BY panel_code, col_name;
GO
SELECT 'PLAN_FREQ' AS kind, ISNULL([检测频率], N'(null)') AS v, COUNT(*) AS n
FROM rd_insp_plan_detail GROUP BY [检测频率] ORDER BY n DESC;
GO
SELECT 'PLAN_MEASURE' AS kind,
       CASE WHEN [不合格应对措施] IS NULL OR LTRIM(RTRIM([不合格应对措施])) = N'' THEN N'(empty)' ELSE LEFT([不合格应对措施], 40) END AS v,
       COUNT(*) AS n, COUNT(DISTINCT ISNULL([不合格应对措施], N'(null)')) AS distinct_all
FROM rd_insp_plan_detail GROUP BY CASE WHEN [不合格应对措施] IS NULL OR LTRIM(RTRIM([不合格应对措施])) = N'' THEN N'(empty)' ELSE LEFT([不合格应对措施], 40) END
ORDER BY n DESC;
GO
SELECT 'PLAN_ROW_MEASURE_DISTINCT' AS kind, COUNT(*) AS rows_total,
       COUNT(DISTINCT ISNULL([不合格应对措施], N'(null)')) AS distinct_values
FROM rd_insp_plan_detail;
GO
