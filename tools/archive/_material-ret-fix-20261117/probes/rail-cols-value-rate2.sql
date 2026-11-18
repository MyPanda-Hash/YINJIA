SET NOCOUNT ON;
SELECT COUNT(*) AS docs,
  SUM(CASE WHEN ISNULL(生产车间,N'')<>N'' THEN 1 ELSE 0 END) AS 生产车间,
  SUM(CASE WHEN ISNULL(领料类型,N'')<>N'' THEN 1 ELSE 0 END) AS 领料类型,
  SUM(CASE WHEN ISNULL(金蝶单据状态,N'')<>N'' THEN 1 ELSE 0 END) AS 金蝶单据状态,
  SUM(CASE WHEN ISNULL(备注,N'')<>N'' THEN 1 ELSE 0 END) AS 备注
FROM dbo.bd_material_ret WHERE ISNULL(asp_cancel,N'N')<>N'Y';