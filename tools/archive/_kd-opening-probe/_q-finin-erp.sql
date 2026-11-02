-- 核实 FINISH_IN 的转ERP按钮与字段(正式库),先找按钮表名
SET NOCOUNT ON;

PRINT N'=== ① 含 button 的表 ===';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
 WHERE TABLE_NAME LIKE '%button%' OR TABLE_NAME LIKE '%btn%';
GO

PRINT N'=== ② FINISH_IN 的 ERP 留痕字段 ===';
SELECT label, data_type, ISNULL(CAST(hidden AS varchar(4)),'') AS 隐藏
  FROM yj_field WHERE panel_code = 'FINISH_IN'
   AND label IN (N'是否已转ERP', N'ERP单号', N'转ERP操作人', N'转ERP时间');
GO

PRINT N'=== ③ 各单据已转ERP统计 ===';
SELECT N'FINISH_IN' AS 面板,
       SUM(CASE WHEN 是否已转ERP=N'是' THEN 1 ELSE 0 END) AS 已转, COUNT(*) AS 总数
  FROM bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'PURCHASE_IN', SUM(CASE WHEN 是否已转ERP=N'是' THEN 1 ELSE 0 END), COUNT(*)
  FROM bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'MATERIAL_OUT', SUM(CASE WHEN 是否已转ERP=N'是' THEN 1 ELSE 0 END), COUNT(*)
  FROM bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'SALE_OUT', SUM(CASE WHEN 是否已转ERP=N'是' THEN 1 ELSE 0 END), COUNT(*)
  FROM bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
