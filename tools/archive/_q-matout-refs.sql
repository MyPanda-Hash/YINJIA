SET NOCOUNT ON;
-- MATERIAL_OUT 字段的关联三要素(ref_panel/ref_field/display_field)+ 与 PURCHASE_IN 对照
SELECT panel_code, place, seq, col_name, label, data_type, ISNULL(ref_panel,'') AS ref_panel,
       ISNULL(ref_field,'') AS ref_field, ISNULL(display_field,'') AS display_field,
       ISNULL(dict_sql,'') AS dict_sql, editable, required, hidden, visible
FROM yj_field
WHERE panel_code IN ('MATERIAL_OUT') 
ORDER BY place, seq;
GO
SELECT 'PURCHASE_IN 参照字段' AS k, col_name, data_type, ISNULL(ref_panel,'') AS ref_panel, ISNULL(ref_field,'') AS ref_field, ISNULL(display_field,'') AS display_field, place, seq
FROM yj_field WHERE panel_code='PURCHASE_IN' AND data_type=N'参照' ORDER BY place, seq;
GO
SELECT 'INV 面板字段' AS k, col_name, label, data_type, place, seq FROM yj_field WHERE panel_code='INV' ORDER BY place, seq;
GO
