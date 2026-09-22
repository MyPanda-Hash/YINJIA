SET NOCOUNT ON;
SELECT '列' AS k, OBJECT_NAME(c.object_id) AS tbl, c.name AS col
  FROM sys.columns c
 WHERE c.name IN (N'单据状态',N'单据状态2',N'asp_cancel',N'仓库名称',N'id')
   AND (OBJECT_NAME(c.object_id) LIKE N'bd[_]%' OR OBJECT_NAME(c.object_id) LIKE N'bl[_]%' OR OBJECT_NAME(c.object_id) IN (N'bs_wh',N'kucun'))
 ORDER BY 2,3;
GO
SELECT 'kucun.id 唯一性' AS k, COUNT(*) AS rows_n, COUNT(DISTINCT id) AS distinct_n, SUM(CASE WHEN id IS NULL THEN 1 ELSE 0 END) AS null_n FROM kucun;
GO
