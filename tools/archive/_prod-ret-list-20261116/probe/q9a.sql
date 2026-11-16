SET NOCOUNT ON;
-- 生产退料单:单据数、状态分布、业务类型、工单号是否有值
SELECT 'RETDOCS|total=' + CAST(COUNT(*) AS VARCHAR(10))
     + '|生产退料=' + CAST(SUM(CASE WHEN 业务类型=N'生产退料' THEN 1 ELSE 0 END) AS VARCHAR(10))
     + '|有加工单号=' + CAST(SUM(CASE WHEN ISNULL(加工单号,N'')<>N'' THEN 1 ELSE 0 END) AS VARCHAR(10))
FROM bd_material_ret;
