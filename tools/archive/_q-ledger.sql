SET NOCOUNT ON;
SELECT 'yj_schema_log 存在?' AS 检查, CASE WHEN OBJECT_ID('yj_schema_log') IS NULL THEN N'不存在' ELSE N'存在' END AS v;
IF OBJECT_ID('yj_schema_log') IS NOT NULL
BEGIN
  SELECT '台账列' AS t, c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_schema_log') ORDER BY c.column_id;
  SELECT COUNT(*) AS 台账条数 FROM yj_schema_log;
END
