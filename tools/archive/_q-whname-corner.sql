SET NOCOUNT ON;
PRINT '== ① bl_so_order 仓库类列 ==';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('bl_so_order') AND c.name LIKE N'%仓库%' ORDER BY c.column_id;
GO
PRINT '== ② 三个面板现有 仓库 字段行(防重名冲突) ==';
SELECT panel_code, col_name, label, place, hidden FROM yj_field
 WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER') AND col_name = N'仓库';
GO
PRINT '== ③ bl_so_order 数据填充 ==';
SELECT COUNT(*) AS 总行,
  SUM(CASE WHEN [仓库] IS NOT NULL AND [仓库]<>'' THEN 1 ELSE 0 END) AS 有仓库,
  SUM(CASE WHEN [仓库名称] IS NOT NULL AND [仓库名称]<>'' THEN 1 ELSE 0 END) AS 有仓库名称
  FROM bl_so_order;
GO
