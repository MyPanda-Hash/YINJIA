SET NOCOUNT ON;
SELECT 单据编号, 单据类型, 物料编码, 数量, 仓库名称, 批号 FROM inh WHERE 单据编号 IN ('OI-2026-10-0006','OI-2026-10-0007');
GO
SELECT 'kucun' k, 存货编码, 仓库, 批号, 数量 FROM (
  SELECT 'YJ-ZZ-001' 存货编码, '恒亿仓' 仓库, CAST(NULL AS nvarchar(50)) 批号, 0 数量) x WHERE 1=0;
GO
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('kucun') ORDER BY c.column_id;
