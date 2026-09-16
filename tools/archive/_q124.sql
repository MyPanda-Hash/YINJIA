SET NOCOUNT ON;
-- 查看实际数据库中的值
SELECT panel_code, col_name, ref_panel, ref_field, display_field, hidden, required FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER')
  AND place='detail' AND col_name IN (N'仓库',N'仓库名称')
ORDER BY panel_code, col_name;
