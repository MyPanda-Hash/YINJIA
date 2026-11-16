SET NOCOUNT ON;
SELECT 'OUTHEAD|cnt=' + CAST(COUNT(*) AS VARCHAR(10)) + '|生产领料=' + CAST(ISNULL(SUM(CASE WHEN 业务类型=N'生产领料' THEN 1 ELSE 0 END),0) AS VARCHAR(10))
FROM bd_material_out;
SELECT TOP 8 'OUT|' + 单据编号 + '|' + CONVERT(VARCHAR(10), 单据日期, 120) + '|' + ISNULL(业务类型,N'') + '|' + ISNULL(asp_user1,N'')
FROM bd_material_out ORDER BY id DESC;
