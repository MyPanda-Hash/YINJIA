SET NOCOUNT ON;
PRINT '== ① yj_field 里所有 仓库名称 字段 ==';
SELECT panel_code, col_name, label, place, data_type, ref_panel, editable, required, hidden, visible
  FROM yj_field WHERE col_name = N'仓库名称' OR label = N'仓库名称' ORDER BY panel_code, place;
GO
PRINT '== ② 物理列名为 仓库名称 的业务表 ==';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name, c.max_length
  FROM sys.columns c WHERE c.name = N'仓库名称' AND OBJECT_NAME(c.object_id) NOT LIKE 'yj_%' ORDER BY 1;
GO
PRINT '== ③ 销售出库两列现状 ==';
SELECT COUNT(*) AS 总行,
  SUM(CASE WHEN [仓库] IS NOT NULL AND [仓库]<>'' THEN 1 ELSE 0 END) AS 有仓库,
  SUM(CASE WHEN [仓库名称] IS NOT NULL AND [仓库名称]<>'' THEN 1 ELSE 0 END) AS 有仓库名称,
  SUM(CASE WHEN [仓库编码] IS NOT NULL AND [仓库编码]<>'' THEN 1 ELSE 0 END) AS 有仓库编码
  FROM bl_sale_out;
GO
PRINT '== ④ 这些表的 仓库 列现状(是否与新名冲突) ==';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name FROM sys.columns c
 WHERE c.name IN (N'仓库', N'仓库名称') AND OBJECT_NAME(c.object_id) IN ('bl_purchase_in','bd_purchase_in','bl_sale_out','bd_sale_out')
 ORDER BY 1, 2;
GO
