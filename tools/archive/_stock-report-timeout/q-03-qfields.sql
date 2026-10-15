/* q-03-qfields.sql — 库存报表面板「查询弹窗」字段的参照配置(只读) */
SET NOCOUNT ON;
GO
SELECT panel_code, seq, label, col_name, data_type, place, ref_panel, ref_field, display_field, ref_filter, visible, hidden
FROM yj_field
WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY')
  AND (place LIKE '%query%')
ORDER BY panel_code, seq;
GO
SELECT panel_code, panel_name, mode, line_table, page_size FROM yj_panel
WHERE panel_code IN ('INV','WH','STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY');
GO
