SET NOCOUNT ON;
PRINT '== ① 视图里批号占位统计 ==';
SELECT 批号, COUNT(*) AS n FROM v_stock_movement GROUP BY 批号 ORDER BY n DESC;
PRINT '== ② 采购入库行:批次号列 vs 批号列填充 ==';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(批次号,'')<>'' THEN 1 ELSE 0 END) AS 有批次号,
       SUM(CASE WHEN ISNULL(批号,'')<>'' THEN 1 ELSE 0 END) AS 有批号,
       SUM(CASE WHEN ISNULL(批次号,'')<>'' AND ISNULL(批号,'')='' THEN 1 ELSE 0 END) AS 仅批次号
  FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y';
PRINT '== ③ 销售出库行同查 ==';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(批次号,'')<>'' THEN 1 ELSE 0 END) AS 有批次号,
       SUM(CASE WHEN ISNULL(批号,'')<>'' THEN 1 ELSE 0 END) AS 有批号,
       SUM(CASE WHEN ISNULL(批次号,'')<>'' AND ISNULL(批号,'')='' THEN 1 ELSE 0 END) AS 仅批次号
  FROM bl_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
