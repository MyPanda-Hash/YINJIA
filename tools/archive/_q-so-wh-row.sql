SET NOCOUNT ON;
SELECT col_name, label, place, data_type, dict_sql, ref_panel, ref_field, display_field, editable, required, hidden, visible
  FROM yj_field WHERE panel_code = 'SALE_OUT' AND col_name = N'仓库';
GO
SELECT COUNT(*) AS 总行,
  SUM(CASE WHEN [仓库] IS NOT NULL AND [仓库]<>'' THEN 1 ELSE 0 END) AS 有仓库,
  SUM(CASE WHEN [仓库名称] IS NOT NULL AND [仓库名称]<>'' THEN 1 ELSE 0 END) AS 有仓库名称
  FROM bl_so_order;
GO
