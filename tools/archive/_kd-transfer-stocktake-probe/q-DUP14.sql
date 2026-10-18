SET NOCOUNT ON;
PRINT '=== 同单据+同物料+同仓库+同批号+同数量 的多条未作废流水(重复入账的指纹) ===';
SELECT COUNT(*) 重复组, CAST(SUM(n)-COUNT(*) AS int) 多余行数 FROM (
  SELECT 单据编号, 物料编码, 仓库编码, ISNULL(RTRIM(批号),N'') l, 数量, COUNT(*) n
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  GROUP BY 单据编号,物料编码,仓库编码,ISNULL(RTRIM(批号),N''),数量 HAVING COUNT(*)>1) x;
PRINT '=== outh 同款 ===';
SELECT COUNT(*) 重复组, CAST(SUM(n)-COUNT(*) AS int) 多余行数 FROM (
  SELECT 单据编号, 物料编码, 仓库编码, ISNULL(RTRIM(批号),N'') l, 数量, COUNT(*) n
  FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY 单据编号,物料编码,仓库编码,ISNULL(RTRIM(批号),N''),数量 HAVING COUNT(*)>1) y;
